import { computed, ref } from "vue";
import { useMovementPlayback } from "~/composables/useMovementPlayback";
import { useAudioStore } from "~/store/audioStore";
import type { MovementRecording } from "~/types/movement";
import {
  getMovementRecordingDurationMs,
  normalizeMovementRecordingFrameTimes,
  resolveMovementPlaybackPosition,
} from "~/utils/movementPlaybackTiming";
import { addStoryDays, formatStoryDate } from "~/utils/storyCycle";
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
  seasonId?: SeasonalCycleSeasonConfig["id"];
  seasonIndex?: number;
  restartSeasonIndex?: number;
  withCountdown: boolean;
  beforeRestart?: () => void | Promise<void>;
  interludeDurationMs?: number;
  onInterludeStart?: () => void;
};

type QueuedSeasonEndAction = {
  seasonId?: SeasonalCycleSeasonConfig["id"];
  seasonIndex?: number;
  onSeasonEnd: () => void;
};

const seasonCalendarDurations: Record<SeasonalCycleSeasonConfig["id"], number> =
  {
    spring: 92,
    summer: 92,
    autumn: 91,
    winter: 90,
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
  const currentDate = ref(
    formatStoryDate(config.seasons[0]?.date ?? "2022-06-01"),
  );
  const {
    currentFrame,
    loadRecording,
    seekToTime,
    stop: stopMovementPlayback,
  } = useMovementPlayback();

  const playbackState = ref<SeasonalCyclePlaybackState>("idle");
  const timelineMs = ref(0);
  const currentMovementSourceAspect = ref(4 / 3);
  const loadedMovements = new Map<string, LoadedSeasonMovement | null>();
  const warnedMovementIds = new Set<string>();
  const movementSourceFps = ref<number | null>(null);
  const movementFrameCount = ref(0);
  const movementSourceDurationMs = ref(0);
  const movementPrerollMsDebug = ref(0);
  const movementLoopStartMs = ref(0);
  const movementLoopEndMs = ref(0);
  const movementSourceTimeMs = ref(0);
  const movementLoopCount = ref(0);
  const movementLoaded = ref(false);
  const configuredMovementId = ref<string | null>(null);
  const movementIntensity = ref<number | null>(null);
  const usingFallbackMovement = ref(false);
  const activeConfig = ref<SeasonalCycleConfig>(config);
  const totalDurationMs = computed(() =>
    getSeasonalCycleDurationMs(activeConfig.value),
  );
  const countdownDurationMs = computed(
    () => activeConfig.value.countdownDurationMs ?? 0,
  );
  const movementPrerollMs = computed(
    () => activeConfig.value.movementPrerollMs ?? 0,
  );
  const isSeasonalAudioEnabled = computed(
    () => activeConfig.value.seasonalAudioEnabled !== false,
  );

  let animationFrameId = 0;
  let playbackStartedAtMs = 0;
  let playbackStartedFromMs = 0;
  let activeMovementKey: string | null = null;
  let activeAudioSeasonId: string | null = null;
  let activeAudioSeasonIndex: number | null = null;
  let hasRestartedBaseRhythmForCycle = false;
  let audioLockedAfterCompletion = false;
  let queuedSeasonRestart: QueuedSeasonRestart | null = null;
  let queuedSeasonEndAction: QueuedSeasonEndAction | null = null;
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
  const currentBar = computed(() => progress.value.currentBar);
  const currentBeat = computed(() => progress.value.currentBeat);
  const currentRepetition = computed(() => progress.value.currentRepetition);
  const seasonPhase = computed(() => progress.value.phase);
  const evaluationEnabled = computed(() => progress.value.evaluationEnabled);
  const movementDirection = computed(() => progress.value.movementDirection);
  const isTransition = computed(() => progress.value.isTransition);
  const isCompleted = computed(() => playbackState.value === "completed");
  const countdownRemaining = computed(() =>
    timelineMs.value < 0
      ? Math.min(
          Math.ceil(Math.abs(timelineMs.value) / 1000),
          Math.ceil(countdownDurationMs.value / 1000),
        )
      : 0,
  );
  const isCountingDown = computed(() => playbackState.value === "countdown");
  const movementPlaying = computed(
    () =>
      movementLoaded.value &&
      (playbackState.value === "playing" ||
        playbackState.value === "countdown"),
  );
  const showInstructorAvatar = computed(
    () => timelineMs.value >= -movementPrerollMs.value,
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

  const restartQueuedSeason = async (request: QueuedSeasonRestart) => {
    await request.beforeRestart?.();
    await restartSeason(
      request.seasonId,
      request.withCountdown,
      request.restartSeasonIndex ?? request.seasonIndex,
    );
  };

  const getSeasonDate = () => {
    const season = progress.value.season;
    const seasonDays = seasonCalendarDurations[season.id];
    const elapsedSeasonDays = Math.min(
      Math.floor(
        (progress.value.seasonElapsedMs / activeConfig.value.seasonDurationMs) *
          seasonDays,
      ),
      seasonDays - 1,
    );

    return formatStoryDate(addStoryDays(season.date, elapsedSeasonDays));
  };

  const syncStoryClock = () => {
    currentDate.value = getSeasonDate();
  };

  const getMovementKey = (season: SeasonalCycleSeasonConfig) =>
    season.configuredMovementId ?? season.movementUrl;

  const clearMovementDebug = (season?: SeasonalCycleSeasonConfig) => {
    movementSourceFps.value = null;
    movementFrameCount.value = 0;
    movementSourceDurationMs.value = 0;
    movementPrerollMsDebug.value = season?.movementTiming?.prerollMs ?? 0;
    movementLoopStartMs.value = season?.movementTiming?.loopStartMs ?? 0;
    movementLoopEndMs.value = season?.movementTiming?.loopEndMs ?? 0;
    movementSourceTimeMs.value = 0;
    movementLoopCount.value = 0;
    movementLoaded.value = false;
    configuredMovementId.value = season?.configuredMovementId ?? null;
    movementIntensity.value = season?.movementIntensity ?? null;
    usingFallbackMovement.value = season?.usingFallbackMovement ?? false;
  };

  const updateMovementDebug = (
    season: SeasonalCycleSeasonConfig,
    movement: LoadedSeasonMovement,
  ) => {
    movementSourceFps.value = movement.recording.fps;
    movementFrameCount.value = movement.recording.frames.length;
    movementSourceDurationMs.value = movement.durationMs;
    movementPrerollMsDebug.value =
      season.movementTiming?.prerollMs ??
      getSeasonMovementPrerollMs(season, movementPrerollMs.value);
    movementLoopStartMs.value =
      season.movementTiming?.loopStartMs ?? movementPrerollMsDebug.value;
    movementLoopEndMs.value = Math.min(
      season.movementTiming?.loopEndMs ??
        movementLoopStartMs.value +
          getSeasonMovementLoopDurationMs(
            season,
            activeConfig.value.barDurationMs,
          ),
      movement.durationMs,
    );
    movementLoaded.value = true;
    configuredMovementId.value = season.configuredMovementId ?? null;
    movementIntensity.value = season.movementIntensity ?? null;
    usingFallbackMovement.value = season.usingFallbackMovement ?? false;
  };

  const loadSeasonMovement = async (season: SeasonalCycleSeasonConfig) => {
    const movementKey = getMovementKey(season);

    if (loadedMovements.has(movementKey)) {
      return loadedMovements.get(movementKey) ?? null;
    }

    try {
      const response = await fetch(season.movementUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const recording = normalizeMovementRecordingFrameTimes(
        (await response.json()) as MovementRecording,
      );
      const movement = {
        recording,
        durationMs: getMovementRecordingDurationMs(recording),
      };

      loadedMovements.set(movementKey, movement);
      return movement;
    } catch (error) {
      loadedMovements.set(movementKey, null);
      if (import.meta.dev && !warnedMovementIds.has(movementKey)) {
        warnedMovementIds.add(movementKey);
        console.warn(
          `[Act5] Movement "${season.configuredMovementId ?? movementKey}" could not be loaded from ${season.movementUrl}; Act 5 will continue without the instructor clip.`,
          error,
        );
      }

      return null;
    }
  };

  const getNextSeason = (seasonIndex: number) => {
    const nextSeason =
      activeConfig.value.seasons[
        (seasonIndex + 1) % activeConfig.value.seasons.length
      ] ?? activeConfig.value.seasons[0];

    if (!nextSeason) {
      throw new Error("Seasonal cycle needs at least one season.");
    }

    return nextSeason;
  };

  const getQueuedSeasonIndex = (
    request: Pick<QueuedSeasonRestart, "seasonId" | "seasonIndex">,
  ) => {
    if (typeof request.seasonIndex === "number") {
      return request.seasonIndex >= 0 &&
        request.seasonIndex < activeConfig.value.seasons.length
        ? request.seasonIndex
        : -1;
    }

    return activeConfig.value.seasons.findIndex(
      (season) => season.id === request.seasonId,
    );
  };

  const showMovementFirstFrame = async (season: SeasonalCycleSeasonConfig) => {
    const movement = await loadSeasonMovement(season);
    if (!movement) {
      clearMovementDebug(season);
      return;
    }
    const movementKey = getMovementKey(season);

    if (activeMovementKey !== movementKey) {
      loadRecording(movement.recording);
      activeMovementKey = movementKey;
      currentMovementSourceAspect.value =
        movement.recording.source?.width && movement.recording.source.height
          ? movement.recording.source.width / movement.recording.source.height
          : 4 / 3;
    }

    updateMovementDebug(season, movement);
    movementSourceTimeMs.value = 0;
    movementLoopCount.value = 0;
    seekToTime(0);
  };

  const showMovementPrerollFrame = async (
    season: SeasonalCycleSeasonConfig,
    sourceTimeMs: number,
  ) => {
    const movement = await loadSeasonMovement(season);
    if (!movement) {
      clearMovementDebug(season);
      return;
    }
    const movementKey = getMovementKey(season);

    if (activeMovementKey !== movementKey) {
      loadRecording(movement.recording);
      activeMovementKey = movementKey;
      currentMovementSourceAspect.value =
        movement.recording.source?.width && movement.recording.source.height
          ? movement.recording.source.width / movement.recording.source.height
          : 4 / 3;
    }

    updateMovementDebug(season, movement);
    movementSourceTimeMs.value = sourceTimeMs;
    movementLoopCount.value = 0;
    seekToTime(sourceTimeMs);
  };

  const loadAssets = async () => {
    await Promise.all([
      ...activeConfig.value.seasons.map(loadSeasonMovement),
      ...(isSeasonalAudioEnabled.value
        ? [
            audioStore.preloadSeasonalAudio(
              activeConfig.value.seasons.map((season) => ({
                id: season.id,
                url: season.audioUrl,
              })),
            ),
          ]
        : []),
      audioStore.loadBaseRhythmLoop(),
    ]);
  };

  const seekMovementFromProgress = async () => {
    const currentProgress = progress.value;

    if (timelineMs.value < 0) {
      const firstSeason = activeConfig.value.seasons[0];
      if (!firstSeason) return;
      const seasonPrerollMs = getSeasonMovementPrerollMs(
        firstSeason,
        movementPrerollMs.value,
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
    if (!movement) {
      clearMovementDebug(currentProgress.season);
      return;
    }
    const movementKey = getMovementKey(currentProgress.season);

    if (activeMovementKey !== movementKey) {
      loadRecording(movement.recording);
      activeMovementKey = movementKey;
      currentMovementSourceAspect.value =
        movement.recording.source?.width && movement.recording.source.height
          ? movement.recording.source.width / movement.recording.source.height
          : 4 / 3;
    }

    const prerollMs = getSeasonMovementPrerollMs(
      currentProgress.season,
      movementPrerollMs.value,
    );
    const timing = currentProgress.season.movementTiming ?? {
      sourceFps: 30,
      prerollMs,
      loopStartMs: prerollMs,
      loopEndMs:
        prerollMs +
        getSeasonMovementLoopDurationMs(
          currentProgress.season,
          activeConfig.value.barDurationMs,
        ),
    };
    const position = resolveMovementPlaybackPosition({
      // The countdown already played the lead-in. Season time zero therefore
      // starts at the first beat of the configured movement loop.
      elapsedMs: currentProgress.seasonElapsedMs + timing.prerollMs,
      sourceDurationMs: movement.durationMs,
      timing,
    });

    updateMovementDebug(currentProgress.season, movement);
    movementSourceTimeMs.value = position.sourceTimeMs;
    movementLoopCount.value = position.loopCount;
    seekToTime(position.sourceTimeMs);
  };

  const syncSeasonalAudio = async () => {
    if (audioLockedAfterCompletion) {
      activeAudioSeasonId = null;
      activeAudioSeasonIndex = null;
      audioStore.stopSeasonalAudio();
      return;
    }

    if (!isSeasonalAudioEnabled.value) {
      activeAudioSeasonId = null;
      audioStore.stopSeasonalAudio();
      return;
    }

    if (playbackState.value !== "playing") return;

    const currentProgress = progress.value;

    if (
      activeAudioSeasonId === currentProgress.season.id &&
      activeAudioSeasonIndex === currentProgress.seasonIndex
    ) {
      return;
    }

    activeAudioSeasonId = currentProgress.season.id;
    activeAudioSeasonIndex = currentProgress.seasonIndex;
    await audioStore.startSeasonalAudio(
      {
        id: currentProgress.season.id,
        url: currentProgress.season.audioUrl,
      },
      currentProgress.seasonElapsedMs / 1000,
    );
  };

  const syncCycleStartAudio = async () => {
    if (audioLockedAfterCompletion) return;
    if (timelineMs.value < 0 || hasRestartedBaseRhythmForCycle) return;

    hasRestartedBaseRhythmForCycle = true;
    audioStore.resetBaseRhythmLoop();
    await audioStore.startBaseRhythmLoop(elapsedMs.value / 1000);
    await syncSeasonalAudio();
  };

  const seekToTimeline = async (nextTimelineMs: number) => {
    timelineMs.value = Math.min(
      Math.max(nextTimelineMs, -countdownDurationMs.value),
      totalDurationMs.value,
    );
    syncStoryClock();
    await seekMovementFromProgress();
  };

  const complete = async () => {
    clearAnimationFrame();
    clearInterludeRestartTimer();
    queuedSeasonRestart = null;
    queuedSeasonEndAction = null;
    timelineMs.value = totalDurationMs.value;
    playbackState.value = "completed";
    audioLockedAfterCompletion = true;
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
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
      const seasonIndex = getQueuedSeasonIndex(queuedSeasonRestart);
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
          activeAudioSeasonIndex = null;
          audioStore.stopSeasonalAudio();
          restartRequest.onInterludeStart?.();
          interludeRestartTimer = setTimeout(() => {
            interludeRestartTimer = null;
            void restartQueuedSeason(restartRequest);
          }, restartRequest.interludeDurationMs);
        } else {
          void restartQueuedSeason(restartRequest);
        }
        return;
      }
    }

    if (queuedSeasonEndAction) {
      const seasonIndex = getQueuedSeasonIndex(queuedSeasonEndAction);
      const seasonEndMs =
        seasonIndex >= 0
          ? (seasonIndex + 1) * activeConfig.value.seasonDurationMs
          : null;

      if (
        seasonEndMs !== null &&
        elapsedMs.value < seasonEndMs &&
        nextTimelineMs >= seasonEndMs
      ) {
        const endAction = queuedSeasonEndAction;

        queuedSeasonEndAction = null;
        clearAnimationFrame();
        void seekToTimeline(seasonEndMs);
        playbackState.value = "completed";
        audioLockedAfterCompletion = true;
        activeAudioSeasonId = null;
        activeAudioSeasonIndex = null;
        audioStore.stopSeasonalAudio();
        audioStore.resetBaseRhythmLoop();
        endAction.onSeasonEnd();
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
    queuedSeasonEndAction = null;
    audioLockedAfterCompletion = false;
    playbackState.value = "idle";
    timelineMs.value = 0;
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
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
        ? -countdownDurationMs.value
        : timelineMs.value;

    timelineMs.value = nextStartedFromMs;
    hasRestartedBaseRhythmForCycle = nextStartedFromMs >= 0;
    playbackState.value = nextStartedFromMs < 0 ? "countdown" : "playing";
    playbackStartedAtMs = performance.now();
    playbackStartedFromMs = nextStartedFromMs;
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    await audioStore.startBaseRhythmLoop(
      timelineMs.value < 0
        ? (countdownDurationMs.value + timelineMs.value) / 1000
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
    queuedSeasonEndAction = null;
    audioLockedAfterCompletion = false;
    playbackState.value = "idle";
    timelineMs.value = 0;
    activeMovementKey = null;
    clearMovementDebug();
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
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
    queuedSeasonEndAction = null;
    activeConfig.value = config;
    await reset();
  };

  const playFromTimeline = async (
    nextTimelineMs: number,
    withCountdown = false,
  ) => {
    await loadAssets();
    if (audioLockedAfterCompletion) return;

    clearAnimationFrame();
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    hasRestartedBaseRhythmForCycle = nextTimelineMs > 0;

    const nextStartedFromMs = withCountdown
      ? nextTimelineMs - countdownDurationMs.value
      : nextTimelineMs;

    timelineMs.value = nextStartedFromMs;
    playbackState.value = nextStartedFromMs < 0 ? "countdown" : "playing";
    playbackStartedAtMs = performance.now();
    playbackStartedFromMs = nextStartedFromMs;

    await audioStore.startBaseRhythmLoop(
      timelineMs.value < 0
        ? (countdownDurationMs.value + timelineMs.value) / 1000
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
    queuedSeasonEndAction = null;
    audioLockedAfterCompletion = false;
    activeConfig.value = getSingleSeasonConfig(seasonId);
    playbackState.value = "idle";
    timelineMs.value = 0;
    activeMovementKey = null;
    clearMovementDebug();
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    hasRestartedBaseRhythmForCycle = false;
    audioStore.stopSeasonalAudio();
    audioStore.resetBaseRhythmLoop();
    await loadAssets();
    await seekToTimeline(0);
    await playFromTimeline(0, true);
  };

  const startCustomCycle = async (
    nextConfig: SeasonalCycleConfig,
    withCountdown = false,
  ) => {
    clearAnimationFrame();
    clearInterludeRestartTimer();
    queuedSeasonRestart = null;
    queuedSeasonEndAction = null;
    audioLockedAfterCompletion = false;
    activeConfig.value = nextConfig;
    playbackState.value = "idle";
    timelineMs.value = 0;
    activeMovementKey = null;
    clearMovementDebug();
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    hasRestartedBaseRhythmForCycle = false;
    audioStore.stopSeasonalAudio();
    audioStore.resetBaseRhythmLoop();
    await loadAssets();
    await seekToTimeline(0);
    await playFromTimeline(0, withCountdown);
  };

  const restartSeason = async (
    seasonId?: SeasonalCycleSeasonConfig["id"],
    withCountdown = true,
    seasonIndexOverride?: number,
  ) => {
    if (audioLockedAfterCompletion) return;

    clearInterludeRestartTimer();
    queuedSeasonRestart = null;
    queuedSeasonEndAction = null;
    const seasonIndex =
      typeof seasonIndexOverride === "number"
        ? seasonIndexOverride
        : activeConfig.value.seasons.findIndex(
            (season) => season.id === seasonId,
          );

    if (seasonIndex < 0) return;

    const nextTimelineMs = seasonIndex * activeConfig.value.seasonDurationMs;

    clearAnimationFrame();
    playbackState.value = "idle";
    activeMovementKey = null;
    clearMovementDebug();
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
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
    beforeRestart?: () => void | Promise<void>,
    options: {
      interludeDurationMs?: number;
      onInterludeStart?: () => void;
      restartSeasonIndex?: number;
    } = {},
  ) => {
    queuedSeasonEndAction = null;
    queuedSeasonRestart = {
      seasonId,
      withCountdown,
      beforeRestart,
      interludeDurationMs: options.interludeDurationMs,
      onInterludeStart: options.onInterludeStart,
      restartSeasonIndex: options.restartSeasonIndex,
    };
  };

  const queueSeasonIndexRestart = (
    seasonIndex: number,
    withCountdown = false,
    beforeRestart?: () => void | Promise<void>,
    options: {
      interludeDurationMs?: number;
      onInterludeStart?: () => void;
      restartSeasonIndex?: number;
    } = {},
  ) => {
    queuedSeasonEndAction = null;
    queuedSeasonRestart = {
      seasonIndex,
      withCountdown,
      beforeRestart,
      interludeDurationMs: options.interludeDurationMs,
      onInterludeStart: options.onInterludeStart,
      restartSeasonIndex: options.restartSeasonIndex,
    };
  };

  const queueSeasonEndAction = (
    seasonId: SeasonalCycleSeasonConfig["id"],
    onSeasonEnd: () => void,
  ) => {
    queuedSeasonRestart = null;
    queuedSeasonEndAction = {
      seasonId,
      onSeasonEnd,
    };
  };

  const queueSeasonIndexEndAction = (
    seasonIndex: number,
    onSeasonEnd: () => void,
  ) => {
    queuedSeasonRestart = null;
    queuedSeasonEndAction = {
      seasonIndex,
      onSeasonEnd,
    };
  };

  const cleanup = () => {
    clearAnimationFrame();
    clearInterludeRestartTimer();
    queuedSeasonRestart = null;
    queuedSeasonEndAction = null;
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    audioStore.stopSeasonalAudio();
    audioStore.resetBaseRhythmLoop();
    stopMovementPlayback();
    activeMovementKey = null;
    clearMovementDebug();
  };

  return {
    currentDate,
    currentBar,
    currentBeat,
    currentFrame,
    currentMovementSourceAspect,
    currentRepetition,
    currentSeason,
    currentSeasonIndex,
    countdownRemaining,
    elapsedMs,
    evaluationEnabled,
    isCountingDown,
    isCompleted,
    isTransition,
    movementDirection,
    playbackState,
    progress,
    repetitionIndex,
    seasonElapsedMs,
    seasonPhase,
    showInstructorAvatar,
    movementSourceFps,
    movementFrameCount,
    movementSourceDurationMs,
    movementPrerollMs: movementPrerollMsDebug,
    movementLoopStartMs,
    movementLoopEndMs,
    movementSourceTimeMs,
    movementLoopCount,
    movementLoaded,
    movementPlaying,
    configuredMovementId,
    movementIntensity,
    usingFallbackMovement,
    totalDurationMs,
    initialize,
    complete,
    pause,
    play,
    reset,
    restartSeason,
    restoreFullCycle,
    startCustomCycle,
    startSingleSeason,
    queueSeasonIndexEndAction,
    queueSeasonIndexRestart,
    queueSeasonEndAction,
    queueSeasonRestart,
    cleanup,
  };
};
