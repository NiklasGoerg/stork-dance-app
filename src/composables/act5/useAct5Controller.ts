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
import {
  resolveAct5SeasonCompletionNarration,
  resolveAct5TutorialNarration,
  resolveAct5TutorialCompleteNarration,
  type Act5TutorialNarrationCue,
} from "~/utils/act5/tutorialNarration";
import {
  act5StoryNarrationCatalog,
  act5StoryCompletionCueIds,
  resolveAct5StoryPeriodTransitionCue,
  resolveAct5StoryNarrationCue,
  type Act5StoryNarrationCue,
  type Act5StoryNarrationCueId,
} from "~/utils/act5/storyNarration";
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

const ACT5_STORY_TTS_DEBUG_LABEL = "[ACT5-STORY-TTS]";
const ACT5_PERIOD_TRANSITION_BAR_COUNT = 2;

const isAct5StoryTtsDebugEnabled = () => {
  if (typeof window === "undefined") return false;

  return (
    new URLSearchParams(window.location.search).get("act5StoryTtsDebug") ===
      "1" || window.localStorage.getItem("act5StoryTtsDebug") === "1"
  );
};

type Act5CycleService = {
  currentSeason: { readonly value: SeasonalCycleSeasonConfig };
  currentSeasonIndex: { readonly value: number };
  playbackState: { readonly value: SeasonalCyclePlaybackState };
  currentBar?: { readonly value: number | null };
  seasonPhase?: { readonly value: "preview" | "performance" | "transition" };
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
  prepareCustomCycle: (config: SeasonalCycleConfig) => Promise<void>;
  startExplanationPreview: (seasonIndex: number) => Promise<void>;
  waitForExplanationPreviewBars: (bars?: number) => Promise<void>;
  startPreparedCycleFromIndex: (
    seasonIndex: number,
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
      preserveBaseRhythm?: boolean;
      afterRestart?: () => void | Promise<void>;
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
      params?: Record<string, string | number>;
      debugLabel?: string;
      onStart?: (details: { rate: number; voiceName: string | null }) => void;
      onEnd?: (details: {
        status: NarrationResult["status"];
        rate: number;
        voiceName: string | null;
      }) => void;
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
  let activeStoryTargetNarrationEventId: string | null = null;
  const handledNarrationEventIds = new Set<string>();
  const handledTutorialNarrationEventIds = new Set<string>();
  const handledStoryNarrationEventIds = new Set<string>();
  const handledPeriodTransitionNarrationEventIds = new Set<string>();
  const loggedStoryNarrationRejections = new Set<string>();

  const activeTarget = computed(() => store.currentTarget);
  const isRecognitionSuppressed = computed(
    () =>
      store.sequenceStatus === "periodTransition" ||
      store.sequenceStatus === "retryInterlude" ||
      store.sequenceStatus === "tutorialExplanation" ||
      store.sequenceStatus === "tutorialCompleted" ||
      store.sequenceStatus === "storyIntro" ||
      store.sequenceStatus === "storyReferencePreview" ||
      store.sequenceStatus === "storyReferenceComplete" ||
      store.isCompleted,
  );

  const nextRunId = () => {
    runId += 1;
    return runId;
  };

  const isCurrentRun = (candidateRunId: number) =>
    !disposed && candidateRunId === runId;

  const logStoryTts = (
    event: string,
    details: Record<string, unknown> = {},
  ) => {
    if (!isAct5StoryTtsDebugEnabled()) return;

    console.log(`${ACT5_STORY_TTS_DEBUG_LABEL} ${event}`, details);
  };

  const warnStoryTts = (
    event: string,
    details: Record<string, unknown> = {},
  ) => {
    if (!isAct5StoryTtsDebugEnabled()) return;

    console.warn(`${ACT5_STORY_TTS_DEBUG_LABEL} ${event}`, details);
  };

  const stopNarration = () => {
    activeNarrationPromise = null;
    activeStoryTargetNarrationEventId = null;
    narrationPausedByAct5 = false;
    handledNarrationEventIds.clear();
    handledTutorialNarrationEventIds.clear();
    handledStoryNarrationEventIds.clear();
    handledPeriodTransitionNarrationEventIds.clear();
    loggedStoryNarrationRejections.clear();
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

  const createTutorialNarrationEventId = (
    target: Act5SequenceTarget,
    cueId: string,
  ) => [store.flowId ?? "act5", target.id, cueId].join(":");

  const playTutorialCue = (
    target: Act5SequenceTarget,
    targetIndex: number,
    cue: { id: string; textKey: string; speak: boolean },
    params: Record<string, string | number>,
    currentRunId: number,
  ) => {
    if (!cue.speak || !cue.textKey) {
      return Promise.resolve({ status: "skipped" } satisfies NarrationResult);
    }

    const narrationEventId = createTutorialNarrationEventId(target, cue.id);

    if (handledTutorialNarrationEventIds.has(narrationEventId)) {
      return Promise.resolve({ status: "skipped" } satisfies NarrationResult);
    }

    handledTutorialNarrationEventIds.add(narrationEventId);
    store.enterTutorialExplanation({
      targetIndex,
      cueId: cue.id,
      textKey: cue.textKey,
      params,
    });

    const promise = narration
      .play(cue.textKey, {
        behavior: "replace",
        params,
      })
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

  const playTutorialCues = async ({
    target,
    targetIndex,
    cues,
    params,
    currentRunId,
  }: {
    target: Act5SequenceTarget;
    targetIndex: number;
    cues: Array<{ id: string; textKey: string; speak: boolean }>;
    params: Record<string, string | number>;
    currentRunId: number;
  }) => {
    for (const cue of cues) {
      if (!isCurrentRun(currentRunId)) return;

      await playTutorialCue(target, targetIndex, cue, params, currentRunId);
    }
  };

  const createStoryNarrationEventId = ({
    cueId,
    target,
    currentRunId = runId,
  }: {
    cueId: string;
    target?: Act5SequenceTarget | null;
    currentRunId?: number;
  }) =>
    [
      currentRunId,
      store.flowId ?? "act5",
      target?.climateData?.id ?? target?.id ?? "story",
      cueId,
    ].join(":");

  const playStoryCue = (
    cue: Act5StoryNarrationCue,
    {
      target = null,
      targetIndex = null,
      phase,
      status,
      params = {},
      currentRunId,
    }: {
      target?: Act5SequenceTarget | null;
      targetIndex?: number | null;
      phase: "story-intro" | "reference-preview" | "reference-complete";
      status: "storyIntro" | "storyReferencePreview" | "storyReferenceComplete";
      params?: Record<string, string | number>;
      currentRunId: number;
    },
  ) => {
    if (!cue.speak || !cue.textKey) {
      return Promise.resolve({ status: "skipped" } satisfies NarrationResult);
    }

    const narrationEventId = createStoryNarrationEventId({
      cueId: cue.id,
      target,
      currentRunId,
    });

    if (handledStoryNarrationEventIds.has(narrationEventId)) {
      return Promise.resolve({ status: "skipped" } satisfies NarrationResult);
    }

    handledStoryNarrationEventIds.add(narrationEventId);
    store.enterStoryNarration({
      phase,
      status,
      targetIndex,
      cueId: cue.id,
      textKey: cue.textKey,
      params,
    });

    const promise = narration
      .play(cue.textKey, {
        behavior: "replace",
        params,
      })
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

  const playStoryTargetCue = (
    target: Act5SequenceTarget,
    targetIndex: number,
    currentRunId: number,
  ) => {
    logStoryTts("BAR1", {
      source: "target-preview",
      runId: currentRunId,
      targetId: target.id,
      targetIndex,
      period: target.climateData?.interval ?? target.interval ?? null,
      season: target.season,
      currentBar: cycle.currentBar?.value ?? null,
      seasonPhase: getSeasonPhase(),
      playbackState: cycle.playbackState.value,
    });

    const resolution = resolveAct5StoryNarrationCue(target);

    if (!resolution) {
      warnStoryTts("SKIPPED", {
        reason: "noCue",
        targetId: target.id,
        targetIndex,
        context: target.context,
        hasClimateData: Boolean(target.climateData),
      });
      return;
    }

    logStoryTts("RESOLVE", {
      cueId: resolution.cue.id,
      textKey: resolution.cue.textKey,
      speak: resolution.cue.speak,
      display: resolution.cue.display,
      params: resolution.params,
    });

    if (!resolution.cue.speak || !resolution.cue.textKey) {
      warnStoryTts("SKIPPED", {
        reason: !resolution.cue.speak ? "speakDisabled" : "missingTextKey",
        cueId: resolution.cue.id,
        textKey: resolution.cue.textKey,
      });
      return;
    }

    const narrationEventId = createStoryNarrationEventId({
      cueId: resolution.cue.id,
      target,
      currentRunId,
    });

    if (handledStoryNarrationEventIds.has(narrationEventId)) {
      warnStoryTts("SKIPPED", {
        reason: "alreadyHandled",
        narrationEventId,
        cueId: resolution.cue.id,
      });
      return;
    }

    if (
      activeStoryTargetNarrationEventId &&
      activeStoryTargetNarrationEventId !== narrationEventId
    ) {
      logStoryTts("STOP_STALE", {
        previousNarrationEventId: activeStoryTargetNarrationEventId,
        nextNarrationEventId: narrationEventId,
      });
      narration.stop();
      activeNarrationPromise = null;
      activeStoryTargetNarrationEventId = null;
    }

    activeStoryTargetNarrationEventId = narrationEventId;

    if (resolution.cue.display) {
      logStoryTts("DISPLAY", {
        cueId: resolution.cue.id,
        targetIndex,
      });
      store.setTargetStoryNarration({
        targetIndex,
        cueId: resolution.cue.id,
        textKey: resolution.cue.textKey,
        params: resolution.params,
      });
    } else {
      logStoryTts("DISPLAY_SUPPRESSED", {
        reason: "displayFalse",
        cueId: resolution.cue.id,
        targetIndex,
      });
    }

    logStoryTts("PLAY", {
      narrationEventId,
      cueId: resolution.cue.id,
      textKey: resolution.cue.textKey,
      params: resolution.params,
    });

    const promise = narration
      .play(resolution.cue.textKey, {
        behavior: "replace",
        params: resolution.params,
        debugLabel: isAct5StoryTtsDebugEnabled()
          ? ACT5_STORY_TTS_DEBUG_LABEL
          : undefined,
        onStart: ({ rate, voiceName }) => {
          logStoryTts("PLAY_ON_START", {
            narrationEventId,
            cueId: resolution.cue.id,
            rate,
            voiceName,
          });
        },
        onEnd: ({ status, rate, voiceName }) => {
          logStoryTts("PLAY_ON_END", {
            narrationEventId,
            cueId: resolution.cue.id,
            status,
            rate,
            voiceName,
          });
        },
      })
      .then((result) => {
        logStoryTts("RESULT", {
          narrationEventId,
          cueId: resolution.cue.id,
          status: result.status,
        });
        if (
          result.status === "completed" ||
          result.status === "cancelled" ||
          result.status === "disabled" ||
          result.status === "unsupported" ||
          result.status === "skipped"
        ) {
          handledStoryNarrationEventIds.add(narrationEventId);
        }

        return result;
      })
      .catch(
        (error: unknown) => {
          warnStoryTts("RESULT", {
            narrationEventId,
            cueId: resolution.cue.id,
            status: "error",
            error,
          });

          return { status: "error", error } satisfies NarrationResult;
        },
      )
      .finally(() => {
        if (!isCurrentRun(currentRunId)) return;
        if (activeNarrationPromise === promise) {
          activeNarrationPromise = null;
        }
        if (activeStoryTargetNarrationEventId === narrationEventId) {
          activeStoryTargetNarrationEventId = null;
        }
      });

    activeNarrationPromise = promise;
    handledStoryNarrationEventIds.add(narrationEventId);
  };

  const playStoryCueById = (
    cueId: Act5StoryNarrationCueId,
    options: Parameters<typeof playStoryCue>[1],
  ) => playStoryCue(act5StoryNarrationCatalog[cueId], options);

  const isTutorialIntroCue = (cue: Act5TutorialNarrationCue) =>
    cue.id.startsWith("act5.tutorial.intro.");

  const isTutorialEncodingCue = (cue: Act5TutorialNarrationCue) =>
    cue.id.endsWith(".encoding") && !isTutorialIntroCue(cue);

  const startTutorialTargetWithExplanation = async ({
    targetIndex,
    keepCalibration = false,
    manual = false,
    includeGlobalIntro,
    startPlayback = true,
    withCountdown = false,
    currentRunId = runId,
  }: {
    targetIndex: number;
    keepCalibration?: boolean;
    manual?: boolean;
    includeGlobalIntro: boolean;
    startPlayback?: boolean;
    withCountdown?: boolean;
    currentRunId?: number;
  }) => {
    const target = store.targets[targetIndex] ?? null;

    if (!target || target.context !== "tutorial") {
      startTarget(targetIndex, { keepCalibration, manual });
      return;
    }

    const resolution = resolveAct5TutorialNarration({
      target,
      targetIndex,
      flowId: store.flowId,
      includeGlobalIntro,
    });
    const introCues = resolution.cues.filter(isTutorialIntroCue);
    const encodingCues = resolution.cues.filter(isTutorialEncodingCue);
    const targetCues = resolution.cues.filter(
      (cue) => !isTutorialIntroCue(cue) && !isTutorialEncodingCue(cue),
    );
    const firstCue = resolution.cues[0];

    if (!firstCue) {
      startTarget(targetIndex, { keepCalibration, manual });
      if (startPlayback) {
        await cycle.startPreparedCycleFromIndex(targetIndex, withCountdown);
      }
      return;
    }

    await playTutorialCues({
      target,
      targetIndex,
      cues: introCues,
      params: resolution.params,
      currentRunId,
    });

    if (!isCurrentRun(currentRunId)) return;

    if (encodingCues.length || targetCues.length) {
      const firstPreviewCue = encodingCues[0] ?? targetCues[0];

      if (!firstPreviewCue) return;

      store.enterTutorialExplanation({
        targetIndex,
        cueId: firstPreviewCue.id,
        textKey: firstPreviewCue.textKey,
        params: resolution.params,
      });
      await cycle.startExplanationPreview(targetIndex);
    }

    if (!isCurrentRun(currentRunId)) return;

    if (encodingCues.length) {
      await playTutorialCues({
        target,
        targetIndex,
        cues: encodingCues,
        params: resolution.params,
        currentRunId,
      });

      if (!isCurrentRun(currentRunId)) return;

      await cycle.waitForExplanationPreviewBars(1);
    }

    if (!isCurrentRun(currentRunId)) return;

    if (targetCues.length) {
      await playTutorialCues({
        target,
        targetIndex,
        cues: targetCues,
        params: resolution.params,
        currentRunId,
      });

      if (!isCurrentRun(currentRunId)) return;

      await cycle.waitForExplanationPreviewBars(2);
    }

    if (!isCurrentRun(currentRunId)) return;

    startTarget(targetIndex, { keepCalibration, manual });

    if (startPlayback) {
      await cycle.startPreparedCycleFromIndex(targetIndex, withCountdown);
    }
  };

  const isReferenceStoryTarget = (
    target: Act5SequenceTarget | null,
  ): target is Act5SequenceTarget & {
    climateData: NonNullable<Act5SequenceTarget["climateData"]>;
  } =>
    target?.context === "climateStory" &&
    target.climateData?.isBaseline === true;

  const startStoryTarget = async ({
    targetIndex,
    keepCalibration = false,
    manual = false,
    startPlayback = true,
  }: {
    targetIndex: number;
    keepCalibration?: boolean;
    manual?: boolean;
    startPlayback?: boolean;
  }) => {
    startTarget(targetIndex, { keepCalibration, manual });

    if (startPlayback) {
      await cycle.startPreparedCycleFromIndex(targetIndex, false);
      playCurrentTargetStoryNarrationFromBarOne("startStoryTarget");
    }
  };

  const playClimateStoryIntro = async ({
    targetIndex,
    currentRunId,
  }: {
    targetIndex: number;
    currentRunId: number;
  }) => {
    await cycle.startExplanationPreview(targetIndex);

    if (!isCurrentRun(currentRunId)) return;

    await playStoryCueById("act5.story.intro.chart", {
      target: store.targets[targetIndex] ?? null,
      targetIndex,
      phase: "story-intro",
      status: "storyIntro",
      currentRunId,
    });

    if (!isCurrentRun(currentRunId)) return;

    await playStoryCueById("act5.story.intro.reference", {
      target: store.targets[targetIndex] ?? null,
      targetIndex,
      phase: "story-intro",
      status: "storyIntro",
      currentRunId,
    });

    if (!isCurrentRun(currentRunId)) return;

    await cycle.waitForExplanationPreviewBars(1);
  };

  const startClimateStoryIntro = async ({
    targetIndex,
    keepCalibration = false,
    manual = false,
    startPlayback = true,
    currentRunId = runId,
  }: {
    targetIndex: number;
    keepCalibration?: boolean;
    manual?: boolean;
    startPlayback?: boolean;
    currentRunId?: number;
  }) => {
    await playClimateStoryIntro({ targetIndex, currentRunId });

    if (!isCurrentRun(currentRunId)) return;

    await startStoryTarget({
      targetIndex,
      keepCalibration,
      manual,
      startPlayback,
    });
  };

  const playReferenceCompleteInterlude = async ({
    targetIndex,
    currentRunId,
  }: {
    targetIndex: number;
    currentRunId: number;
  }) => {
    await cycle.startExplanationPreview(targetIndex);

    if (!isCurrentRun(currentRunId)) return;

    await playStoryCueById("act5.story.reference.complete", {
      target: store.targets[targetIndex] ?? null,
      targetIndex,
      phase: "reference-complete",
      status: "storyReferenceComplete",
      currentRunId,
    });

    if (!isCurrentRun(currentRunId)) return;

    await playStoryCueById("act5.story.reference.scale", {
      target: store.targets[targetIndex] ?? null,
      targetIndex,
      phase: "reference-complete",
      status: "storyReferenceComplete",
      currentRunId,
    });

    if (!isCurrentRun(currentRunId)) return;

    await cycle.waitForExplanationPreviewBars(1);
  };

  const playPeriodTransitionNarration = ({
    completedPeriod,
    currentRunId,
  }: {
    completedPeriod: string;
    currentRunId: number;
  }) => {
    const cue = resolveAct5StoryPeriodTransitionCue(completedPeriod);

    if (!cue?.speak || !cue.textKey) return;

    const narrationEventId = [
      currentRunId,
      store.flowId ?? "act5",
      completedPeriod,
      cue.id,
    ].join(":");

    if (handledPeriodTransitionNarrationEventIds.has(narrationEventId)) return;

    handledPeriodTransitionNarrationEventIds.add(narrationEventId);
    void narration.play(cue.textKey, { behavior: "replace" });
  };

  const playClimateCompletionNarration = async (currentRunId: number) => {
    for (const cueId of act5StoryCompletionCueIds) {
      if (!isCurrentRun(currentRunId)) return;

      const cue = act5StoryNarrationCatalog[cueId];

      if (!cue.speak || !cue.textKey) continue;

      await narration.play(cue.textKey, { behavior: "replace" });
    }
  };

  const runClimateCompletionOutro = async (currentRunId: number) => {
    await playClimateCompletionNarration(currentRunId);
  };

  const startTargets = async (
    flowId: Act5FlowId,
    targets: Act5SequenceTarget[],
    options: { includeGlobalIntro?: boolean } = {},
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
    if (targets[0]?.context === "tutorial") {
      await cycle.prepareCustomCycle(buildAct5TargetsCycleConfig(targets));
      await startTutorialTargetWithExplanation({
        targetIndex: 0,
        keepCalibration: false,
        manual: true,
        includeGlobalIntro: options.includeGlobalIntro ?? true,
        withCountdown: false,
        currentRunId,
      });
      return;
    }

    if (targets[0]?.context === "climateStory") {
      await cycle.prepareCustomCycle(buildAct5TargetsCycleConfig(targets));
      await startClimateStoryIntro({
        targetIndex: 0,
        keepCalibration: false,
        manual: true,
        startPlayback: true,
        currentRunId,
      });
      return;
    }

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

    await startTargets("act5Story", buildAct5ClimateStorySequence(dataset), {
      includeGlobalIntro: false,
    });
  };

  const startTutorialFlow = async () => {
    await startTargets("act5TutorialDebug", buildAct5TutorialDebugSequence());
  };

  const startDebugSeason = async (season: ClimateSeason) => {
    await startTargets(
      "act5TutorialDebug",
      buildAct5DebugSingleSeasonSequence(season),
      { includeGlobalIntro: false },
    );
  };

  const startDebugSeasonSequence = async (season: ClimateSeason) => {
    await startTargets(
      "act5TutorialDebug",
      buildAct5DebugSeasonValueSequence(season),
      { includeGlobalIntro: false },
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

  const playSeasonCompletionNarration = async (
    target: Act5SequenceTarget,
    currentRunId: number,
  ) => {
    const cue = resolveAct5SeasonCompletionNarration(target);

    if (!cue) return;

    await playTutorialCue(target, store.currentTargetIndex, cue, {}, currentRunId);
  };

  const scheduleAdvance = (nextTargetIndex: number, currentRunId: number) => {
    if (!isCurrentRun(currentRunId)) return;

    store.setRetryPreviewFeedbackText("");
    const nextTarget = store.targets[nextTargetIndex] ?? null;

    if (nextTarget?.context === "tutorial") {
      const currentTargetIndex = store.currentTargetIndex;
      const currentTarget = store.currentTarget;

      cycle.queueSeasonIndexRestart(
        currentTargetIndex,
        false,
        async () => {
          if (!isCurrentRun(currentRunId)) return;
          if (currentTarget) {
            await playSeasonCompletionNarration(currentTarget, currentRunId);
          }
          if (!isCurrentRun(currentRunId)) return;

          await startTutorialTargetWithExplanation({
            targetIndex: nextTargetIndex,
            keepCalibration: true,
            includeGlobalIntro: false,
            startPlayback: false,
            currentRunId,
          });
        },
        {
          restartSeasonIndex: nextTargetIndex,
          preserveBaseRhythm: true,
          afterRestart: () =>
            playCurrentTargetStoryNarrationFromBarOne("tutorial-afterRestart"),
        },
      );
      return;
    }

    if (store.currentTarget?.context === "tutorial") {
      const currentTargetIndex = store.currentTargetIndex;
      const currentTarget = store.currentTarget;

      cycle.queueSeasonIndexRestart(
        currentTargetIndex,
        false,
        async () => {
          if (!isCurrentRun(currentRunId)) return;
          if (currentTarget) {
            await playSeasonCompletionNarration(currentTarget, currentRunId);
          }
          if (!isCurrentRun(currentRunId)) return;

          store.setSequenceStatus("tutorialCompleted");
          resolveAct5TutorialCompleteNarration();
          await startClimateStoryIntro({
            targetIndex: nextTargetIndex,
            keepCalibration: true,
            startPlayback: false,
          });
        },
        {
          restartSeasonIndex: nextTargetIndex,
          preserveBaseRhythm: true,
          afterRestart: () =>
            playCurrentTargetStoryNarrationFromBarOne(
              "tutorial-story-afterRestart",
            ),
        },
      );
      return;
    }

    if (nextTarget?.context === "climateStory") {
      const currentTargetIndex = store.currentTargetIndex;

      cycle.queueSeasonIndexRestart(
        currentTargetIndex,
        false,
        async () => {
          if (!isCurrentRun(currentRunId)) return;

          await startStoryTarget({
            targetIndex: nextTargetIndex,
            keepCalibration: true,
            startPlayback: false,
          });
        },
        {
          restartSeasonIndex: nextTargetIndex,
          preserveBaseRhythm: true,
          afterRestart: () =>
            playCurrentTargetStoryNarrationFromBarOne("story-afterRestart"),
        },
      );
      return;
    }

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

    const currentTarget = store.targets[currentTargetIndex] ?? null;
    const nextTarget = store.targets[nextTargetIndex] ?? null;

    if (
      isReferenceStoryTarget(currentTarget) &&
      !isReferenceStoryTarget(nextTarget)
    ) {
      cycle.queueSeasonIndexRestart(
        currentTargetIndex,
        false,
        async () => {
          if (!isCurrentRun(evaluationRunId)) return;

          await playReferenceCompleteInterlude({
            targetIndex: nextTargetIndex,
            currentRunId: evaluationRunId,
          });

          if (!isCurrentRun(evaluationRunId)) return;

          startTarget(nextTargetIndex, {
            keepCalibration: true,
          });
        },
        {
          restartSeasonIndex: nextTargetIndex,
          preserveBaseRhythm: true,
          afterRestart: () =>
            playCurrentTargetStoryNarrationFromBarOne("reference-afterRestart"),
        },
      );
      return;
    }

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
        interludeDurationMs:
          act5IntroCycleConfig.barDurationMs * ACT5_PERIOD_TRANSITION_BAR_COUNT,
        restartSeasonIndex: nextTargetIndex,
        afterRestart: () =>
          playCurrentTargetStoryNarrationFromBarOne("period-afterRestart"),
        onInterludeStart: () => {
          if (!isCurrentRun(evaluationRunId)) return;

          store.enterPeriodTransition(transition.transition);
          store.setRetryPreviewFeedbackText("");
          store.clearFeedback();
          playPeriodTransitionNarration({
            completedPeriod: transition.transition.previousPeriod,
            currentRunId: evaluationRunId,
          });
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
      const completedTarget = store.currentTarget;

      cycle.queueSeasonIndexEndAction(store.currentTargetIndex, () => {
        if (!isCurrentRun(currentRunId)) return;
        void (async () => {
          if (completedTarget?.context === "tutorial") {
            await playSeasonCompletionNarration(completedTarget, currentRunId);
          }
          if (!isCurrentRun(currentRunId)) return;

          if (completedTarget?.context === "tutorial") {
            store.setSequenceStatus("tutorialCompleted");
            resolveAct5TutorialCompleteNarration();
          }

          if (completedTarget?.context === "climateStory") {
            await runClimateCompletionOutro(currentRunId);
          }

          if (!isCurrentRun(currentRunId)) return;

          await complete();
        })();
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

  const getRecognitionPlaybackState = ():
    Act5RecognitionFrame["playbackState"] =>
    cycle.playbackState.value === "previewing"
      ? "idle"
      : cycle.playbackState.value;

  const getSeasonPhase = () => {
    if (cycle.seasonPhase) return cycle.seasonPhase.value;
    if (cycle.currentBar?.value === 1) return "preview";
    return null;
  };

  const playCurrentTargetStoryNarrationFromBarOne = (source: string) => {
    const target = store.currentTarget;

    if (!store.isFlowActive) {
      warnStoryTts("SKIPPED", {
        source,
        reason: "inactiveFlow",
        runId,
        flowId: store.flowId,
      });
      return;
    }

    if (store.sequenceStatus !== "performing") {
      warnStoryTts("SKIPPED", {
        source,
        reason: "notPerforming",
        runId,
        flowId: store.flowId,
        sequenceStatus: store.sequenceStatus,
      });
      return;
    }

    if (!target || target.context !== "climateStory") {
      warnStoryTts("SKIPPED", {
        source,
        reason: !target ? "wrongTarget" : "wrongContext",
        targetId: target?.id ?? null,
        context: target?.context ?? null,
      });
      return;
    }

    logStoryTts("TRIGGER", {
      source,
      runId,
      targetId: target.id,
      targetIndex: store.currentTargetIndex,
      period: target.climateData?.interval ?? target.interval ?? null,
      season: target.season,
      currentSeasonIndex: cycle.currentSeasonIndex.value,
      playbackState: cycle.playbackState.value,
      currentBar: cycle.currentBar?.value ?? null,
      seasonPhase: getSeasonPhase(),
    });
    playStoryTargetCue(target, store.currentTargetIndex, runId);
  };

  const maybePlayCurrentTargetStoryNarration = (source = "watch") => {
    const rejection = getCurrentTargetStoryNarrationRejection();

    if (rejection) {
      const target = store.currentTarget;
      const rejectionKey = [
        source,
        rejection,
        runId,
        store.flowId ?? "act5",
        store.currentTargetIndex,
        target?.id ?? "none",
        cycle.playbackState.value,
        cycle.currentSeasonIndex.value,
        cycle.currentBar?.value ?? "none",
        getSeasonPhase() ?? "none",
        store.sequenceStatus,
      ].join(":");

      if (!loggedStoryNarrationRejections.has(rejectionKey)) {
        loggedStoryNarrationRejections.add(rejectionKey);
        warnStoryTts("SKIPPED", {
          source,
          reason: rejection,
          runId,
          flowId: store.flowId,
          targetId: target?.id ?? null,
          targetIndex: store.currentTargetIndex,
          currentSeasonIndex: cycle.currentSeasonIndex.value,
          playbackState: cycle.playbackState.value,
          currentBar: cycle.currentBar?.value ?? null,
          seasonPhase: getSeasonPhase(),
          sequenceStatus: store.sequenceStatus,
        });
      }

      return;
    }

    playCurrentTargetStoryNarrationFromBarOne(source);
  };

  const getCurrentTargetStoryNarrationRejection = () => {
    if (!store.isFlowActive) return "inactiveFlow";
    if (store.sequenceStatus !== "performing") return "notPerforming";
    if (cycle.playbackState.value !== "playing") return "notPlaying";
    if (cycle.currentSeasonIndex.value !== store.currentTargetIndex) {
      return "wrongTarget";
    }
    if (getSeasonPhase() !== "preview") return "notBar1";

    return null;
  };

  const getRecognitionFrame = (): Act5RecognitionFrame => ({
    landmarks: lastPoseLandmarks,
    playbackState: getRecognitionPlaybackState(),
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

  const playDebugOutro = async () => {
    const currentRunId = nextRunId();
    const dataset = await ensureClimateDataReady();

    if (!dataset || !isCurrentRun(currentRunId)) return;

    stopNarration();
    lastPoseLandmarks = null;
    recognition.resetAll();
    store.startFlow("act5Story", buildAct5ClimateStorySequence(dataset));
    store.completeFlow();
    await cycle.complete();

    if (!isCurrentRun(currentRunId)) return;

    await runClimateCompletionOutro(currentRunId);
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
        () => cycle.currentBar?.value ?? null,
        () => cycle.seasonPhase?.value ?? null,
        () => store.sequenceStatus,
        () => store.debug.autoProgressEnabled,
      ],
      () => recognition.updateFrame(getRecognitionFrame()),
      { immediate: true },
    ),
    watch(
      [
        cycle.playbackState,
        cycle.currentSeasonIndex,
        cycle.currentBar ?? (() => null),
        cycle.seasonPhase ?? (() => null),
        () => store.sequenceStatus,
        () => store.currentTargetIndex,
      ],
      () => maybePlayCurrentTargetStoryNarration("watch"),
      { flush: "post" },
    ),
    watch(
      () => cycle.currentSeasonIndex.value,
      (nextIndex) => {
        if (!store.isFlowActive) return;
        if (store.sequenceStatus !== "performing") return;
        if (nextIndex === store.currentTargetIndex) return;
        if (!store.targets[nextIndex]) return;
        if (store.targets[nextIndex]?.context === "tutorial") return;
        if (store.currentTarget?.context === "tutorial") return;
        if (isReferenceStoryTarget(store.targets[nextIndex] ?? null)) return;

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
    playDebugOutro,
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
