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
import { resolveNextGuidedBarBoundary } from "~/utils/act2/guidedTiming";

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
  afterRestart?: () => void | Promise<void>;
  interludeDurationMs?: number;
  onInterludeStart?: () => void;
  preserveBaseRhythm?: boolean;
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
  const explanationPreviewLoopDurationMs = computed(
    () => activeConfig.value.barDurationMs * 2,
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
  let interludeRestartRequest: QueuedSeasonRestart | null = null;
  let interludeRestartStartedAtMs = 0;
  let interludeRestartRemainingMs = 0;
  let explanationPreviewSeasonIndex: number | null = null;
  let explanationPreviewStartedAtTransportMs: number | null = null;
  let explanationPreviewWaitRevision = 0;
  let barBoundaryWaitRevision = 0;
  let pausedPlaybackState: SeasonalCyclePlaybackState | null = null;

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
        playbackState.value === "countdown" ||
        playbackState.value === "previewing"),
  );
  const showInstructorAvatar = computed(
    () =>
      playbackState.value === "previewing" ||
      ((playbackState.value === "countdown" ||
        playbackState.value === "playing") &&
        timelineMs.value >= -movementPrerollMs.value),
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

  const clearInterludeRestart = () => {
    clearInterludeRestartTimer();
    interludeRestartRequest = null;
    interludeRestartStartedAtMs = 0;
    interludeRestartRemainingMs = 0;
  };

  const completeInterludeRestart = () => {
    const restartRequest = interludeRestartRequest;

    clearInterludeRestart();
    if (restartRequest) void restartQueuedSeason(restartRequest);
  };

  const scheduleInterludeRestart = (
    restartRequest: QueuedSeasonRestart,
    durationMs: number,
  ) => {
    clearInterludeRestartTimer();
    interludeRestartRequest = restartRequest;
    interludeRestartRemainingMs = Math.max(0, durationMs);
    interludeRestartStartedAtMs = performance.now();
    interludeRestartTimer = setTimeout(
      completeInterludeRestart,
      interludeRestartRemainingMs,
    );
  };

  const pauseInterludeRestart = () => {
    if (!interludeRestartRequest) return;

    if (interludeRestartTimer) {
      clearTimeout(interludeRestartTimer);
      interludeRestartTimer = null;
      interludeRestartRemainingMs = Math.max(
        0,
        interludeRestartRemainingMs -
          (performance.now() - interludeRestartStartedAtMs),
      );
    }
  };

  const resumeInterludeRestart = () => {
    if (!interludeRestartRequest || interludeRestartTimer) return;

    interludeRestartStartedAtMs = performance.now();
    interludeRestartTimer = setTimeout(
      completeInterludeRestart,
      interludeRestartRemainingMs,
    );
  };

  const clearExplanationPreview = () => {
    explanationPreviewWaitRevision++;
    explanationPreviewSeasonIndex = null;
    explanationPreviewStartedAtTransportMs = null;
  };

  const clearBarBoundaryWaits = () => {
    barBoundaryWaitRevision++;
  };

  const restartQueuedSeason = async (request: QueuedSeasonRestart) => {
    await request.beforeRestart?.();
    await restartSeason(
      request.seasonId,
      request.withCountdown,
      request.restartSeasonIndex ?? request.seasonIndex,
      { preserveBaseRhythm: request.preserveBaseRhythm },
    );
    await request.afterRestart?.();
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
          `[Act4] Movement "${season.configuredMovementId ?? movementKey}" could not be loaded from ${season.movementUrl}; Act 4 will continue without the instructor clip.`,
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
    if (
      playbackState.value === "previewing" &&
      explanationPreviewSeasonIndex !== null
    ) {
      const season = activeConfig.value.seasons[explanationPreviewSeasonIndex];
      if (!season) return;

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

      const prerollMs = getSeasonMovementPrerollMs(
        season,
        movementPrerollMs.value,
      );
      const timing = season.movementTiming ?? {
        sourceFps: 30,
        prerollMs,
        loopStartMs: prerollMs,
        loopEndMs:
          prerollMs +
          getSeasonMovementLoopDurationMs(
            season,
            activeConfig.value.barDurationMs,
          ),
      };
      const previewElapsedMs =
        ((audioStore.getBaseRhythmTransportTimeMs() -
          (explanationPreviewStartedAtTransportMs ?? 0)) %
          explanationPreviewLoopDurationMs.value) +
        timing.prerollMs;
      const position = resolveMovementPlaybackPosition({
        elapsedMs: previewElapsedMs,
        sourceDurationMs: movement.durationMs,
        timing,
      });

      updateMovementDebug(season, movement);
      movementSourceTimeMs.value = position.sourceTimeMs;
      movementLoopCount.value = position.loopCount;
      seekToTime(position.sourceTimeMs);
      return;
    }

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
    clearInterludeRestart();
    clearExplanationPreview();
    clearBarBoundaryWaits();
    queuedSeasonRestart = null;
    queuedSeasonEndAction = null;
    timelineMs.value = totalDurationMs.value;
    playbackState.value = "completed";
    pausedPlaybackState = null;
    audioLockedAfterCompletion = true;
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    audioStore.stopSeasonalAudio();
    audioStore.setSeasonalAudioVolume(1, 0);
    audioStore.resetBaseRhythmLoop();
    syncStoryClock();
    await seekMovementFromProgress();
  };

  const tick = () => {
    if (
      playbackState.value !== "countdown" &&
      playbackState.value !== "playing" &&
      playbackState.value !== "previewing"
    ) {
      return;
    }

    const nextTimelineMs =
      playbackStartedFromMs + performance.now() - playbackStartedAtMs;

    if (playbackState.value === "previewing") {
      const previewTransportMs =
        audioStore.getBaseRhythmTransportTimeMs() -
        (explanationPreviewStartedAtTransportMs ?? 0);

      timelineMs.value =
        previewTransportMs % explanationPreviewLoopDurationMs.value;
      void seekMovementFromProgress();
      animationFrameId = requestAnimationFrame(tick);
      return;
    }

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
          scheduleInterludeRestart(
            restartRequest,
            restartRequest.interludeDurationMs ?? 0,
          );
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
    clearInterludeRestart();
    clearExplanationPreview();
    clearBarBoundaryWaits();
    queuedSeasonRestart = null;
    queuedSeasonEndAction = null;
    audioLockedAfterCompletion = false;
    playbackState.value = "idle";
    pausedPlaybackState = null;
    timelineMs.value = 0;
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    hasRestartedBaseRhythmForCycle = false;
    await loadAssets();
    audioStore.stopSeasonalAudio();
    audioStore.setSeasonalAudioVolume(1, 0);
    audioStore.resetBaseRhythmLoop();
    await seekToTimeline(0);
  };

  const play = async () => {
    if (
      playbackState.value === "countdown" ||
      playbackState.value === "playing" ||
      playbackState.value === "previewing"
    ) {
      return;
    }

    if (playbackState.value === "completed") {
      await reset();
    } else {
      await loadAssets();
    }

    if (
      playbackState.value === "paused" &&
      pausedPlaybackState === "previewing" &&
      explanationPreviewSeasonIndex !== null
    ) {
      playbackState.value = "previewing";
      pausedPlaybackState = null;
      playbackStartedAtMs = performance.now();
      playbackStartedFromMs = timelineMs.value;
      activeAudioSeasonId = null;
      activeAudioSeasonIndex = null;
      audioStore.stopSeasonalAudio();
      audioStore.setSeasonalAudioVolume(1, 0);
      await audioStore.startBaseRhythmLoop(
        audioStore.baseRhythmLoop.currentOffsetSeconds,
      );
      clearAnimationFrame();
      animationFrameId = requestAnimationFrame(tick);
      return;
    }

    if (playbackState.value === "paused" && interludeRestartRequest) {
      playbackState.value = pausedPlaybackState ?? "playing";
      pausedPlaybackState = null;
      resumeInterludeRestart();
      return;
    }

    const nextStartedFromMs =
      playbackState.value === "idle" && timelineMs.value === 0
        ? -countdownDurationMs.value
        : timelineMs.value;

    timelineMs.value = nextStartedFromMs;
    pausedPlaybackState = null;
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
      playbackState.value !== "playing" &&
      playbackState.value !== "previewing"
    ) {
      return;
    }

    clearAnimationFrame();
    pauseInterludeRestart();
    pausedPlaybackState = playbackState.value;
    playbackState.value = "paused";
    audioStore.pauseSeasonalAudio();
    audioStore.pauseBaseRhythmLoop();
  };

  const reset = async () => {
    clearAnimationFrame();
    clearInterludeRestart();
    clearExplanationPreview();
    clearBarBoundaryWaits();
    queuedSeasonRestart = null;
    queuedSeasonEndAction = null;
    audioLockedAfterCompletion = false;
    playbackState.value = "idle";
    pausedPlaybackState = null;
    timelineMs.value = 0;
    activeMovementKey = null;
    clearMovementDebug();
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    hasRestartedBaseRhythmForCycle = false;
    audioStore.stopSeasonalAudio();
    audioStore.setSeasonalAudioVolume(1, 0);
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
    clearInterludeRestart();
    clearExplanationPreview();
    clearBarBoundaryWaits();
    queuedSeasonRestart = null;
    queuedSeasonEndAction = null;
    activeConfig.value = config;
    await reset();
  };

  const prepareCustomCycle = async (nextConfig: SeasonalCycleConfig) => {
    clearAnimationFrame();
    clearInterludeRestart();
    clearExplanationPreview();
    clearBarBoundaryWaits();
    queuedSeasonRestart = null;
    queuedSeasonEndAction = null;
    audioLockedAfterCompletion = false;
    activeConfig.value = nextConfig;
    playbackState.value = "idle";
    pausedPlaybackState = null;
    timelineMs.value = 0;
    activeMovementKey = null;
    clearMovementDebug();
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    hasRestartedBaseRhythmForCycle = false;
    audioStore.stopSeasonalAudio();
    audioStore.setSeasonalAudioVolume(1, 0);
    audioStore.resetBaseRhythmLoop();
    await loadAssets();
    await seekToTimeline(0);
  };

  const playFromTimeline = async (
    nextTimelineMs: number,
    withCountdown = false,
  ) => {
    await loadAssets();
    if (audioLockedAfterCompletion) return;

    clearAnimationFrame();
    clearExplanationPreview();
    clearBarBoundaryWaits();
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    hasRestartedBaseRhythmForCycle =
      nextTimelineMs > 0 || audioStore.baseRhythmLoop.isPlaying;

    const nextStartedFromMs = withCountdown
      ? nextTimelineMs - countdownDurationMs.value
      : nextTimelineMs;

    timelineMs.value = nextStartedFromMs;
    playbackState.value = nextStartedFromMs < 0 ? "countdown" : "playing";
    pausedPlaybackState = null;
    playbackStartedAtMs = performance.now();
    playbackStartedFromMs = nextStartedFromMs;

    await audioStore.startBaseRhythmLoop(
      timelineMs.value < 0
        ? (countdownDurationMs.value + timelineMs.value) / 1000
        : elapsedMs.value / 1000,
    );
    audioStore.setSeasonalAudioVolume(1, 0.25);
    await syncSeasonalAudio();
    animationFrameId = requestAnimationFrame(tick);
  };

  const waitForExplanationPreviewBars = (bars = 2) => {
    if (
      playbackState.value !== "previewing" ||
      explanationPreviewStartedAtTransportMs === null
    ) {
      return Promise.resolve();
    }

    const barCount = Math.max(1, Math.round(bars));
    const beatDurationMs = audioStore.getBeatDurationMs();
    const barDurationMs = beatDurationMs * 4;
    const waitRevision = explanationPreviewWaitRevision;
    let targetTransportMs: number | null = null;

    return new Promise<void>((resolve) => {
      const checkTransport = () => {
        if (waitRevision !== explanationPreviewWaitRevision) {
          resolve();
          return;
        }

        const waitingForPausedPreview =
          playbackState.value === "paused" &&
          pausedPlaybackState === "previewing";

        if (playbackState.value !== "previewing" && !waitingForPausedPreview) {
          resolve();
          return;
        }

        if (!audioStore.baseRhythmLoop.isPlaying) {
          setTimeout(checkTransport, 50);
          return;
        }

        const transportMs = audioStore.getBaseRhythmTransportTimeMs();
        if (targetTransportMs === null) {
          const minimumBoundaryMs = resolveNextGuidedBarBoundary(
            explanationPreviewStartedAtTransportMs! + barDurationMs * barCount,
            beatDurationMs,
            true,
          );
          targetTransportMs =
            transportMs <= minimumBoundaryMs + 40
              ? minimumBoundaryMs
              : resolveNextGuidedBarBoundary(transportMs, beatDurationMs, true);
        }

        const waitMs = targetTransportMs - transportMs;
        if (waitMs <= 40) {
          resolve();
          return;
        }

        setTimeout(checkTransport, Math.min(Math.round(waitMs), 100));
      };

      checkTransport();
    });
  };

  const waitForNextBarBoundary = () => {
    const beatDurationMs = audioStore.getBeatDurationMs();
    const waitRevision = barBoundaryWaitRevision;
    let targetTransportMs: number | null = null;

    return new Promise<void>((resolve) => {
      const checkTransport = () => {
        if (waitRevision !== barBoundaryWaitRevision) {
          resolve();
          return;
        }

        const isPlayableState =
          playbackState.value === "countdown" ||
          playbackState.value === "playing" ||
          playbackState.value === "previewing" ||
          playbackState.value === "paused";

        if (!isPlayableState) {
          resolve();
          return;
        }

        if (!audioStore.baseRhythmLoop.isPlaying) {
          setTimeout(checkTransport, 50);
          return;
        }

        const transportMs = audioStore.getBaseRhythmTransportTimeMs();
        targetTransportMs ??= resolveNextGuidedBarBoundary(
          transportMs,
          beatDurationMs,
          true,
        );

        const waitMs = targetTransportMs - transportMs;
        if (waitMs <= 40) {
          resolve();
          return;
        }

        setTimeout(checkTransport, Math.min(Math.round(waitMs), 100));
      };

      checkTransport();
    });
  };

  const startExplanationPreview = async (seasonIndex: number) => {
    if (audioLockedAfterCompletion) return;

    clearAnimationFrame();
    clearInterludeRestart();
    clearBarBoundaryWaits();
    queuedSeasonRestart = null;
    queuedSeasonEndAction = null;
    explanationPreviewSeasonIndex = seasonIndex;
    playbackState.value = "previewing";
    pausedPlaybackState = null;
    playbackStartedAtMs = performance.now();
    playbackStartedFromMs = 0;
    timelineMs.value = 0;
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    hasRestartedBaseRhythmForCycle = false;
    audioStore.stopSeasonalAudio();
    audioStore.setSeasonalAudioVolume(1, 0);
    await loadAssets();
    await audioStore.startBaseRhythmLoop(0);
    explanationPreviewStartedAtTransportMs =
      audioStore.getBaseRhythmTransportTimeMs();
    await seekMovementFromProgress();
    animationFrameId = requestAnimationFrame(tick);
  };

  const startPreparedCycleFromIndex = async (
    seasonIndex: number,
    withCountdown = false,
  ) => {
    await playFromTimeline(
      seasonIndex * activeConfig.value.seasonDurationMs,
      withCountdown,
    );
  };

  const startSingleSeason = async (
    seasonId: SeasonalCycleSeasonConfig["id"],
  ) => {
    clearAnimationFrame();
    clearInterludeRestart();
    clearExplanationPreview();
    clearBarBoundaryWaits();
    queuedSeasonRestart = null;
    queuedSeasonEndAction = null;
    audioLockedAfterCompletion = false;
    activeConfig.value = getSingleSeasonConfig(seasonId);
    playbackState.value = "idle";
    pausedPlaybackState = null;
    timelineMs.value = 0;
    activeMovementKey = null;
    clearMovementDebug();
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    hasRestartedBaseRhythmForCycle = false;
    audioStore.stopSeasonalAudio();
    audioStore.setSeasonalAudioVolume(1, 0);
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
    clearInterludeRestart();
    clearExplanationPreview();
    clearBarBoundaryWaits();
    queuedSeasonRestart = null;
    queuedSeasonEndAction = null;
    audioLockedAfterCompletion = false;
    activeConfig.value = nextConfig;
    playbackState.value = "idle";
    pausedPlaybackState = null;
    timelineMs.value = 0;
    activeMovementKey = null;
    clearMovementDebug();
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    hasRestartedBaseRhythmForCycle = false;
    audioStore.stopSeasonalAudio();
    audioStore.setSeasonalAudioVolume(1, 0);
    audioStore.resetBaseRhythmLoop();
    await loadAssets();
    await seekToTimeline(0);
    await playFromTimeline(0, withCountdown);
  };

  const restartSeason = async (
    seasonId?: SeasonalCycleSeasonConfig["id"],
    withCountdown = true,
    seasonIndexOverride?: number,
    options: { preserveBaseRhythm?: boolean } = {},
  ) => {
    if (audioLockedAfterCompletion) return;

    clearInterludeRestart();
    clearExplanationPreview();
    clearBarBoundaryWaits();
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
    hasRestartedBaseRhythmForCycle =
      nextTimelineMs > 0 || options.preserveBaseRhythm === true;
    audioStore.stopSeasonalAudio();
    audioStore.setSeasonalAudioVolume(1, 0.25);
    if (!options.preserveBaseRhythm) {
      audioStore.resetBaseRhythmLoop();
    }
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
      preserveBaseRhythm?: boolean;
      afterRestart?: () => void | Promise<void>;
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
      preserveBaseRhythm: options.preserveBaseRhythm,
      afterRestart: options.afterRestart,
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
      preserveBaseRhythm?: boolean;
      afterRestart?: () => void | Promise<void>;
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
      preserveBaseRhythm: options.preserveBaseRhythm,
      afterRestart: options.afterRestart,
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

  const cancelQueuedSeasonRestart = () => {
    clearInterludeRestart();
    queuedSeasonRestart = null;
  };

  const cleanup = () => {
    clearAnimationFrame();
    clearInterludeRestart();
    clearExplanationPreview();
    clearBarBoundaryWaits();
    queuedSeasonRestart = null;
    queuedSeasonEndAction = null;
    activeAudioSeasonId = null;
    activeAudioSeasonIndex = null;
    audioStore.stopSeasonalAudio();
    audioStore.setSeasonalAudioVolume(1, 0);
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
    prepareCustomCycle,
    startExplanationPreview,
    waitForExplanationPreviewBars,
    startPreparedCycleFromIndex,
    startCustomCycle,
    startSingleSeason,
    waitForNextBarBoundary,
    queueSeasonIndexEndAction,
    queueSeasonIndexRestart,
    queueSeasonEndAction,
    queueSeasonRestart,
    cancelQueuedSeasonRestart,
    cleanup,
  };
};
