import { computed, ref } from "vue";
import type { PoseLandmarkLike } from "~/types/pose";
import type {
  BeatWindowAttemptRules,
  MovementBeatEvaluationLike,
  MovementCriterionLike,
  MovementMeasureEvaluation,
  MovementMeasureResult,
  MovementRecognitionPhase,
  MovementSequenceEvaluationLike,
  UseBeatWindowMovementRecognitionOptions,
} from "~/types/movement";

type FrameUpdate = {
  landmarks: PoseLandmarkLike[] | null;
  playbackState: "idle" | "countdown" | "playing" | "paused" | "completed";
  seasonId: string;
  seasonElapsedMs: number;
  repetitionIndex: number | null;
  isTransition: boolean;
  evaluationEnabled?: boolean;
  autoProgressEnabled?: boolean;
  timestamp?: number;
};

type BeatSample<TBeatEvaluation extends MovementBeatEvaluationLike> = {
  evaluation: TBeatEvaluation;
  distanceFromBeatMs: number;
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
  TSequenceEvaluation extends MovementSequenceEvaluationLike<
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
  const firstBeat = options.beats[0];

  if (firstBeat === undefined) {
    throw new Error("Beat-window recognition needs at least one beat.");
  }

  const phase = ref<MovementRecognitionPhase>("idle");
  const currentBeat = ref<TBeat>(firstBeat);
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
  const autoProgressEnabled = ref(false);

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
    currentBeat.value = firstBeat;
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
      finalizedBeatEvaluations.value as TBeatEvaluation[],
      currentValue.value,
    );
    const nextEvaluation = autoProgressEnabled.value
      ? ({
          ...evaluation,
          passed: true,
          feedbackCode: undefined,
        } as TSequenceEvaluation)
      : options.adaptFinalSequenceEvaluation
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
      .slice(0, options.beats.length) as TBeatEvaluation[];

    if (beatEvaluations.length < options.beats.length) return;

    const evaluation = options.evaluateSequence(
      beatEvaluations,
      currentValue.value,
    );
    const result: MovementMeasureResult = autoProgressEnabled.value
      ? "autoProgress"
      : options.getMeasureResult(evaluation);
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
        result === "autoProgress"
          ? undefined
          : result === "success"
            ? evaluation.feedbackCode
            : options.getPrimaryMeasureFeedbackCode(
                beatEvaluations,
                evaluation.feedbackCode,
              ),
    };

    measureEvaluations.value = (
      [
        ...measureEvaluations.value,
        measureEvaluation,
      ] as MovementMeasureEvaluation<TBeatEvaluation, TFeedback>[]
    ).sort((a, b) => a.measureIndex - b.measureIndex);
    currentMeasureEvaluation.value = measureEvaluation;
    feedbackCode.value = measureEvaluation.primaryFeedbackCode ?? null;

    const countsForSuccessfulAttempt =
      result === "autoProgress" ||
      (options.isMeasureSuccessfulForStreak?.(result, evaluation) ??
        result === "success");

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
    ] as TBeatEvaluation[];
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
    autoProgressEnabled: shouldAutoProgress = false,
    timestamp = performance.now(),
  }: FrameUpdate) => {
    autoProgressEnabled.value = shouldAutoProgress;

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

    if (beat === undefined) return;

    currentBeat.value = beat;

    if (!evaluationEnabled) {
      phase.value = "preparing";
      options.onPreparationFrame?.(landmarks);
      return;
    }

    // Collect for every window that contains this frame. This preserves the
    // best pose shortly before or after a checkpoint instead of limiting all
    // beats to samples taken only after their nominal timestamp.
    options.beats.forEach((sampleBeat) => {
      collectBeatSample({
        landmarks,
        measureIndex: repetitionIndex,
        beat: sampleBeat,
        barElapsedMs,
        timestamp,
      });
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
    const criteria: MovementCriterionLike<TFeedback>[] =
      evaluation?.criteria ?? [];

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
