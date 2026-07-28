import { computed, ref } from "vue";
import type { PoseLandmarkLike } from "~/types/pose";

export type MovementRecognitionPhase =
  | "idle"
  | "demonstrating"
  | "preparing"
  | "performing"
  | "evaluating"
  | "showingFeedback"
  | "retrying"
  | "completed";

export type MovementCriterionStatus = "passed" | "failed" | "notEvaluable";
export type MovementCriterionImportance = "essential" | "supporting";

export type MovementCriterionLike<TFeedback extends string = string> = {
  id: string;
  label: string;
  status: MovementCriterionStatus;
  passed: boolean;
  importance: MovementCriterionImportance;
  feedbackCode?: TFeedback;
};

export type MovementBeatEvaluationLike<
  TBeat extends number = number,
  TMetrics = unknown,
  TFeedback extends string = string,
> = {
  beat: TBeat;
  score: number;
  passed: boolean;
  trackingUnavailable: boolean;
  criteria: MovementCriterionLike<TFeedback>[];
  timestamp: number;
  feedbackCode?: TFeedback;
  metrics: TMetrics;
};

export type MovementMeasureResult =
  | "success"
  | "almostCorrect"
  | "failed"
  | "trackingUnavailable";

export type MovementMeasureEvaluation<
  TBeatEvaluation extends MovementBeatEvaluationLike,
  TFeedback extends string,
> = {
  measureIndex: number;
  cycleIndex: number;
  result: MovementMeasureResult;
  score: number;
  beatEvaluations: TBeatEvaluation[];
  primaryFeedbackCode?: TFeedback;
};

export type BeatWindowAttemptRules = {
  measuresPerValue?: number;
  requiredSuccessfulMeasures?: number;
};

type FrameUpdate = {
  landmarks: PoseLandmarkLike[] | null;
  playbackState: "idle" | "countdown" | "playing" | "paused" | "completed";
  seasonId: string;
  seasonElapsedMs: number;
  repetitionIndex: number | null;
  isTransition: boolean;
  evaluationEnabled?: boolean;
  timestamp?: number;
};

type BeatSample<TBeatEvaluation extends MovementBeatEvaluationLike> = {
  evaluation: TBeatEvaluation;
  distanceFromBeatMs: number;
};

type SequenceEvaluationLike<
  TBeatEvaluation extends MovementBeatEvaluationLike,
  TFeedback extends string,
> = {
  passed: boolean;
  resultState: string;
  totalScore: number;
  beatEvaluations: TBeatEvaluation[];
  feedbackCode?: TFeedback;
};

type UseBeatWindowMovementRecognitionOptions<
  TBeat extends number,
  TValue extends string,
  TMetrics,
  TFeedback extends string,
  TBeatEvaluation extends MovementBeatEvaluationLike<
    TBeat,
    TMetrics,
    TFeedback
  >,
  TSequenceEvaluation extends SequenceEvaluationLike<
    TBeatEvaluation,
    TFeedback
  >,
> = {
  seasonId: string;
  defaultValue: TValue;
  beatTargetsMs: Record<TBeat, number>;
  beats: TBeat[];
  evaluationWindowMs: number;
  variationDurationMs: number;
  measuresPerValue: number;
  requiredSuccessfulMeasures?: number;
  createEmptyMetrics: () => TMetrics;
  evaluateBeat: (params: {
    landmarks: PoseLandmarkLike[] | null;
    beat: TBeat;
    timestamp: number;
    measureIndex: number;
    value: TValue;
  }) => TBeatEvaluation;
  evaluateSequence: (
    beatEvaluations: TBeatEvaluation[],
    value: TValue,
  ) => TSequenceEvaluation;
  getMeasureResult: (evaluation: TSequenceEvaluation) => MovementMeasureResult;
  getPrimaryMeasureFeedbackCode: (
    beatEvaluations: TBeatEvaluation[],
    fallbackCode?: TFeedback,
  ) => TFeedback | undefined;
  isMeasureSuccessfulForStreak?: (
    result: MovementMeasureResult,
    evaluation: TSequenceEvaluation,
  ) => boolean;
  onPreparationFrame?: (landmarks: PoseLandmarkLike[] | null) => void;
  onBeforeAttemptReset?: () => void;
  onBeatFinalized?: (evaluation: TBeatEvaluation, measureIndex: number) => void;
  adaptFinalSequenceEvaluation?: (params: {
    evaluation: TSequenceEvaluation;
    reachedRequiredStreak: boolean;
  }) => TSequenceEvaluation;
};

export const useBeatWindowMovementRecognition = <
  TBeat extends number,
  TValue extends string,
  TMetrics,
  TFeedback extends string,
  TBeatEvaluation extends MovementBeatEvaluationLike<
    TBeat,
    TMetrics,
    TFeedback
  >,
  TSequenceEvaluation extends SequenceEvaluationLike<
    TBeatEvaluation,
    TFeedback
  >,
>(
  options: UseBeatWindowMovementRecognitionOptions<
    TBeat,
    TValue,
    TMetrics,
    TFeedback,
    TBeatEvaluation,
    TSequenceEvaluation
  >,
) => {
  const phase = ref<MovementRecognitionPhase>("idle");
  const currentBeat = ref<TBeat>(options.beats[0]);
  const currentRepetitionIndex = ref<number | null>(null);
  const currentEvaluation = ref<TBeatEvaluation | null>(null);
  const currentMeasureEvaluation = ref<MovementMeasureEvaluation<
    TBeatEvaluation,
    TFeedback
  > | null>(null);
  const sequenceEvaluation = ref<TSequenceEvaluation | null>(null);
  const feedbackCode = ref<TFeedback | null>(null);
  const retryRequired = ref(false);
  const currentValue = ref<TValue>(options.defaultValue);
  const consecutiveSuccessfulMeasures = ref(0);
  const hasReachedRequiredStreak = ref(false);
  const trackingActive = ref(false);
  const latestMetrics = ref<TMetrics>(options.createEmptyMetrics());
  const finalizedBeatEvaluations = ref<TBeatEvaluation[]>([]);
  const measureEvaluations = ref<
    MovementMeasureEvaluation<TBeatEvaluation, TFeedback>[]
  >([]);
  const activeMeasuresPerValue = ref(options.measuresPerValue);
  const activeRequiredSuccessfulMeasures = ref(
    options.requiredSuccessfulMeasures ?? 2,
  );

  const beatSamples = new Map<string, BeatSample<TBeatEvaluation>>();
  const measureBeatEvaluations = new Map<number, TBeatEvaluation[]>();
  const finalizedBeatKeys = new Set<string>();

  const getBeatKey = (measureIndex: number, beat: TBeat) =>
    `${measureIndex}-${beat}`;

  const resetAttemptState = () => {
    options.onBeforeAttemptReset?.();
    beatSamples.clear();
    measureBeatEvaluations.clear();
    finalizedBeatKeys.clear();
    finalizedBeatEvaluations.value = [];
    measureEvaluations.value = [];
    sequenceEvaluation.value = null;
    feedbackCode.value = null;
    retryRequired.value = false;
    currentEvaluation.value = null;
    currentMeasureEvaluation.value = null;
    currentBeat.value = options.beats[0];
    currentRepetitionIndex.value = null;
    consecutiveSuccessfulMeasures.value = 0;
    hasReachedRequiredStreak.value = false;
  };

  const reset = () => {
    phase.value = "idle";
    currentValue.value = options.defaultValue;
    activeMeasuresPerValue.value = options.measuresPerValue;
    activeRequiredSuccessfulMeasures.value =
      options.requiredSuccessfulMeasures ?? 2;
    trackingActive.value = false;
    latestMetrics.value = options.createEmptyMetrics();
    resetAttemptState();
  };

  const start = ({
    value = options.defaultValue,
    rules,
  }: {
    value?: TValue;
    rules?: BeatWindowAttemptRules;
  } = {}) => {
    currentValue.value = value;
    activeMeasuresPerValue.value =
      rules?.measuresPerValue ?? options.measuresPerValue;
    activeRequiredSuccessfulMeasures.value =
      rules?.requiredSuccessfulMeasures ??
      options.requiredSuccessfulMeasures ??
      2;
    resetAttemptState();
    phase.value = "preparing";
    trackingActive.value = true;
  };

  const finalizeSequence = () => {
    if (sequenceEvaluation.value || !finalizedBeatEvaluations.value.length) {
      return;
    }

    phase.value = "evaluating";

    const evaluation = options.evaluateSequence(
      finalizedBeatEvaluations.value,
      currentValue.value,
    );
    const nextEvaluation = options.adaptFinalSequenceEvaluation
      ? options.adaptFinalSequenceEvaluation({
          evaluation,
          reachedRequiredStreak: hasReachedRequiredStreak.value,
        })
      : evaluation;

    sequenceEvaluation.value = nextEvaluation;
    feedbackCode.value = nextEvaluation.feedbackCode ?? null;
    retryRequired.value = !nextEvaluation.passed;
    phase.value = retryRequired.value ? "retrying" : "completed";
  };

  const finalizeMeasure = (measureIndex: number) => {
    if (
      measureEvaluations.value.some(
        (evaluation) => evaluation.measureIndex === measureIndex,
      )
    ) {
      return;
    }

    const beatEvaluations = [
      ...(measureBeatEvaluations.get(measureIndex) ?? []),
    ]
      .sort((a, b) => a.beat - b.beat)
      .slice(0, options.beats.length);

    if (beatEvaluations.length < options.beats.length) return;

    const evaluation = options.evaluateSequence(
      beatEvaluations,
      currentValue.value,
    );
    const result = options.getMeasureResult(evaluation);
    const measureEvaluation: MovementMeasureEvaluation<
      TBeatEvaluation,
      TFeedback
    > = {
      measureIndex,
      cycleIndex: measureIndex,
      result,
      score: evaluation.totalScore,
      beatEvaluations,
      primaryFeedbackCode:
        result === "success"
          ? evaluation.feedbackCode
          : options.getPrimaryMeasureFeedbackCode(
              beatEvaluations,
              evaluation.feedbackCode,
            ),
    };

    measureEvaluations.value = [
      ...measureEvaluations.value,
      measureEvaluation,
    ].sort((a, b) => a.measureIndex - b.measureIndex);
    currentMeasureEvaluation.value = measureEvaluation;
    feedbackCode.value = measureEvaluation.primaryFeedbackCode ?? null;

    const countsForSuccessfulAttempt =
      options.isMeasureSuccessfulForStreak?.(result, evaluation) ??
      result === "success";

    if (countsForSuccessfulAttempt) {
      consecutiveSuccessfulMeasures.value++;
    }

    if (
      consecutiveSuccessfulMeasures.value >=
      activeRequiredSuccessfulMeasures.value
    ) {
      hasReachedRequiredStreak.value = true;
    }

    if (measureEvaluations.value.length >= activeMeasuresPerValue.value) {
      finalizeSequence();
    }
  };

  const finalizeBeat = (key: string) => {
    if (finalizedBeatKeys.has(key)) return;

    finalizedBeatKeys.add(key);

    const sample = beatSamples.get(key);
    const [measureIndexText, beatText] = key.split("-");
    const measureIndex = Number(measureIndexText);
    const beat = Number(beatText) as TBeat;
    const evaluation =
      sample?.evaluation ??
      options.evaluateBeat({
        landmarks: null,
        beat,
        timestamp: performance.now(),
        measureIndex,
        value: currentValue.value,
      });

    currentEvaluation.value = evaluation;
    latestMetrics.value = evaluation.metrics;
    finalizedBeatEvaluations.value = [
      ...finalizedBeatEvaluations.value,
      evaluation,
    ];
    options.onBeatFinalized?.(evaluation, measureIndex);

    measureBeatEvaluations.set(measureIndex, [
      ...(measureBeatEvaluations.get(measureIndex) ?? []),
      evaluation,
    ]);

    if (beat === options.beats[options.beats.length - 1]) {
      finalizeMeasure(measureIndex);
    }
  };

  const collectBeatSample = ({
    landmarks,
    measureIndex,
    beat,
    barElapsedMs,
    timestamp,
  }: {
    landmarks: PoseLandmarkLike[] | null;
    measureIndex: number;
    beat: TBeat;
    barElapsedMs: number;
    timestamp: number;
  }) => {
    const targetMs = options.beatTargetsMs[beat];
    const distanceFromBeatMs = Math.abs(barElapsedMs - targetMs);

    if (distanceFromBeatMs > options.evaluationWindowMs) return;

    const key = getBeatKey(measureIndex, beat);

    if (finalizedBeatKeys.has(key)) return;

    const evaluation = options.evaluateBeat({
      landmarks,
      beat,
      timestamp,
      measureIndex,
      value: currentValue.value,
    });
    const previousSample = beatSamples.get(key);

    if (
      !previousSample ||
      evaluation.score > previousSample.evaluation.score ||
      (evaluation.score === previousSample.evaluation.score &&
        distanceFromBeatMs < previousSample.distanceFromBeatMs)
    ) {
      beatSamples.set(key, {
        evaluation,
        distanceFromBeatMs,
      });
    }

    latestMetrics.value = evaluation.metrics;
  };

  const finalizeExpiredBeatWindows = ({
    measureIndex,
    barElapsedMs,
  }: {
    measureIndex: number;
    barElapsedMs: number;
  }) => {
    options.beats.forEach((beat) => {
      if (
        barElapsedMs <=
        options.beatTargetsMs[beat] + options.evaluationWindowMs
      ) {
        return;
      }

      finalizeBeat(getBeatKey(measureIndex, beat));
    });
  };

  const updateFrame = ({
    landmarks,
    playbackState,
    seasonId,
    seasonElapsedMs,
    repetitionIndex,
    isTransition,
    evaluationEnabled = true,
    timestamp = performance.now(),
  }: FrameUpdate) => {
    if (seasonId !== options.seasonId) {
      if (phase.value !== "idle" && phase.value !== "completed") {
        phase.value = "completed";
      }

      return;
    }

    trackingActive.value = Boolean(landmarks?.length);

    if (phase.value === "idle") {
      phase.value = playbackState === "countdown" ? "preparing" : "performing";
    }

    if (playbackState === "countdown" || playbackState === "idle") {
      phase.value = "preparing";
      options.onPreparationFrame?.(landmarks);
      return;
    }

    if (playbackState !== "playing") return;

    if (isTransition || repetitionIndex === null) {
      finalizeSequence();
      return;
    }

    phase.value = "performing";
    currentRepetitionIndex.value = repetitionIndex;

    const barElapsedMs = seasonElapsedMs % options.variationDurationMs;
    const beatIndex = Math.min(
      Math.floor(barElapsedMs / 1000),
      options.beats.length - 1,
    );
    const beat = options.beats[beatIndex];

    currentBeat.value = beat;

    if (!evaluationEnabled) {
      phase.value = "preparing";
      options.onPreparationFrame?.(landmarks);
      return;
    }

    collectBeatSample({
      landmarks,
      measureIndex: repetitionIndex,
      beat,
      barElapsedMs,
      timestamp,
    });
    finalizeExpiredBeatWindows({
      measureIndex: repetitionIndex,
      barElapsedMs,
    });

    if (
      finalizedBeatEvaluations.value.length >=
      activeMeasuresPerValue.value * options.beats.length
    ) {
      finalizeSequence();
    }
  };

  const setLatestMetrics = (metrics: TMetrics) => {
    latestMetrics.value = metrics;
  };

  const debugSnapshot = computed(() => {
    const evaluation = currentEvaluation.value;
    const criteria = evaluation?.criteria ?? [];

    return {
      phase: phase.value,
      currentValue: currentValue.value,
      currentBeat: currentBeat.value,
      currentRepetitionIndex: currentRepetitionIndex.value,
      trackingActive: trackingActive.value,
      essentialPassed: criteria.filter(
        (item) => item.importance === "essential" && item.passed,
      ),
      essentialFailed: criteria.filter(
        (item) => item.importance === "essential" && !item.passed,
      ),
      supportingPassed: criteria.filter(
        (item) => item.importance === "supporting" && item.passed,
      ),
      beatScore: evaluation?.score ?? 0,
      totalScore: sequenceEvaluation.value?.totalScore ?? 0,
      measureResults: measureEvaluations.value,
      currentMeasureResult: currentMeasureEvaluation.value,
      consecutiveSuccessfulMeasures: consecutiveSuccessfulMeasures.value,
      hasReachedRequiredStreak: hasReachedRequiredStreak.value,
      feedbackCode: feedbackCode.value,
      retryRequired: retryRequired.value,
      metrics: latestMetrics.value,
    };
  });

  return {
    phase,
    currentBeat,
    currentRepetitionIndex,
    currentEvaluation,
    currentMeasureEvaluation,
    sequenceEvaluation,
    feedbackCode,
    retryRequired,
    currentValue,
    consecutiveSuccessfulMeasures,
    hasReachedRequiredStreak,
    trackingActive,
    latestMetrics,
    finalizedBeatEvaluations,
    measureEvaluations,
    debugSnapshot,
    reset,
    start,
    setLatestMetrics,
    updateFrame,
  };
};
