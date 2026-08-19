import { computed, ref } from "vue";
import type { PoseLandmarkLike } from "~/types/pose";
import type { BeatWindowAttemptRules } from "~/types/movement";
import {
  getMedianSampleValue,
  pushRollingSample,
} from "~/utils/movement/core/calibration";
import { useSeasonMovementRecognition } from "~/composables/act4/useSeasonMovementRecognition";
import {
  evaluateSummerBeat,
  evaluateSummerSequence,
  extractSummerRecognitionMetrics,
  type SummerBeat,
  type SummerBeatEvaluation,
  type SummerFeedbackCode,
  type SummerIntensity,
  type SummerNeutralCalibration,
  type SummerRecognitionMetrics,
  type SummerRecognitionResultState,
  type SummerSequenceEvaluation,
  type SummerStepSide,
} from "~/utils/movement/acts/climate/summer/summerMovementRecognition";

export type SummerCycleResult =
  "success" | "almostCorrect" | "failed" | "trackingUnavailable";

export type SummerCycleEvaluation = {
  cycleIndex: number;
  result: SummerCycleResult;
  score: number;
  beatEvaluations: SummerBeatEvaluation[];
  primaryFeedbackCode?: SummerFeedbackCode;
};

const minCalibrationSamples = 6;
const maxCalibrationSamples = 18;

type CalibrationSample = {
  leftAnkleX: number;
  rightAnkleX: number;
  ankleDistance: number;
};

const oppositeStepSide = (side: Exclude<SummerStepSide, "none" | "unknown">) =>
  side === "left" ? "right" : "left";

const isConcreteStepSide = (
  side: SummerStepSide,
): side is Exclude<SummerStepSide, "none" | "unknown"> =>
  side === "left" || side === "right";

const getCycleResult = (
  evaluation: SummerSequenceEvaluation,
): SummerCycleResult => {
  if (evaluation.resultState === "success") return "success";
  if (evaluation.resultState === "almostCorrect") return "almostCorrect";
  if (evaluation.resultState === "trackingUnavailable") {
    return "trackingUnavailable";
  }

  return "failed";
};

export const useSummerMovementRecognition = () => {
  const retryCount = ref(0);
  const expectedStepSide = ref<Exclude<
    SummerStepSide,
    "none" | "unknown"
  > | null>(null);
  const neutralCalibration = ref<SummerNeutralCalibration | null>(null);
  const detectedStepSides = ref<SummerStepSide[]>([]);

  const calibrationSamples: CalibrationSample[] = [];
  let firstStepSide: Exclude<SummerStepSide, "none" | "unknown"> | null = null;
  let expansionReference: {
    normalizedAnkleDistance: number | null;
    lowestHandHeightFromShoulders: number | null;
  } | null = null;
  let preparationReference: {
    handRaiseAmplitude: number | null;
    normalizedArmOpening: number | null;
  } | null = null;

  const resetCalibration = () => {
    calibrationSamples.length = 0;
    neutralCalibration.value = null;
  };

  const resetSummerAttemptState = () => {
    detectedStepSides.value = [];
    expectedStepSide.value = null;
    firstStepSide = null;
    expansionReference = null;
    preparationReference = null;
  };

  const collectCalibration = (landmarks: PoseLandmarkLike[] | null) => {
    if (!landmarks?.length) return;

    const metrics = extractSummerRecognitionMetrics(landmarks);

    engine.setLatestMetrics(metrics);

    if (
      metrics.shoulderWidth === null ||
      metrics.normalizedAnkleDistance === null ||
      metrics.normalizedAnkleDistance > 0.85
    ) {
      return;
    }

    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];

    if (!leftAnkle || !rightAnkle) return;

    pushRollingSample(
      calibrationSamples,
      {
        leftAnkleX: leftAnkle.x,
        rightAnkleX: rightAnkle.x,
        ankleDistance: metrics.normalizedAnkleDistance,
      },
      maxCalibrationSamples,
    );

    const leftAnkleX = getMedianSampleValue(
      calibrationSamples,
      (sample) => sample.leftAnkleX,
    );
    const rightAnkleX = getMedianSampleValue(
      calibrationSamples,
      (sample) => sample.rightAnkleX,
    );
    const ankleDistance = getMedianSampleValue(
      calibrationSamples,
      (sample) => sample.ankleDistance,
    );

    if (
      calibrationSamples.length >= minCalibrationSamples &&
      leftAnkleX !== null &&
      rightAnkleX !== null &&
      ankleDistance !== null
    ) {
      neutralCalibration.value = {
        leftAnkleX,
        rightAnkleX,
        ankleDistance,
        sampleCount: calibrationSamples.length,
      };
    }
  };

  const getExpectedSideForBeat = (beat: SummerBeat) =>
    beat === 2 || beat === 3 ? expectedStepSide.value : null;

  const rememberPreparationReference = (evaluation: SummerBeatEvaluation) => {
    if (evaluation.beat !== 1) return;

    preparationReference = {
      handRaiseAmplitude: evaluation.metrics.handRaiseAmplitude,
      normalizedArmOpening: evaluation.metrics.normalizedArmOpening,
    };
  };

  const rememberExpansionReference = (evaluation: SummerBeatEvaluation) => {
    if (evaluation.beat !== 2 && evaluation.beat !== 3) return;

    const handHeights = [
      evaluation.metrics.leftHandHeightFromShoulders,
      evaluation.metrics.rightHandHeightFromShoulders,
    ].filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
    const lowestHandHeightFromShoulders = handHeights.length
      ? Math.min(...handHeights)
      : null;
    const currentAnkleDistance = evaluation.metrics.normalizedAnkleDistance;

    expansionReference = {
      normalizedAnkleDistance: Math.max(
        expansionReference?.normalizedAnkleDistance ?? 0,
        currentAnkleDistance ?? 0,
      ),
      lowestHandHeightFromShoulders: Math.min(
        expansionReference?.lowestHandHeightFromShoulders ??
          Number.POSITIVE_INFINITY,
        lowestHandHeightFromShoulders ?? Number.POSITIVE_INFINITY,
      ),
    };
  };

  const rememberStepSide = (evaluation: SummerBeatEvaluation) => {
    if (evaluation.beat !== 2) return;
    if (!isConcreteStepSide(evaluation.detectedStepSide)) return;

    detectedStepSides.value = [
      ...detectedStepSides.value,
      evaluation.detectedStepSide,
    ];

    const alternationCriterion = evaluation.criteria.find(
      (item) => item.id === "alternate-step-side",
    );

    if (!firstStepSide) {
      firstStepSide = evaluation.detectedStepSide;
      expectedStepSide.value = oppositeStepSide(firstStepSide);
      return;
    }

    if (alternationCriterion?.passed) {
      expectedStepSide.value = oppositeStepSide(evaluation.detectedStepSide);
    }
  };

  const getPrimaryCycleFeedbackCode = (
    beatEvaluations: SummerBeatEvaluation[],
    fallbackCode?: SummerFeedbackCode,
  ): SummerFeedbackCode | undefined => {
    if (beatEvaluations.some((evaluation) => evaluation.trackingUnavailable)) {
      return "FULL_BODY_NOT_VISIBLE";
    }

    const priorityFeedbackCode = beatEvaluations
      .filter((evaluation) => evaluation.beat === 2 || evaluation.beat === 4)
      .flatMap((evaluation) => evaluation.criteria)
      .find(
        (criterion) =>
          criterion.importance === "essential" &&
          criterion.status === "failed" &&
          criterion.feedbackCode,
      )?.feedbackCode;

    if (priorityFeedbackCode) return priorityFeedbackCode;

    const hasFailedCriterion = (beat: SummerBeat, ids: string[]) =>
      beatEvaluations.some(
        (evaluation) =>
          evaluation.beat === beat &&
          evaluation.criteria.some(
            (criterion) =>
              ids.includes(criterion.id) && criterion.status === "failed",
          ),
      );

    if (hasFailedCriterion(2, ["hands-above-head", "both-arms-raised"])) {
      return "RAISE_ARMS_HIGHER";
    }

    if (hasFailedCriterion(2, ["one-leg-stepped-side"])) {
      return "TRY_AGAIN";
    }

    if (
      hasFailedCriterion(2, ["alternate-step-side"]) ||
      hasFailedCriterion(3, ["stepped-leg-remains"])
    ) {
      return "ALTERNATE_STEP_SIDE";
    }

    if (hasFailedCriterion(3, ["hands-open-sides"])) {
      return "OPEN_ARMS_TO_SIDES";
    }

    if (hasFailedCriterion(4, ["feet-returned-close"])) {
      return "RETURN_FEET_TO_CENTER";
    }

    if (hasFailedCriterion(4, ["hands-lowered-sides"])) {
      return "LOWER_ARMS";
    }

    if (
      beatEvaluations.some((evaluation) =>
        evaluation.criteria.some(
          (criterion) =>
            criterion.importance === "supporting" &&
            criterion.status === "failed" &&
            criterion.id.includes("straight"),
        ),
      )
    ) {
      return "STRAIGHTEN_ARMS";
    }

    return fallbackCode;
  };

  const engine = useSeasonMovementRecognition<
    SummerBeat,
    SummerIntensity,
    SummerRecognitionMetrics,
    SummerFeedbackCode,
    SummerBeatEvaluation,
    SummerSequenceEvaluation
  >({
    seasonId: "summer",
    defaultValue: "100",
    createEmptyMetrics: () => extractSummerRecognitionMetrics(null),
    evaluateBeat: ({ landmarks, beat, timestamp, measureIndex, value }) =>
      evaluateSummerBeat(landmarks, beat, timestamp, {
        expectedIntensity: value,
        measureIndex,
        expectedStepSide: getExpectedSideForBeat(beat),
        neutralCalibration: neutralCalibration.value,
        expansionReference,
        preparationReference,
      }),
    evaluateSequence: evaluateSummerSequence,
    getMeasureResult: getCycleResult,
    isMeasureSuccessfulForStreak: (result) =>
      result === "success" || result === "almostCorrect",
    getPrimaryMeasureFeedbackCode: getPrimaryCycleFeedbackCode,
    onPreparationFrame: collectCalibration,
    onBeforeAttemptReset: resetSummerAttemptState,
    onBeatFinalized: (evaluation) => {
      rememberPreparationReference(evaluation);
      rememberExpansionReference(evaluation);
      rememberStepSide(evaluation);
    },
    adaptFinalSequenceEvaluation: ({ evaluation, reachedRequiredStreak }) => ({
      ...evaluation,
      passed: reachedRequiredStreak,
      resultState: reachedRequiredStreak
        ? ("success" as SummerRecognitionResultState)
        : ("retryRequired" as SummerRecognitionResultState),
      feedbackCode: reachedRequiredStreak
        ? "SUCCESS"
        : (evaluation.feedbackCode ?? "TRY_AGAIN"),
      primaryFeedbackCode: reachedRequiredStreak
        ? "SUCCESS"
        : (evaluation.feedbackCode ?? evaluation.primaryFeedbackCode),
    }),
  });

  const reset = () => {
    retryCount.value = 0;
    resetCalibration();
    engine.reset();
  };

  const start = ({
    manual = false,
    keepCalibration = false,
    intensity = "100",
    rules,
  }: {
    manual?: boolean;
    keepCalibration?: boolean;
    intensity?: SummerIntensity;
    rules?: BeatWindowAttemptRules;
  } = {}) => {
    if (manual) retryCount.value = 0;
    if (!keepCalibration) resetCalibration();

    engine.start({ value: intensity, rules });
  };

  const markRetryConsumed = () => {
    retryCount.value++;
    engine.phase.value = "retrying";
  };

  const canRetryAutomatically = computed(() => engine.retryRequired.value);
  const resultState = computed(
    () => engine.sequenceEvaluation.value?.resultState ?? null,
  );
  const debugSnapshot = computed(() => {
    const snapshot = engine.debugSnapshot.value;
    const evaluation = engine.currentEvaluation.value;

    return {
      ...snapshot,
      expectedIntensity: engine.currentValue.value,
      detectedStepSide: evaluation?.detectedStepSide ?? "unknown",
      detectedIntensityClass: evaluation?.detectedIntensityClass ?? "unknown",
      expectedStepSide: expectedStepSide.value ?? "unknown",
      movementShapePassed: evaluation?.movementShapePassed ?? false,
      intensityMatched: evaluation?.intensityMatched ?? false,
      movementShapeScore: evaluation?.movementShapeScore ?? 0,
      intensityMatchScore: evaluation?.intensityMatchScore ?? 0,
      cycleResults: engine.measureEvaluations.value,
      currentCycleResult: engine.currentMeasureEvaluation.value,
      consecutiveSuccessfulCycles: engine.consecutiveSuccessfulMeasures.value,
      retryCount: retryCount.value,
      calibration: neutralCalibration.value,
    };
  });

  return {
    phase: engine.phase,
    currentBeat: engine.currentBeat,
    currentRepetitionIndex: engine.currentRepetitionIndex,
    currentEvaluation: engine.currentEvaluation,
    currentCycleEvaluation: engine.currentMeasureEvaluation,
    sequenceEvaluation: engine.sequenceEvaluation,
    resultState,
    feedbackCode: engine.feedbackCode,
    retryCount,
    retryRequired: engine.retryRequired,
    expectedIntensity: engine.currentValue,
    consecutiveSuccessfulCycles: engine.consecutiveSuccessfulMeasures,
    hasReachedRequiredStreak: engine.hasReachedRequiredStreak,
    trackingActive: engine.trackingActive,
    expectedStepSide,
    latestMetrics: engine.latestMetrics,
    neutralCalibration,
    finalizedBeatEvaluations: engine.finalizedBeatEvaluations,
    cycleEvaluations: engine.measureEvaluations,
    detectedStepSides,
    canRetryAutomatically,
    debugSnapshot,
    reset,
    start,
    updateFrame: engine.updateFrame,
    markRetryConsumed,
  };
};
