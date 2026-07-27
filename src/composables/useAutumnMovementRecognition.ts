import { computed } from "vue";
import type { PoseLandmarkLike } from "~/types/pose";
import { useBeatWindowMovementRecognition } from "~/composables/useBeatWindowMovementRecognition";
import {
  AUTUMN_BEAT_EVALUATION_WINDOW_MS,
  evaluateAutumnBeat,
  evaluateAutumnSequence,
  extractAutumnRecognitionMetrics,
  getAutumnDirectionForRepetition,
  getPrioritizedAutumnProblemEvaluation,
  type AutumnBeat,
  type AutumnBeatEvaluation,
  type AutumnFeedbackCode,
  type AutumnRecognitionMetrics,
  type AutumnRecognitionResultState,
  type AutumnSequenceEvaluation,
  type AutumnStartReference,
  type AutumnValueClass,
} from "~/utils/movement/acts/climate/autumn/autumnMovementRecognition";

export type AutumnCycleResult =
  | "success"
  | "almostCorrect"
  | "failed"
  | "trackingUnavailable";

export type AutumnCycleEvaluation = {
  cycleIndex: number;
  result: AutumnCycleResult;
  score: number;
  beatEvaluations: AutumnBeatEvaluation[];
  primaryFeedbackCode?: AutumnFeedbackCode;
};

const autumnBeats = [1, 2, 3, 4] as AutumnBeat[];
const autumnBeatTargetsMs: Record<AutumnBeat, number> = {
  1: 0,
  2: 1000,
  3: 2000,
  4: 3000,
};

const autumnExpectedMeasures = 4;
const autumnVariationDurationMs = 4000;

const getCycleResult = (
  evaluation: AutumnSequenceEvaluation,
): AutumnCycleResult => {
  if (evaluation.resultState === "success") return "success";
  if (evaluation.resultState === "almostCorrect") return "almostCorrect";
  if (evaluation.resultState === "trackingUnavailable") {
    return "trackingUnavailable";
  }

  return "failed";
};

const getPrimaryCycleFeedbackCode = (
  beatEvaluations: AutumnBeatEvaluation[],
  fallbackCode?: AutumnFeedbackCode,
) => {
  if (beatEvaluations.some((evaluation) => evaluation.trackingUnavailable)) {
    return "FULL_BODY_NOT_VISIBLE";
  }

  return (
    getPrioritizedAutumnProblemEvaluation(beatEvaluations)?.feedbackCode ??
    fallbackCode
  );
};

const getBeat1StartReference = (
  evaluation: AutumnBeatEvaluation,
): AutumnStartReference | null => {
  if (evaluation.beat !== 1) return null;

  const startCriterion = evaluation.criteria.find(
    (criterion) => criterion.id === "hands-start-side",
  );

  if (!startCriterion?.passed) return null;

  return {
    handCenterXOffset: evaluation.metrics.handCenterXOffset,
    outerWristXOffset: evaluation.metrics.outerWristXOffset,
    normalizedProgress: evaluation.metrics.normalizedProgress,
    detectedStartSide: evaluation.metrics.detectedStartSide,
    startSidePassed: true,
  };
};

export const useAutumnMovementRecognition = () => {
  const beat1References = new Map<number, AutumnStartReference>();
  const engine = useBeatWindowMovementRecognition<
    AutumnBeat,
    AutumnValueClass,
    AutumnRecognitionMetrics,
    AutumnFeedbackCode,
    AutumnBeatEvaluation,
    AutumnSequenceEvaluation
  >({
    seasonId: "autumn",
    defaultValue: "100",
    beatTargetsMs: autumnBeatTargetsMs,
    beats: autumnBeats,
    evaluationWindowMs: AUTUMN_BEAT_EVALUATION_WINDOW_MS,
    variationDurationMs: autumnVariationDurationMs,
    measuresPerValue: autumnExpectedMeasures,
    requiredSuccessfulMeasures: 2,
    createEmptyMetrics: () => extractAutumnRecognitionMetrics(null),
    evaluateBeat: ({ landmarks, beat, timestamp, measureIndex, value }) =>
      evaluateAutumnBeat(landmarks, beat, timestamp, {
        expectedDirection: getAutumnDirectionForRepetition(measureIndex),
        expectedValueClass: value,
        startReference: beat1References.get(measureIndex) ?? null,
      }),
    evaluateSequence: evaluateAutumnSequence,
    getMeasureResult: getCycleResult,
    isMeasureSuccessfulForStreak: (result) =>
      result === "success" || result === "almostCorrect",
    getPrimaryMeasureFeedbackCode: getPrimaryCycleFeedbackCode,
    onBeforeAttemptReset: () => {
      beat1References.clear();
    },
    onBeatFinalized: (evaluation, measureIndex) => {
      const startReference = getBeat1StartReference(evaluation);

      if (startReference) {
        beat1References.set(measureIndex, startReference);
      }
    },
    adaptFinalSequenceEvaluation: ({ evaluation, reachedRequiredStreak }) => ({
      ...evaluation,
      passed: reachedRequiredStreak,
      resultState: reachedRequiredStreak
        ? ("success" as AutumnRecognitionResultState)
        : ("retryRequired" as AutumnRecognitionResultState),
      feedbackCode: reachedRequiredStreak
        ? "SUCCESS"
        : (evaluation.feedbackCode ?? "TRY_AGAIN"),
    }),
  });

  const start = ({
    valueClass = "100",
  }: {
    valueClass?: AutumnValueClass;
  } = {}) => {
    engine.start({ value: valueClass });
  };

  const updateFrame = (frame: {
    landmarks: PoseLandmarkLike[] | null;
    playbackState: "idle" | "countdown" | "playing" | "paused" | "completed";
    seasonId: string;
    seasonElapsedMs: number;
    repetitionIndex: number | null;
    isTransition: boolean;
    timestamp?: number;
  }) => {
    engine.updateFrame(frame);
  };
  const resultState = computed(
    () => engine.sequenceEvaluation.value?.resultState ?? null,
  );

  return {
    phase: engine.phase,
    expectedValueClass: engine.currentValue,
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
    debugSnapshot: engine.debugSnapshot,
    reset: engine.reset,
    start,
    updateFrame,
  };
};
