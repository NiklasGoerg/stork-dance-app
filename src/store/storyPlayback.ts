import { defineStore } from "pinia";
import { useAudioStore } from "~/store/audioStore";
import type { StorkStoryCycleDefinition } from "~/types/stork";
import {
  buildPhaseSmoothedCycleTimeline,
  formatStoryDate,
  getWeightedStoryTimelineDayAtElapsedMs,
  getWeightedStoryTimelineElapsedMsForDate,
  STORY_CYCLE_DURATION_MS,
  type StoryDateInput,
} from "~/utils/storyCycle";
import { storyCycleDefinitions } from "~/utils/storkStoryCycles";

const defaultStoryStartYear = 2022;
const defaultStoryStartDate = `${defaultStoryStartYear}-06-01`;
const defaultStoryCycle = storyCycleDefinitions.find(
  (cycle) => cycle.targetYear === defaultStoryStartYear,
);
const playbackTickMs = 100;

let activeStoryTimeline = buildPhaseSmoothedCycleTimeline(defaultStoryCycle, {
  year: defaultStoryStartYear,
});
let playbackTimer: ReturnType<typeof setInterval> | null = null;
let playbackStartedAtMs = 0;
let playbackStartElapsedMs = 0;

const getNowMs = () => Date.now();

const clearPlaybackTimer = () => {
  if (!playbackTimer) return;

  clearInterval(playbackTimer);
  playbackTimer = null;
};

const getActiveCycleDurationMs = () =>
  activeStoryTimeline[activeStoryTimeline.length - 1]?.endMs ??
  STORY_CYCLE_DURATION_MS;

const getBaseRhythmOffsetSeconds = (elapsedMs: number) => elapsedMs / 1000;

const getCurrentPlaybackElapsedMs = () =>
  playbackStartElapsedMs +
  (playbackTimer ? getNowMs() - playbackStartedAtMs : 0);

const getTimelineDateAtElapsedMs = (elapsedMs: number) => {
  const cycleDurationMs = getActiveCycleDurationMs();
  const lastDay = activeStoryTimeline[activeStoryTimeline.length - 1];

  if (
    lastDay &&
    elapsedMs >= cycleDurationMs &&
    elapsedMs - cycleDurationMs < playbackTickMs
  ) {
    return lastDay.date;
  }

  return (
    getWeightedStoryTimelineDayAtElapsedMs(activeStoryTimeline, elapsedMs)
      ?.date ?? defaultStoryStartDate
  );
};

const setPlaybackAnchor = (elapsedMs: number) => {
  playbackStartedAtMs = getNowMs();
  playbackStartElapsedMs = elapsedMs;
};

const getCycleStartDate = (
  cycle: StorkStoryCycleDefinition | null | undefined,
) => `${cycle?.targetYear ?? defaultStoryStartYear}-06-01`;

export const useStoryPlaybackStore = defineStore("storyPlayback", {
  state: () => ({
    activeCycleId: defaultStoryCycle?.label ?? "default-story-cycle",
    currentDate: defaultStoryStartDate,
    currentElapsedMs: 0,
    cycleDurationMs: getActiveCycleDurationMs(),
    isPlaying: false,
    isSeeking: false,
    seekRevision: 0,
    playbackSessionId: 0,
    pauseReasons: [] as string[],
  }),
  getters: {
    isStoryPlaybackPaused: (state) => state.pauseReasons.length > 0,
  },
  actions: {
    // Updates public date and elapsed state from the active weighted timeline.
    syncCurrentDateFromElapsed(elapsedMs: number) {
      this.currentElapsedMs = elapsedMs;
      this.currentDate = getTimelineDateAtElapsedMs(elapsedMs);
      this.cycleDurationMs = getActiveCycleDurationMs();
    },
    // Selects the curated cycle that drives the stage story playback.
    configureCycle(cycle: StorkStoryCycleDefinition) {
      const audioStore = useAudioStore();

      clearPlaybackTimer();
      activeStoryTimeline = buildPhaseSmoothedCycleTimeline(cycle, {
        year: cycle.targetYear,
      });
      setPlaybackAnchor(0);

      this.$patch({
        activeCycleId: cycle.label,
        currentDate: getCycleStartDate(cycle),
        currentElapsedMs: 0,
        cycleDurationMs: getActiveCycleDurationMs(),
        isPlaying: false,
        isSeeking: false,
        seekRevision: this.seekRevision + 1,
        playbackSessionId: this.playbackSessionId + 1,
        pauseReasons: [],
      });

      audioStore.pauseBaseRhythmLoop();
      audioStore.resetBaseRhythmLoop();
    },
    play() {
      if (this.isPlaying) return;

      const audioStore = useAudioStore();

      this.pauseReasons = [];
      this.isPlaying = true;
      clearPlaybackTimer();
      playbackStartedAtMs = getNowMs();
      void audioStore.startBaseRhythmLoop(
        getBaseRhythmOffsetSeconds(playbackStartElapsedMs),
      );

      const updateCurrentDate = () => {
        this.syncCurrentDateFromElapsed(getCurrentPlaybackElapsedMs());
      };

      updateCurrentDate();
      playbackTimer = setInterval(updateCurrentDate, playbackTickMs);
    },
    pause() {
      const audioStore = useAudioStore();

      if (this.isPlaying) {
        setPlaybackAnchor(getCurrentPlaybackElapsedMs());
      }

      this.syncCurrentDateFromElapsed(playbackStartElapsedMs);
      this.isPlaying = false;
      clearPlaybackTimer();
      audioStore.pauseBaseRhythmLoop();
    },
    pauseStoryPlayback(reason = "manual") {
      const wasPlaying = this.isPlaying;

      if (!this.pauseReasons.includes(reason)) {
        this.pauseReasons.push(reason);
      }

      if (this.isPlaying) {
        setPlaybackAnchor(getCurrentPlaybackElapsedMs());
      }

      this.syncCurrentDateFromElapsed(playbackStartElapsedMs);
      this.isPlaying = false;
      clearPlaybackTimer();

      return wasPlaying;
    },
    // Freezes story playback at an exact timeline boundary before a gesture runs.
    pauseStoryPlaybackAtElapsedMs(elapsedMs: number, reason = "manual") {
      const wasPlaying = this.isPlaying;

      if (!this.pauseReasons.includes(reason)) {
        this.pauseReasons.push(reason);
      }

      setPlaybackAnchor(elapsedMs);
      this.syncCurrentDateFromElapsed(playbackStartElapsedMs);
      this.isPlaying = false;
      clearPlaybackTimer();

      return wasPlaying;
    },
    resumeStoryPlayback(reason = "manual") {
      this.pauseReasons = this.pauseReasons.filter(
        (pauseReason) => pauseReason !== reason,
      );

      if (this.pauseReasons.length > 0 || this.isPlaying) return;

      this.isPlaying = true;
      clearPlaybackTimer();
      playbackStartedAtMs = getNowMs();

      const updateCurrentDate = () => {
        this.syncCurrentDateFromElapsed(getCurrentPlaybackElapsedMs());
      };

      updateCurrentDate();
      playbackTimer = setInterval(updateCurrentDate, playbackTickMs);
    },
    releaseStoryPlaybackPause(reason = "manual") {
      this.pauseReasons = this.pauseReasons.filter(
        (pauseReason) => pauseReason !== reason,
      );
    },
    togglePlayback() {
      if (this.isPlaying) {
        this.pause();
        return;
      }

      this.play();
    },
    resetToStoryStart() {
      const audioStore = useAudioStore();

      this.pauseReasons = [];
      this.pause();
      audioStore.resetBaseRhythmLoop();
      setPlaybackAnchor(0);
      this.syncCurrentDateFromElapsed(0);
      this.seekRevision++;
      this.playbackSessionId++;
    },
    seekToElapsedMs(elapsedMs: number, options: { manual?: boolean } = {}) {
      const audioStore = useAudioStore();

      this.isSeeking = Boolean(options.manual);
      setPlaybackAnchor(elapsedMs);
      this.syncCurrentDateFromElapsed(playbackStartElapsedMs);

      if (options.manual) {
        this.seekRevision++;
        this.isSeeking = false;
      }

      if (this.isPlaying) {
        audioStore.pauseBaseRhythmLoop();
        void audioStore.startBaseRhythmLoop(
          getBaseRhythmOffsetSeconds(playbackStartElapsedMs),
        );
      }
    },
    seekToDate(date: StoryDateInput) {
      const elapsedMs = getWeightedStoryTimelineElapsedMsForDate(
        activeStoryTimeline,
        formatStoryDate(date),
      );

      this.seekToElapsedMs(elapsedMs, { manual: true });
    },
  },
});
