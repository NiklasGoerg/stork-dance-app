import { computed } from "vue";
import type { PoseLandmarkLike } from "~/types/pose";
import type { BeatWindowAttemptRules } from "~/types/movement";
import {
  getMedianSampleValue,
  pushRollingSample,
} from "~/utils/movement/core/calibration";
import { useSeasonMovementRecognition } from "~/composables/act5/useSeasonMovementRecognition";
import {
  evaluateSpringBeat,
  evaluateSpringSequence,
  extractSpringRecognitionMetrics,
  getPrioritizedSpringProblemEvaluation,
  getSpringExpectedKneeSideForMeasure,
  resolveSpringValue,
  type SpringBeat,
  type SpringBeatEvaluation,
  type SpringFeedbackCode,
  type SpringPreparationReference,
  type SpringRecognitionMetrics,
  type SpringRecognitionResultState,
  type SpringSequenceEvaluation,
  type SpringValue,
} from "~/utils/movement/acts/climate/spring/springMovementRecognition";

export type SpringMeasureResult =
  "success" | "almostCorrect" | "failed" | "trackingUnavailable";

export type SpringMeasureEvaluation = {
  cycleIndex: number;
  result: SpringMeasureResult;
  score: number;
  beatEvaluations: SpringBeatEvaluation[];
  primaryFeedbackCode?: SpringFeedbackCode;
};

type PreparationSample = {
  leftHandLateralOffset: number;
  rightHandLateralOffset: number;
  lowerHandHeight: number;
};

const maxPreparationSamples = 16;

const getMeasureResult = (
  evaluation: SpringSequenceEvaluation,
): SpringMeasureResult => {
  if (evaluation.resultState === "success") return "success";
  if (evaluation.resultState === "almostCorrect") return "almostCorrect";
  if (evaluation.resultState === "trackingUnavailable") {
    return "trackingUnavailable";
  }

  return "failed";
};

const getPrimaryMeasureFeedbackCode = (
  beatEvaluations: SpringBeatEvaluation[],
  fallbackCode?: SpringFeedbackCode,
) => {
  if (beatEvaluations.some((evaluation) => evaluation.trackingUnavailable)) {
    return "FULL_BODY_NOT_VISIBLE";
  }

  return (
    getPrioritizedSpringProblemEvaluation(beatEvaluations)?.feedbackCode ??
    fallbackCode
  );
};

export const useSpringMovementRecognition = () => {
  const preparationSamples: PreparationSample[] = [];
  let preparationReference: SpringPreparationReference | null = null;

  const resetPreparationReference = () => {
    preparationSamples.length = 0;
    preparationReference = null;
  };

  const collectPreparationReference = (
    landmarks: PoseLandmarkLike[] | null,
  ) => {
    if (!landmarks?.length) return;

    const metrics = extractSpringRecognitionMetrics(landmarks, {
      expectedValue: engine.currentValue.value,
      expectedKneeSide: "unknown",
    });

    engine.setLatestMetrics(metrics);

    if (
      metrics.leftHandLateralOffset === null ||
      metrics.rightHandLateralOffset === null ||
      metrics.lowerHandHeight === null
    ) {
      return;
    }

    pushRollingSample(
      preparationSamples,
      {
        leftHandLateralOffset: metrics.leftHandLateralOffset,
        rightHandLateralOffset: metrics.rightHandLateralOffset,
        lowerHandHeight: metrics.lowerHandHeight,
      },
      maxPreparationSamples,
    );

    preparationReference = {
      leftHandLateralOffset: getMedianSampleValue(
        preparationSamples,
        (sample) => sample.leftHandLateralOffset,
      ),
      rightHandLateralOffset: getMedianSampleValue(
        preparationSamples,
        (sample) => sample.rightHandLateralOffset,
      ),
      lowerHandHeight: getMedianSampleValue(
        preparationSamples,
        (sample) => sample.lowerHandHeight,
      ),
      sampleCount: preparationSamples.length,
    };
  };

  const engine = useSeasonMovementRecognition<
    SpringBeat,
    SpringValue,
    SpringRecognitionMetrics,
    SpringFeedbackCode,
    SpringBeatEvaluation,
    SpringSequenceEvaluation
  >({
    seasonId: "spring",
    defaultValue: "100",
    createEmptyMetrics: () => extractSpringRecognitionMetrics(null),
    evaluateBeat: ({ landmarks, beat, timestamp, measureIndex, value }) =>
      evaluateSpringBeat(landmarks, beat, timestamp, {
        expectedValue: value,
        measureIndex,
        expectedKneeSide: getSpringExpectedKneeSideForMeasure(measureIndex),
        preparationReference,
      }),
    evaluateSequence: evaluateSpringSequence,
    getMeasureResult,
    isMeasureSuccessfulForStreak: (result) =>
      result === "success" || result === "almostCorrect",
    getPrimaryMeasureFeedbackCode,
    onPreparationFrame: collectPreparationReference,
    onBeforeAttemptReset: resetPreparationReference,
    adaptFinalSequenceEvaluation: ({ evaluation, reachedRequiredStreak }) => ({
      ...evaluation,
      passed: reachedRequiredStreak,
      resultState: reachedRequiredStreak
        ? ("success" as SpringRecognitionResultState)
        : ("retryRequired" as SpringRecognitionResultState),
      feedbackCode: reachedRequiredStreak
        ? "SUCCESS"
        : (evaluation.feedbackCode ?? "TRY_AGAIN"),
      primaryFeedbackCode: reachedRequiredStreak
        ? "SUCCESS"
        : (evaluation.feedbackCode ?? "TRY_AGAIN"),
    }),
  });

  const start = ({
    value = "100",
    rules,
  }: {
    value?: SpringValue | number | string;
    rules?: BeatWindowAttemptRules;
  } = {}) => {
    engine.start({ value: resolveSpringValue(value), rules });
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
      expectedKneeSide:
        evaluation?.expectedKneeSide ??
        (engine.currentRepetitionIndex.value === null
          ? "unknown"
          : getSpringExpectedKneeSideForMeasure(
              engine.currentRepetitionIndex.value,
            )),
      detectedKneeSide: evaluation?.metrics.detectedKneeSide ?? "unknown",
      detectedHandHeightRegion:
        evaluation?.metrics.detectedHandHeightRegion ?? "unknown",
      preparationReference,
      cycleResults: engine.measureEvaluations.value,
      currentCycleResult: engine.currentMeasureEvaluation.value,
      consecutiveSuccessfulCycles: engine.consecutiveSuccessfulMeasures.value,
    };
  });

  const reset = () => {
    resetPreparationReference();
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
