import { computed } from "vue";
import type { PoseLandmarkLike } from "~/types/pose";
import {
  useBeatWindowMovementRecognition,
  type BeatWindowAttemptRules,
} from "~/composables/useBeatWindowMovementRecognition";
import {
  getMedianSampleValue,
  pushRollingSample,
} from "~/utils/movement/core/calibration";
import {
  WINTER_BEAT_EVALUATION_WINDOW_MS,
  evaluateWinterBeat,
  evaluateWinterSequence,
  extractWinterRecognitionMetrics,
  getPrioritizedWinterProblemEvaluation,
  resolveWinterValue,
  type WinterBeat,
  type WinterBeatEvaluation,
  type WinterFeedbackCode,
  type WinterNeutralReference,
  type WinterRecognitionMetrics,
  type WinterRecognitionResultState,
  type WinterSequenceEvaluation,
  type WinterValue,
} from "~/utils/movement/acts/climate/winter/winterMovementRecognition";

export type WinterMeasureResult =
  | "success"
  | "almostCorrect"
  | "failed"
  | "trackingUnavailable";

export type WinterMeasureEvaluation = {
  cycleIndex: number;
  result: WinterMeasureResult;
  score: number;
  beatEvaluations: WinterBeatEvaluation[];
  primaryFeedbackCode?: WinterFeedbackCode;
};

const winterBeats = [1, 2, 3, 4] as WinterBeat[];
const winterBeatTargetsMs: Record<WinterBeat, number> = {
  1: 0,
  2: 1000,
  3: 2000,
  4: 3000,
};

const winterExpectedMeasures = 3;
const winterVariationDurationMs = 4000;
const maxPreparationSamples = 18;

type PreparationSample = {
  headY: number;
  shoulderCenterY: number;
  hipCenterY: number;
  bodyHeight: number;
  torsoLength: number;
  ankleDistance: number;
};

const getMeasureResult = (
  evaluation: WinterSequenceEvaluation,
): WinterMeasureResult => {
  if (evaluation.resultState === "success") return "success";
  if (evaluation.resultState === "almostCorrect") return "almostCorrect";
  if (evaluation.resultState === "trackingUnavailable") {
    return "trackingUnavailable";
  }

  return "failed";
};

const getPrimaryMeasureFeedbackCode = (
  beatEvaluations: WinterBeatEvaluation[],
  fallbackCode?: WinterFeedbackCode,
) => {
  if (beatEvaluations.some((evaluation) => evaluation.trackingUnavailable)) {
    return "FULL_BODY_NOT_VISIBLE";
  }

  return (
    getPrioritizedWinterProblemEvaluation(beatEvaluations)?.feedbackCode ??
    fallbackCode
  );
};

export const useWinterMovementRecognition = () => {
  const preparationSamples: PreparationSample[] = [];
  let neutralReference: WinterNeutralReference | null = null;

  const resetNeutralReference = () => {
    preparationSamples.length = 0;
    neutralReference = null;
  };

  const collectNeutralReference = (landmarks: PoseLandmarkLike[] | null) => {
    if (!landmarks?.length) return;

    const metrics = extractWinterRecognitionMetrics(landmarks, {
      expectedValue: engine.currentValue.value,
    });

    engine.setLatestMetrics(metrics);

    if (
      metrics.headY === null ||
      metrics.shoulderCenterY === null ||
      metrics.hipCenterY === null ||
      metrics.bodyHeight === null ||
      metrics.torsoLength === null ||
      metrics.normalizedAnkleDistance === null
    ) {
      return;
    }

    pushRollingSample(
      preparationSamples,
      {
        headY: metrics.headY,
        shoulderCenterY: metrics.shoulderCenterY,
        hipCenterY: metrics.hipCenterY,
        bodyHeight: metrics.bodyHeight,
        torsoLength: metrics.torsoLength,
        ankleDistance: metrics.normalizedAnkleDistance,
      },
      maxPreparationSamples,
    );

    neutralReference = {
      headY: getMedianSampleValue(preparationSamples, (sample) => sample.headY),
      shoulderCenterY: getMedianSampleValue(
        preparationSamples,
        (sample) => sample.shoulderCenterY,
      ),
      hipCenterY: getMedianSampleValue(
        preparationSamples,
        (sample) => sample.hipCenterY,
      ),
      bodyHeight: getMedianSampleValue(
        preparationSamples,
        (sample) => sample.bodyHeight,
      ),
      torsoLength: getMedianSampleValue(
        preparationSamples,
        (sample) => sample.torsoLength,
      ),
      ankleDistance: getMedianSampleValue(
        preparationSamples,
        (sample) => sample.ankleDistance,
      ),
      sampleCount: preparationSamples.length,
    };
  };

  const engine = useBeatWindowMovementRecognition<
    WinterBeat,
    WinterValue,
    WinterRecognitionMetrics,
    WinterFeedbackCode,
    WinterBeatEvaluation,
    WinterSequenceEvaluation
  >({
    seasonId: "winter",
    defaultValue: "100",
    beatTargetsMs: winterBeatTargetsMs,
    beats: winterBeats,
    evaluationWindowMs: WINTER_BEAT_EVALUATION_WINDOW_MS,
    variationDurationMs: winterVariationDurationMs,
    measuresPerValue: winterExpectedMeasures,
    requiredSuccessfulMeasures: 2,
    createEmptyMetrics: () => extractWinterRecognitionMetrics(null),
    evaluateBeat: ({ landmarks, beat, timestamp, value }) =>
      evaluateWinterBeat(landmarks, beat, timestamp, {
        expectedValue: value,
        neutralReference,
      }),
    evaluateSequence: evaluateWinterSequence,
    getMeasureResult,
    isMeasureSuccessfulForStreak: (result) =>
      result === "success" || result === "almostCorrect",
    getPrimaryMeasureFeedbackCode,
    onPreparationFrame: collectNeutralReference,
    onBeforeAttemptReset: resetNeutralReference,
    adaptFinalSequenceEvaluation: ({ evaluation, reachedRequiredStreak }) => ({
      ...evaluation,
      passed: reachedRequiredStreak,
      resultState: reachedRequiredStreak
        ? ("success" as WinterRecognitionResultState)
        : ("retryRequired" as WinterRecognitionResultState),
      feedbackCode: reachedRequiredStreak
        ? "SUCCESS"
        : (evaluation.feedbackCode ?? "TRY_AGAIN"),
    }),
  });

  const start = ({
    value = "100",
    rules,
  }: {
    value?: WinterValue | number | string;
    rules?: BeatWindowAttemptRules;
  } = {}) => {
    engine.start({ value: resolveWinterValue(value), rules });
  };

  const resultState = computed(
    () => engine.sequenceEvaluation.value?.resultState ?? null,
  );
  const debugSnapshot = computed(() => {
    const snapshot = engine.debugSnapshot.value;
    const evaluation = engine.currentEvaluation.value;

    return {
      ...snapshot,
      expectedValue: engine.currentValue.value,
      detectedContractionClass:
        evaluation?.metrics.detectedContractionClass ?? "unknown",
      expectedContractionClass:
        evaluation?.metrics.expectedContractionClass ?? "unknown",
      neutralReference,
      cycleResults: engine.measureEvaluations.value,
      currentCycleResult: engine.currentMeasureEvaluation.value,
      consecutiveSuccessfulCycles: engine.consecutiveSuccessfulMeasures.value,
    };
  });

  const reset = () => {
    resetNeutralReference();
    engine.reset();
  };

  return {
    phase: engine.phase,
    expectedValue: engine.currentValue,
    currentBeat: engine.currentBeat,
    currentRepetitionIndex: engine.currentRepetitionIndex,
    currentEvaluation: engine.currentEvaluation,
    currentCycleEvaluation: engine.currentMeasureEvaluation,
    sequenceEvaluation: engine.sequenceEvaluation,
    resultState,
    feedbackCode: engine.feedbackCode,
    trackingActive: engine.trackingActive,
    latestMetrics: engine.latestMetrics,
    finalizedBeatEvaluations: engine.finalizedBeatEvaluations,
    cycleEvaluations: engine.measureEvaluations,
    consecutiveSuccessfulCycles: engine.consecutiveSuccessfulMeasures,
    hasReachedRequiredStreak: engine.hasReachedRequiredStreak,
    debugSnapshot,
    reset,
    start,
    updateFrame: engine.updateFrame,
  };
};
