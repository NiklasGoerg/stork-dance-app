import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useMovementPlayback } from "~/composables/useMovementPlayback";
import { useAudioStore } from "~/store/audioStore";
import { useStoryPlaybackStore } from "~/store/storyPlayback";
import type { MovementRecording } from "~/types/movement";
import {
  addStoryDays,
  formatStoryDate,
  STORY_CYCLE_DURATION_MS,
} from "~/utils/storyCycle";
import {
  getSeasonalCycleDurationMs,
  getSeasonalCycleProgress,
  type SeasonalCycleConfig,
  type SeasonalCyclePlaybackState,
  type SeasonalCycleSeasonConfig,
} from "~/utils/seasonalCycle";

type LoadedSeasonMovement = {
  recording: MovementRecording;
  durationMs: number;
};

type QueuedSeasonRestart = {
  seasonId: SeasonalCycleSeasonConfig["id"];
  withCountdown: boolean;
  beforeRestart?: () => void;
  interludeDurationMs?: number;
  onInterludeStart?: () => void;
};

const seasonCalendarDurations: Record<SeasonalCycleSeasonConfig["id"], number> =
  {
    spring: 92,
    summer: 92,
    autumn: 91,
    winter: 90,
  };

const getRecordingDurationMs = (recording: MovementRecording) => {
  const firstFrameTime = recording.frames[0]?.time ?? 0;
  const lastFrameTime =
    recording.frames[recording.frames.length - 1]?.time ?? firstFrameTime;

  return Math.max(lastFrameTime - firstFrameTime, 1);
};

const getSeasonMovementPrerollMs = (
  season: SeasonalCycleSeasonConfig,
  fallbackPrerollMs: number,
) => season.movementPrerollMs ?? fallbackPrerollMs;

const getSeasonMovementLoopDurationMs = (
  season: SeasonalCycleSeasonConfig,
  fallbackLoopDurationMs: number,
) => season.movementLoopDurationMs ?? fallbackLoopDurationMs;

export const useSeasonalLearningCycle = (config: SeasonalCycleConfig) => {
  const audioStore = useAudioStore();
  const storyPlaybackStore = useStoryPlaybackStore();
  const { currentDate } = storeToRefs(storyPlaybackStore);
  const {
    currentFrame,
    loadRecording,
    seekToTime,
    stop: stopMovementPlayback,
  } = useMovementPlayback();

  const playbackState = ref<SeasonalCyclePlaybackState>("idle");
  const timelineMs = ref(0);
  const currentMovementSourceAspect = ref(4 / 3);
  const loadedMovements = new Map<string, LoadedSeasonMovement>();
  const activeConfig = ref<SeasonalCycleConfig>(config);
  const totalDurationMs = computed(() =>
    getSeasonalCycleDurationMs(activeConfig.value),
  );
  const countdownDurationMs = config.countdownDurationMs ?? 0;
  const movementPrerollMs = config.movementPrerollMs ?? 0;

  let animationFrameId = 0;
  let playbackStartedAtMs = 0;
  let playbackStartedFromMs = 0;
  let activeMovementSeasonId: string | null = null;
  let activeAudioSeasonId: string | null = null;
  let hasRestartedBaseRhythmForCycle = false;
  let queuedSeasonRestart: QueuedSeasonRestart | null = null;
  let interludeRestartTimer: ReturnType<typeof setTimeout> | null = null;

  const progress = computed(() =>
    getSeasonalCycleProgress(activeConfig.value, elapsedMs.value),
  );
  const elapsedMs = computed(() =>
    Math.min(Math.max(timelineMs.value, 0), totalDurationMs.value),
  );
  const currentSeason = computed(() => progress.value.season);
  const currentSeasonIndex = computed(() => progress.value.seasonIndex);
  const seasonElapsedMs = computed(() => progress.value.seasonElapsedMs);
  const repetitionIndex = computed(() => progress.value.repetitionIndex);
  const isTransition = computed(() => progress.value.isTransition);
  const isCompleted = computed(() => playbackState.value === "completed");
  const countdownRemaining = computed(() =>
    timelineMs.value < 0
      ? Math.min(
          Math.ceil(Math.abs(timelineMs.value) / 1000),
          Math.ceil(countdownDurationMs / 1000),
        )
      : 0,
  );
  const isCountingDown = computed(() => playbackState.value === "countdown");
  const showInstructorAvatar = computed(
    () => timelineMs.value >= -movementPrerollMs,
  );

  const clearAnimationFrame = () => {
    if (!animationFrameId) return;

    cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  };

  const clearInterludeRestartTimer = () => {
    if (!interludeRestartTimer) return;

    clearTimeout(interludeRestartTimer);
    interludeRestartTimer = null;
  };

  const getSeasonDate = () => {
    const season = progress.value.season;
    const seasonDays = seasonCalendarDurations[season.id];
    const elapsedSeasonDays = Math.min(
      Math.floor(
        (progress.value.seasonElapsedMs / config.seasonDurationMs) * seasonDays,
      ),
      seasonDays - 1,
    );

    return formatStoryDate(addStoryDays(season.date, elapsedSeasonDays));
  };

  const syncStoryClock = () => {
    storyPlaybackStore.$patch({
      currentDate: getSeasonDate(),
      currentElapsedMs: elapsedMs.value,
      cycleDurationMs: totalDurationMs.value,
    });
  };

  const loadSeasonMovement = async (season: SeasonalCycleSeasonConfig) => {
    const cachedMovement = loadedMovements.get(season.id);

    if (cachedMovement) return cachedMovement;

    const response = await fetch(season.movementUrl);

    if (!response.ok) {
      throw new Error(`Could not load ${season.id} movement.`);
    }

    const recording = (await response.json()) as MovementRecording;
    const movement = {
      recording,
      durationMs: getRecordingDurationMs(recording),
    };

    loadedMovements.set(season.id, movement);

    return movement;
  };

  const getNextSeason = (seasonIndex: number) =>
    activeConfig.value.seasons[
      (seasonIndex + 1) % activeConfig.value.seasons.length
    ] ?? activeConfig.value.seasons[0];

  const showMovementFirstFrame = async (season: SeasonalCycleSeasonConfig) => {
    const movement = await loadSeasonMovement(season);

    if (activeMovementSeasonId !== season.id) {
      loadRecording(movement.recording);
      activeMovementSeasonId = season.id;
      currentMovementSourceAspect.value =
        movement.recording.source?.width && movement.recording.source.height
          ? movement.recording.source.width / movement.recording.source.height
          : 4 / 3;
    }

    seekToTime(0);
  };

  const showMovementPrerollFrame = async (
    season: SeasonalCycleSeasonConfig,
    sourceTimeMs: number,
  ) => {
    const movement = await loadSeasonMovement(season);

    if (activeMovementSeasonId !== season.id) {
      loadRecording(movement.recording);
      activeMovementSeasonId = season.id;
      currentMovementSourceAspect.value =
        movement.recording.source?.width && movement.recording.source.height
          ? movement.recording.source.width / movement.recording.source.height
          : 4 / 3;
    }

    seekToTime(sourceTimeMs);
  };

  const loadAssets = async () => {
    await Promise.all([
      ...activeConfig.value.seasons.map(loadSeasonMovement),
      audioStore.preloadSeasonalAudio(
        activeConfig.value.seasons.map((season) => ({
          id: season.id,
          url: season.audioUrl,
        })),
      ),
      audioStore.loadBaseRhythmLoop(),
    ]);
  };

  const seekMovementFromProgress = async () => {
    const currentProgress = progress.value;

    if (timelineMs.value < 0) {
      const firstSeason = activeConfig.value.seasons[0];
      const seasonPrerollMs = getSeasonMovementPrerollMs(
        firstSeason,
        movementPrerollMs,
      );

      if (timelineMs.value >= -seasonPrerollMs) {
        await showMovementPrerollFrame(
          firstSeason,
          Math.min(
            Math.max(timelineMs.value + seasonPrerollMs, 0),
            seasonPrerollMs,
          ),
        );
      }

      return;
    }

    if (currentProgress.isTransition) {
      await showMovementFirstFrame(getNextSeason(currentProgress.seasonIndex));
      return;
    }

    const movement = await loadSeasonMovement(currentProgress.season);

    if (activeMovementSeasonId !== currentProgress.season.id) {
      loadRecording(movement.recording);
      activeMovementSeasonId = currentProgress.season.id;
      currentMovementSourceAspect.value =
        movement.recording.source?.width && movement.recording.source.height
          ? movement.recording.source.width / movement.recording.source.height
          : 4 / 3;
    }

    const movementStartMs = Math.min(
      getSeasonMovementPrerollMs(currentProgress.season, movementPrerollMs),
      movement.durationMs,
    );
    const movementLoopDurationMs = getSeasonMovementLoopDurationMs(
      currentProgress.season,
      config.barDurationMs,
    );
    const movementElapsedMs =
      currentProgress.seasonElapsedMs % movementLoopDurationMs;
    const replayPrerollMs = currentProgress.season.movementReplayPrerollMs ?? 0;
    const isReplayPreroll =
      replayPrerollMs > 0 &&
      movementStartMs > 0 &&
      movementElapsedMs >= movementLoopDurationMs - replayPrerollMs;
    const movementTimeMs = isReplayPreroll
      ? Math.max(movementStartMs - replayPrerollMs, 0) +
        movementElapsedMs -
        (movementLoopDurationMs - replayPrerollMs)
      : Math.min(movementStartMs + movementElapsedMs, movement.durationMs);

    seekToTime(movementTimeMs);
  };

  const syncSeasonalAudio = async () => {
    if (playbackState.value !== "playing") return;

    const currentProgress = progress.value;

    if (activeAudioSeasonId === currentProgress.season.id) return;

    activeAudioSeasonId = currentProgress.season.id;
    await audioStore.startSeasonalAudio(
      {
        id: currentProgress.season.id,
        url: currentProgress.season.audioUrl,
      },
      currentProgress.seasonElapsedMs / 1000,
    );
  };

  const syncCycleStartAudio = async () => {
    if (timelineMs.value < 0 || hasRestartedBaseRhythmForCycle) return;

    hasRestartedBaseRhythmForCycle = true;
    audioStore.resetBaseRhythmLoop();
    await audioStore.startBaseRhythmLoop(elapsedMs.value / 1000);
    await syncSeasonalAudio();
  };

  const seekToTimeline = async (nextTimelineMs: number) => {
    timelineMs.value = Math.min(
      Math.max(nextTimelineMs, -countdownDurationMs),
      totalDurationMs.value,
    );
    syncStoryClock();
    await seekMovementFromProgress();
  };

  const complete = async () => {
    clearAnimationFrame();
    timelineMs.value = totalDurationMs.value;
    playbackState.value = "completed";
    activeAudioSeasonId = null;
    audioStore.stopSeasonalAudio();
    audioStore.resetBaseRhythmLoop();
    syncStoryClock();
    await seekMovementFromProgress();
  };

  const tick = () => {
    if (
      playbackState.value !== "countdown" &&
      playbackState.value !== "playing"
    ) {
      return;
    }

    const nextTimelineMs =
      playbackStartedFromMs + performance.now() - playbackStartedAtMs;

    if (queuedSeasonRestart) {
      const seasonIndex = activeConfig.value.seasons.findIndex(
        (season) => season.id === queuedSeasonRestart?.seasonId,
      );
      const seasonEndMs =
        seasonIndex >= 0
          ? (seasonIndex + 1) * activeConfig.value.seasonDurationMs
          : null;

      if (
        seasonEndMs !== null &&
        elapsedMs.value < seasonEndMs &&
        nextTimelineMs >= seasonEndMs
      ) {
        const restartRequest = queuedSeasonRestart;

        queuedSeasonRestart = null;
        if ((restartRequest.interludeDurationMs ?? 0) > 0) {
          clearAnimationFrame();
          void seekToTimeline(seasonEndMs);
          activeAudioSeasonId = null;
          audioStore.stopSeasonalAudio();
          restartRequest.onInterludeStart?.();
          interludeRestartTimer = setTimeout(() => {
            interludeRestartTimer = null;
            restartRequest.beforeRestart?.();
            void restartSeason(
              restartRequest.seasonId,
              restartRequest.withCountdown,
            );
          }, restartRequest.interludeDurationMs);
        } else {
          restartRequest.beforeRestart?.();
          void restartSeason(
            restartRequest.seasonId,
            restartRequest.withCountdown,
          );
        }
        return;
      }
    }

    if (nextTimelineMs >= totalDurationMs.value) {
      void complete();
      return;
    }

    playbackState.value = nextTimelineMs < 0 ? "countdown" : "playing";
    void seekToTimeline(nextTimelineMs);

    if (nextTimelineMs >= 0 && !hasRestartedBaseRhythmForCycle) {
      void syncCycleStartAudio();
    } else {
      void syncSeasonalAudio();
    }

    animationFrameId = requestAnimationFrame(tick);
  };

  const initialize = async () => {
    clearAnimationFrame();
    clearInterludeRestartTimer();
    queuedSeasonRestart = null;
    playbackState.value = "idle";
    timelineMs.value = 0;
    activeAudioSeasonId = null;
    hasRestartedBaseRhythmForCycle = false;
    await loadAssets();
    audioStore.stopSeasonalAudio();
    audioStore.resetBaseRhythmLoop();
    await seekToTimeline(0);
  };

  const play = async () => {
    if (
      playbackState.value === "countdown" ||
      playbackState.value === "playing"
    ) {
      return;
    }

    if (playbackState.value === "completed") {
      await reset();
    } else {
      await loadAssets();
    }

    const nextStartedFromMs =
      playbackState.value === "idle" && timelineMs.value === 0
        ? -countdownDurationMs
        : timelineMs.value;

    timelineMs.value = nextStartedFromMs;
    hasRestartedBaseRhythmForCycle = nextStartedFromMs >= 0;
    playbackState.value = nextStartedFromMs < 0 ? "countdown" : "playing";
    playbackStartedAtMs = performance.now();
    playbackStartedFromMs = nextStartedFromMs;
    activeAudioSeasonId = null;
    await audioStore.startBaseRhythmLoop(
      timelineMs.value < 0
        ? (countdownDurationMs + timelineMs.value) / 1000
        : elapsedMs.value / 1000,
    );
    await syncSeasonalAudio();
    clearAnimationFrame();
    animationFrameId = requestAnimationFrame(tick);
  };

  const pause = () => {
    if (
      playbackState.value !== "countdown" &&
      playbackState.value !== "playing"
    ) {
      return;
    }

    clearAnimationFrame();
    playbackState.value = "paused";
    audioStore.pauseSeasonalAudio();
    audioStore.pauseBaseRhythmLoop();
  };

  const reset = async () => {
    clearAnimationFrame();
    clearInterludeRestartTimer();
    queuedSeasonRestart = null;
    playbackState.value = "idle";
    timelineMs.value = 0;
    activeMovementSeasonId = null;
    activeAudioSeasonId = null;
    hasRestartedBaseRhythmForCycle = false;
    audioStore.stopSeasonalAudio();
    audioStore.resetBaseRhythmLoop();
    await loadAssets();
    await seekToTimeline(0);
  };

  const getSingleSeasonConfig = (seasonId: SeasonalCycleSeasonConfig["id"]) => {
    const season = config.seasons.find((item) => item.id === seasonId);

    if (!season) {
      throw new Error(`Unknown season "${seasonId}".`);
    }

    return {
      ...config,
      seasons: [season],
    };
  };

  const restoreFullCycle = async () => {
    clearInterludeRestartTimer();
    queuedSeasonRestart = null;
    activeConfig.value = config;
    await reset();
  };

  const playFromTimeline = async (
    nextTimelineMs: number,
    withCountdown = false,
  ) => {
    await loadAssets();
    clearAnimationFrame();
    activeAudioSeasonId = null;
    hasRestartedBaseRhythmForCycle = nextTimelineMs > 0;

    const nextStartedFromMs = withCountdown
      ? nextTimelineMs - countdownDurationMs
      : nextTimelineMs;

    timelineMs.value = nextStartedFromMs;
    playbackState.value = nextStartedFromMs < 0 ? "countdown" : "playing";
    playbackStartedAtMs = performance.now();
    playbackStartedFromMs = nextStartedFromMs;

    await audioStore.startBaseRhythmLoop(
      timelineMs.value < 0
        ? (countdownDurationMs + timelineMs.value) / 1000
        : elapsedMs.value / 1000,
    );
    await syncSeasonalAudio();
    animationFrameId = requestAnimationFrame(tick);
  };

  const startSingleSeason = async (
    seasonId: SeasonalCycleSeasonConfig["id"],
  ) => {
    clearAnimationFrame();
    clearInterludeRestartTimer();
    queuedSeasonRestart = null;
    activeConfig.value = getSingleSeasonConfig(seasonId);
    playbackState.value = "idle";
    timelineMs.value = 0;
    activeMovementSeasonId = null;
    activeAudioSeasonId = null;
    hasRestartedBaseRhythmForCycle = false;
    audioStore.stopSeasonalAudio();
    audioStore.resetBaseRhythmLoop();
    await loadAssets();
    await seekToTimeline(0);
    await playFromTimeline(0, true);
  };

  const restartSeason = async (
    seasonId: SeasonalCycleSeasonConfig["id"],
    withCountdown = true,
  ) => {
    clearInterludeRestartTimer();
    queuedSeasonRestart = null;
    const seasonIndex = activeConfig.value.seasons.findIndex(
      (season) => season.id === seasonId,
    );

    if (seasonIndex < 0) return;

    const nextTimelineMs = seasonIndex * activeConfig.value.seasonDurationMs;

    clearAnimationFrame();
    playbackState.value = "idle";
    activeMovementSeasonId = null;
    activeAudioSeasonId = null;
    hasRestartedBaseRhythmForCycle = nextTimelineMs > 0;
    audioStore.stopSeasonalAudio();
    audioStore.resetBaseRhythmLoop();
    await seekToTimeline(nextTimelineMs);
    await playFromTimeline(
      nextTimelineMs,
      withCountdown && nextTimelineMs === 0,
    );
  };

  const queueSeasonRestart = (
    seasonId: SeasonalCycleSeasonConfig["id"],
    withCountdown = false,
    beforeRestart?: () => void,
    options: {
      interludeDurationMs?: number;
      onInterludeStart?: () => void;
    } = {},
  ) => {
    queuedSeasonRestart = {
      seasonId,
      withCountdown,
      beforeRestart,
      interludeDurationMs: options.interludeDurationMs,
      onInterludeStart: options.onInterludeStart,
    };
  };

  const cleanup = () => {
    clearAnimationFrame();
    clearInterludeRestartTimer();
    queuedSeasonRestart = null;
    activeAudioSeasonId = null;
    audioStore.stopSeasonalAudio();
    audioStore.resetBaseRhythmLoop();
    stopMovementPlayback();
    storyPlaybackStore.$patch({
      cycleDurationMs: STORY_CYCLE_DURATION_MS,
    });
  };

  return {
    currentDate,
    currentFrame,
    currentMovementSourceAspect,
    currentSeason,
    currentSeasonIndex,
    countdownRemaining,
    elapsedMs,
    isCountingDown,
    isCompleted,
    isTransition,
    playbackState,
    progress,
    repetitionIndex,
    seasonElapsedMs,
    showInstructorAvatar,
    totalDurationMs,
    initialize,
    pause,
    play,
    reset,
    restartSeason,
    restoreFullCycle,
    startSingleSeason,
    queueSeasonRestart,
    cleanup,
  };
};
