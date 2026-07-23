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
  const totalDurationMs = getSeasonalCycleDurationMs(config);
  const countdownDurationMs = config.countdownDurationMs ?? 0;
  const movementPrerollMs = config.movementPrerollMs ?? 0;

  let animationFrameId = 0;
  let playbackStartedAtMs = 0;
  let playbackStartedFromMs = 0;
  let activeMovementSeasonId: string | null = null;
  let activeAudioSeasonId: string | null = null;
  let hasRestartedBaseRhythmForCycle = false;

  const progress = computed(() =>
    getSeasonalCycleProgress(config, elapsedMs.value),
  );
  const elapsedMs = computed(() =>
    Math.min(Math.max(timelineMs.value, 0), totalDurationMs),
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
      cycleDurationMs: totalDurationMs,
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
    config.seasons[(seasonIndex + 1) % config.seasons.length] ??
    config.seasons[0];

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

  const loadAssets = async () => {
    await Promise.all([
      ...config.seasons.map(loadSeasonMovement),
      audioStore.preloadSeasonalAudio(
        config.seasons.map((season) => ({
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
      if (timelineMs.value >= -movementPrerollMs) {
        await showMovementFirstFrame(config.seasons[0]);
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

    const barElapsedMs = currentProgress.seasonElapsedMs % config.barDurationMs;
    const movementStartMs = Math.min(movementPrerollMs, movement.durationMs);
    const movementDurationMs = Math.max(
      movement.durationMs - movementStartMs,
      1,
    );
    const movementTimeMs =
      movementStartMs +
      (barElapsedMs / config.barDurationMs) * movementDurationMs;

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
      totalDurationMs,
    );
    syncStoryClock();
    await seekMovementFromProgress();
  };

  const complete = async () => {
    clearAnimationFrame();
    timelineMs.value = totalDurationMs;
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

    if (nextTimelineMs >= totalDurationMs) {
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

  const cleanup = () => {
    clearAnimationFrame();
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
    cleanup,
  };
};
