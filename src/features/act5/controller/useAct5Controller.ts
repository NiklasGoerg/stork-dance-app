import { computed, watch, type ComputedRef } from "vue";
import { useAct5Store } from "~/store/act5Store";
import { useClimateSeasonData } from "~/composables/useClimateSeasonData";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import { act5IntroCycleConfig } from "~/story/act5IntroCycle";
import {
  buildAct5ClimateStorySequence,
  buildAct5DebugSeasonValueSequence,
  buildAct5DebugSingleSeasonSequence,
  buildAct5FullSequence,
  buildAct5TutorialDebugSequence,
} from "~/features/act5/domain/sequence";
import { getAct5EvaluationTransition } from "~/features/act5/domain/transitions";
import type {
  Act5FlowId,
  Act5RecognitionSequenceEvaluation,
  Act5SequenceTarget,
} from "~/features/act5/types/act5";
import type {
  Act5RecognitionAdapter,
  Act5RecognitionFrame,
} from "~/features/act5/recognition/useAct5RecognitionAdapter";
import type { PoseLandmarkLike } from "~/types/pose";
import type { ClimateSeason } from "~/utils/movement/acts/climate/climateSeasonData";
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
    beforeRestart?: () => void,
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

type Act5ControllerOptions = {
  cycle: Act5CycleService;
  recognition: Act5RecognitionAdapter;
  actId: StoryActId;
  debugEnabled: ComputedRef<boolean>;
  getRetryFeedbackText?: (target: Act5SequenceTarget) => string;
  onClimateDataError?: (message: string) => void;
};

const getSeasonConfig = (
  seasonId: ClimateSeason,
): SeasonalCycleSeasonConfig => {
  const season = act5IntroCycleConfig.seasons.find(
    (item) => item.id === seasonId,
  );

  if (!season) {
    throw new Error(`Unknown Act 5 season "${seasonId}".`);
  }

  return season;
};

export const buildAct5TargetsCycleConfig = (
  targets: Act5SequenceTarget[],
): SeasonalCycleConfig => ({
  ...act5IntroCycleConfig,
  seasons: targets.map((target) => getSeasonConfig(target.season)),
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
}: Act5ControllerOptions) => {
  const store = useAct5Store();
  const climateData = useClimateSeasonData();
  const storyEngine = useStoryEngine();
  const runtimeStore = useStoryRuntimeStore();

  let runId = 0;
  let disposed = false;
  let lastPoseLandmarks: PoseLandmarkLike[] | null = null;

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
    recognition.startTarget(target, options);
  };

  const startTargets = async (
    flowId: Act5FlowId,
    targets: Act5SequenceTarget[],
  ) => {
    const currentRunId = nextRunId();

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
    store.pause();
    cycle.pause();
  };

  const resume = async () => {
    store.resume();
    await cycle.play();
  };

  const complete = async () => {
    store.completeFlow();
    await cycle.complete();

    if (store.flowId === "act5Full" || store.flowId === "act5Story") {
      runtimeStore.completeAct();
    }
  };

  const scheduleRetry = (target: Act5SequenceTarget, currentRunId: number) => {
    const retryText = getRetryFeedbackText?.(target) ?? "";

    store.setSequenceStatus("retryInterlude");
    cycle.queueSeasonIndexRestart(store.currentTargetIndex, false, () => {
      if (!isCurrentRun(currentRunId)) return;

      store.setRetryPreviewFeedbackText(retryText);
      startTarget(store.currentTargetIndex, {
        keepCalibration: true,
      });
    });
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

    const transition = getAct5EvaluationTransition({
      targets: store.targets,
      currentTargetIndex: store.currentTargetIndex,
      passed: evaluation.passed,
    });

    if (transition.type === "retry") {
      scheduleRetry(target, currentRunId);
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
    lastPoseLandmarks = null;
    store.resetFlowState();
    recognition.resetAll();
    await cycle.reset();
  };

  const dispose = () => {
    disposed = true;
    nextRunId();
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
