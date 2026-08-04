import { computed, watch, type ComputedRef } from "vue";
import { useNarration } from "~/composables/narration/useNarration";
import { useAct5Store } from "~/store/act5";
import { useClimateSeasonData } from "~/composables/useClimateSeasonData";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import {
  act5IntroCycleConfig,
  resolveAct5SeasonMovementConfig,
} from "~/story/act5IntroCycle";
import {
  buildAct5ClimateStorySequence,
  buildAct5DebugSeasonValueSequence,
  buildAct5DebugSingleSeasonSequence,
  buildAct5FullSequence,
  buildAct5TutorialDebugSequence,
} from "~/utils/act5/sequence";
import { getAct5EvaluationTransition } from "~/utils/act5/transitions";
import type {
  Act5FlowId,
  Act5RecognitionFrame,
  Act5RecognitionSequenceEvaluation,
  Act5SequenceTarget,
} from "~/types/act5";
import {
  resolveAct5FeedbackNarrationCue,
  type Act5FeedbackCode,
} from "~/utils/act5/feedback/catalog";
import type { Act5Recognition } from "~/composables/act5/useAct5Recognition";
import type {
  NarrationResult,
  NarrationSpeakBehavior,
} from "~/types/narration";
import type { PoseLandmarkLike } from "~/types/pose";
import type { ClimateSeason } from "~/types/climate";
import type { StoryActId } from "~/story/types";
import type {
  SeasonalCycleConfig,
  SeasonalCyclePlaybackState,
  SeasonalCycleSeasonConfig,
} from "~/utils/seasonalCycle";

type Act5CycleService = {
  currentSeason: { readonly value: SeasonalCycleSeasonConfig };
  currentSeasonIndex: { readonly value: number };
  playbackState: { readonly value: SeasonalCyclePlaybackState };
  seasonElapsedMs: { readonly value: number };
  repetitionIndex: { readonly value: number | null };
  isTransition: { readonly value: boolean };
  evaluationEnabled: { readonly value: boolean };
  initialize: () => Promise<void>;
  reset: () => Promise<void>;
  complete: () => Promise<void>;
  pause: () => void;
  play: () => Promise<void>;
  cleanup: () => void;
  startCustomCycle: (
    config: SeasonalCycleConfig,
    withCountdown?: boolean,
  ) => Promise<void>;
  queueSeasonIndexRestart: (
    seasonIndex: number,
    withCountdown?: boolean,
    beforeRestart?: () => void | Promise<void>,
    options?: {
      interludeDurationMs?: number;
      onInterludeStart?: () => void;
      restartSeasonIndex?: number;
    },
  ) => void;
  queueSeasonIndexEndAction: (
    seasonIndex: number,
    onSeasonEnd: () => void,
  ) => void;
};

type Act5NarrationService = {
  play: (
    cueKey: string,
    options?: {
      behavior?: NarrationSpeakBehavior;
    },
  ) => Promise<NarrationResult>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isSpeaking: { readonly value: boolean };
  isPaused: { readonly value: boolean };
};

type Act5ControllerOptions = {
  cycle: Act5CycleService;
  recognition: Act5Recognition;
  actId: StoryActId;
  debugEnabled: ComputedRef<boolean>;
  getRetryFeedbackText?: (
    target: Act5SequenceTarget,
    feedbackCode?: string | null,
  ) => string;
  onClimateDataError?: (message: string) => void;
  narration?: Act5NarrationService;
};

const getSeasonConfig = (
  seasonId: ClimateSeason,
  movementValue: number,
): SeasonalCycleSeasonConfig => {
  const season = resolveAct5SeasonMovementConfig(seasonId, movementValue);

  if (!season) {
    throw new Error(
      `Unknown Act 5 movement "${seasonId}-${movementValue}-percent".`,
    );
  }

  return season;
};

export const buildAct5TargetsCycleConfig = (
  targets: Act5SequenceTarget[],
): SeasonalCycleConfig => ({
  ...act5IntroCycleConfig,
  seasons: targets.map((target) =>
    getSeasonConfig(target.season, target.movementValue),
  ),
  seasonDurationMs:
    act5IntroCycleConfig.repetitionCount * act5IntroCycleConfig.barDurationMs,
  repetitionCount: act5IntroCycleConfig.repetitionCount,
  countdownDurationMs: act5IntroCycleConfig.countdownDurationMs,
  seasonalAudioEnabled: true,
});

export const useAct5Controller = ({
  cycle,
  recognition,
  actId,
  debugEnabled,
  getRetryFeedbackText,
  onClimateDataError,
  narration: providedNarration,
}: Act5ControllerOptions) => {
  const store = useAct5Store();
  const climateData = useClimateSeasonData();
  const storyEngine = useStoryEngine();
  const runtimeStore = useStoryRuntimeStore();
  const narration = providedNarration ?? useNarration();

  let runId = 0;
  let disposed = false;
  let lastPoseLandmarks: PoseLandmarkLike[] | null = null;
  let activeNarrationPromise: Promise<NarrationResult> | null = null;
  let narrationPausedByAct5 = false;
  const handledNarrationEventIds = new Set<string>();

  const activeTarget = computed(() => store.currentTarget);
  const isRecognitionSuppressed = computed(
    () =>
      store.sequenceStatus === "periodTransition" ||
      store.sequenceStatus === "retryInterlude" ||
      store.isCompleted,
  );

  const nextRunId = () => {
    runId += 1;
    return runId;
  };

  const isCurrentRun = (candidateRunId: number) =>
    !disposed && candidateRunId === runId;

  const stopNarration = () => {
    activeNarrationPromise = null;
    narrationPausedByAct5 = false;
    handledNarrationEventIds.clear();
    narration.stop();
  };

  const initialize = async () => {
    const currentRunId = nextRunId();

    store.setLifecycleStatus("initializing");
    store.setDebugEnabled(debugEnabled.value);
    storyEngine.startAct(actId);
    const loadedDataset = await climateData.loadClimateSeasonData();

    if (!isCurrentRun(currentRunId)) return;

    if (!loadedDataset || climateData.validationErrors.value.length > 0) {
      const message = "Climate data could not be loaded.";

      store.setError(message);
      onClimateDataError?.(message);
    } else {
      onClimateDataError?.("");
      store.setLifecycleStatus("idle");
    }

    await cycle.initialize();
  };

  const ensureClimateDataReady = async () => {
    const loadedDataset = await climateData.loadClimateSeasonData();
    const hasValidationErrors = climateData.validationErrors.value.length > 0;

    if (!loadedDataset || hasValidationErrors) {
      const message = "Climate data could not be loaded.";

      store.setError(message);
      onClimateDataError?.(message);
      return null;
    }

    onClimateDataError?.("");
    return loadedDataset;
  };

  const startTarget = (
    targetIndex: number,
    options: { keepCalibration?: boolean; manual?: boolean } = {},
  ) => {
    const target = store.targets[targetIndex] ?? null;

    if (!target) {
      void complete();
      return;
    }

    store.startTarget(targetIndex);
    activeNarrationPromise = null;
    narrationPausedByAct5 = false;
    handledNarrationEventIds.clear();
    recognition.startTarget(target, options);
  };

  const startTargets = async (
    flowId: Act5FlowId,
    targets: Act5SequenceTarget[],
  ) => {
    const currentRunId = nextRunId();

    stopNarration();
    storyEngine.startAct(actId);
    recognition.resetAll();
    await cycle.reset();

    if (!isCurrentRun(currentRunId)) return;

    if (!targets.length) {
      await complete();
      return;
    }

    store.startFlow(flowId, targets);
    startTarget(0, {
      keepCalibration: false,
      manual: true,
    });
    await cycle.startCustomCycle(buildAct5TargetsCycleConfig(targets), true);
  };

  const startFullFlow = async () => {
    const dataset = await ensureClimateDataReady();

    if (!dataset) return;

    await startTargets("act5Full", buildAct5FullSequence(dataset));
  };

  const startStoryFlow = async () => {
    const dataset = await ensureClimateDataReady();

    if (!dataset) return;

    await startTargets("act5Story", buildAct5ClimateStorySequence(dataset));
  };

  const startTutorialFlow = async () => {
    await startTargets("act5TutorialDebug", buildAct5TutorialDebugSequence());
  };

  const startDebugSeason = async (season: ClimateSeason) => {
    await startTargets(
      "act5TutorialDebug",
      buildAct5DebugSingleSeasonSequence(season),
    );
  };

  const startDebugSeasonSequence = async (season: ClimateSeason) => {
    await startTargets(
      "act5TutorialDebug",
      buildAct5DebugSeasonValueSequence(season),
    );
  };

  const pause = () => {
    narrationPausedByAct5 =
      narration.isSpeaking.value && !narration.isPaused.value;
    if (narrationPausedByAct5) {
      narration.pause();
    }

    store.pause();
    cycle.pause();
  };

  const resume = async () => {
    store.resume();
    if (narrationPausedByAct5) {
      narration.resume();
      narrationPausedByAct5 = false;
    }

    await cycle.play();
  };

  const complete = async () => {
    stopNarration();
    store.completeFlow();
    await cycle.complete();

    if (store.flowId === "act5Full" || store.flowId === "act5Story") {
      runtimeStore.completeAct();
    }
  };

  const createNarrationEventId = (
    target: Act5SequenceTarget,
    feedbackCode: string,
  ) =>
    [
      store.flowId ?? "act5",
      target.id,
      store.attempt.attemptNumber,
      feedbackCode,
    ].join(":");

  const playRetryNarration = (
    target: Act5SequenceTarget,
    feedbackCode: string | null | undefined,
    currentRunId: number,
  ) => {
    const cueKey = resolveAct5FeedbackNarrationCue(
      target.season,
      feedbackCode as Act5FeedbackCode | null | undefined,
    );

    if (!cueKey || !feedbackCode) {
      activeNarrationPromise = null;

      return Promise.resolve({ status: "skipped" } satisfies NarrationResult);
    }

    const narrationEventId = createNarrationEventId(target, feedbackCode);

    if (handledNarrationEventIds.has(narrationEventId)) {
      return Promise.resolve({ status: "skipped" } satisfies NarrationResult);
    }

    handledNarrationEventIds.add(narrationEventId);

    const promise = narration
      .play(cueKey, { behavior: "replace" })
      .catch(
        (error: unknown) =>
          ({ status: "error", error }) satisfies NarrationResult,
      )
      .finally(() => {
        if (isCurrentRun(currentRunId) && activeNarrationPromise === promise) {
          activeNarrationPromise = null;
        }
      });

    activeNarrationPromise = promise;

    return promise;
  };

  const scheduleRetry = (
    target: Act5SequenceTarget,
    evaluation: Act5RecognitionSequenceEvaluation,
    currentRunId: number,
  ) => {
    const feedbackCode = evaluation.feedbackCode ?? null;
    const retryText = getRetryFeedbackText?.(target, feedbackCode) ?? "";
    const retryInterludeDurationMs =
      target.rules.feedbackInterludeBeats *
      (act5IntroCycleConfig.barDurationMs / 4);

    store.setSequenceStatus("retryInterlude");
    cycle.queueSeasonIndexRestart(
      store.currentTargetIndex,
      false,
      async () => {
        if (!isCurrentRun(currentRunId)) return;

        if (activeNarrationPromise) {
          await activeNarrationPromise;
        }

        if (!isCurrentRun(currentRunId)) return;

        startTarget(store.currentTargetIndex, {
          keepCalibration: true,
        });
      },
      {
        interludeDurationMs: retryInterludeDurationMs,
        onInterludeStart: () => {
          if (!isCurrentRun(currentRunId)) return;

          store.setRetryPreviewFeedbackText(retryText);
          activeNarrationPromise = playRetryNarration(
            target,
            feedbackCode,
            currentRunId,
          );
        },
      },
    );
  };

  const scheduleAdvance = (nextTargetIndex: number, currentRunId: number) => {
    if (!isCurrentRun(currentRunId)) return;

    store.setRetryPreviewFeedbackText("");
    if (cycle.currentSeasonIndex.value === nextTargetIndex) {
      startTarget(nextTargetIndex, { keepCalibration: true });
    }
  };

  const schedulePeriodTransition = ({
    currentTargetIndex,
    nextTargetIndex,
    evaluationRunId,
  }: {
    currentTargetIndex: number;
    nextTargetIndex: number;
    evaluationRunId: number;
  }) => {
    const transition = getAct5EvaluationTransition({
      targets: store.targets,
      currentTargetIndex,
      passed: true,
    });

    if (transition.type !== "periodTransition") return;

    cycle.queueSeasonIndexRestart(
      currentTargetIndex,
      false,
      () => {
        if (!isCurrentRun(evaluationRunId)) return;

        startTarget(nextTargetIndex, {
          keepCalibration: true,
        });
      },
      {
        interludeDurationMs: act5IntroCycleConfig.barDurationMs,
        restartSeasonIndex: nextTargetIndex,
        onInterludeStart: () => {
          if (!isCurrentRun(evaluationRunId)) return;

          store.enterPeriodTransition(transition.transition);
          store.setRetryPreviewFeedbackText("");
          store.clearFeedback();
        },
      },
    );
  };

  const handleRecognitionResult = (
    target: Act5SequenceTarget,
    evaluation: Act5RecognitionSequenceEvaluation,
  ) => {
    if (!store.isFlowActive || store.sequenceStatus !== "performing") return;
    if (store.currentTarget?.id !== target.id) return;

    const handledKey = [
      target.id,
      store.attempt.attemptNumber,
      evaluation.resultState,
      evaluation.totalScore.toFixed(1),
    ].join("-");

    if (store.attempt.handledEvaluationKey === handledKey) return;

    const currentRunId = runId;

    store.setHandledEvaluationKey(handledKey);
    store.setFeedbackDiagnostics({
      feedbackSelection: evaluation.selectedFeedback ?? null,
      feedbackSignals: evaluation.selectedFeedback
        ? recognition.finalizedBeatEvaluations.value.flatMap(
            (item) => item.feedbackSignals ?? [],
          )
        : [],
    });

    const transition = getAct5EvaluationTransition({
      targets: store.targets,
      currentTargetIndex: store.currentTargetIndex,
      passed: evaluation.passed,
    });

    if (transition.type === "retry") {
      scheduleRetry(target, evaluation, currentRunId);
      return;
    }

    store.markCurrentTargetCompleted();

    if (transition.type === "complete") {
      cycle.queueSeasonIndexEndAction(store.currentTargetIndex, () => {
        if (!isCurrentRun(currentRunId)) return;
        void complete();
      });
      return;
    }

    if (transition.type === "periodTransition") {
      schedulePeriodTransition({
        currentTargetIndex: transition.currentTargetIndex,
        nextTargetIndex: transition.nextTargetIndex,
        evaluationRunId: currentRunId,
      });
      return;
    }

    scheduleAdvance(transition.nextTargetIndex, currentRunId);
  };

  const handlePoseFrame = (landmarks: PoseLandmarkLike[] | null) => {
    lastPoseLandmarks = landmarks;
    recognition.updateFrame(getRecognitionFrame());
  };

  const getRecognitionFrame = (): Act5RecognitionFrame => ({
    landmarks: lastPoseLandmarks,
    playbackState: cycle.playbackState.value,
    seasonId: cycle.currentSeason.value.id,
    seasonElapsedMs: cycle.seasonElapsedMs.value,
    repetitionIndex: cycle.repetitionIndex.value,
    isTransition: cycle.isTransition.value,
    evaluationEnabled: cycle.evaluationEnabled.value,
    autoProgressEnabled: store.debug.autoProgressEnabled,
  });

  const toggleDebug = () => {
    store.setDebugEnabled(!store.debug.enabled);
  };

  const toggleAutoProgress = () => {
    store.setAutoProgressEnabled(!store.debug.autoProgressEnabled);
    recognition.updateFrame(getRecognitionFrame());
  };

  const reset = async () => {
    nextRunId();
    stopNarration();
    lastPoseLandmarks = null;
    store.resetFlowState();
    recognition.resetAll();
    await cycle.reset();
  };

  const dispose = () => {
    disposed = true;
    nextRunId();
    stopNarration();
    lastPoseLandmarks = null;
    store.resetFlowState();
    recognition.dispose();
    cycle.cleanup();
    storyEngine.stopStoryEngine();
    stopCycleWatchers.forEach((stop) => stop());
  };

  const stopCycleWatchers = [
    watch(
      () => debugEnabled.value,
      (enabled) => store.setDebugEnabled(enabled),
      { immediate: true },
    ),
    watch(
      [
        cycle.playbackState,
        cycle.currentSeason,
        cycle.seasonElapsedMs,
        cycle.repetitionIndex,
        cycle.isTransition,
        cycle.evaluationEnabled,
        () => store.sequenceStatus,
        () => store.debug.autoProgressEnabled,
      ],
      () => recognition.updateFrame(getRecognitionFrame()),
      { immediate: true },
    ),
    watch(
      () => cycle.currentSeasonIndex.value,
      (nextIndex) => {
        if (!store.isFlowActive) return;
        if (store.sequenceStatus !== "performing") return;
        if (nextIndex === store.currentTargetIndex) return;
        if (!store.targets[nextIndex]) return;

        startTarget(nextIndex, {
          keepCalibration: true,
        });
      },
      { flush: "post" },
    ),
    watch(recognition.currentMeasureEvaluation, (evaluation) => {
      const target = store.currentTarget;

      if (!target || !evaluation) {
        store.clearFeedback();
        return;
      }

      store.setMeasureFeedback({
        measureId: `${target.id}-${evaluation.measureIndex}`,
        measureIndex: evaluation.measureIndex,
        result: evaluation.result,
        feedbackCode: evaluation.primaryFeedbackCode ?? null,
        text: evaluation.primaryFeedbackCode ?? evaluation.result,
      });
    }),
  ];

  return {
    store,
    activeTarget,
    isRecognitionSuppressed,
    isCurrentRun,
    initialize,
    startFullFlow,
    startStoryFlow,
    startTutorialFlow,
    startDebugSeason,
    startDebugSeasonSequence,
    toggleDebug,
    toggleAutoProgress,
    handlePoseFrame,
    handleRecognitionResult,
    pause,
    resume,
    reset,
    complete,
    dispose,
  };
};
