import { defineStore } from "pinia";
import { useAudioStore } from "~/store/audioStore";
import {
  buildPhaseSmoothedCycleTimeline,
  formatStoryDate,
  getStoryCycleStart,
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
const weightedStoryTimeline = buildPhaseSmoothedCycleTimeline(
  defaultStoryCycle,
  {
    year: defaultStoryStartYear,
  },
);
const playbackTickMs = 100;

let playbackTimer: ReturnType<typeof setInterval> | null = null;
let playbackStartedAtMs = 0;
let playbackStartElapsedMs = 0;

const getNowMs = () => Date.now();

const clearPlaybackTimer = () => {
  if (!playbackTimer) return;

  clearInterval(playbackTimer);
  playbackTimer = null;
};

const getBaseRhythmOffsetSeconds = (elapsedMs: number) => elapsedMs / 1000;

const setPlaybackAnchor = (date: StoryDateInput) => {
  playbackStartedAtMs = getNowMs();
  playbackStartElapsedMs = getWeightedStoryTimelineElapsedMsForDate(
    weightedStoryTimeline,
    date,
  );
};

export const useStoryPlaybackStore = defineStore("storyPlayback", {
  state: () => ({
    currentDate: defaultStoryStartDate,
    isPlaying: false,
  }),
  actions: {
    play() {
      if (this.isPlaying) return;

      const audioStore = useAudioStore();

      this.isPlaying = true;
      clearPlaybackTimer();
      playbackStartedAtMs = getNowMs();
      void audioStore.startBaseRhythmLoop(
        getBaseRhythmOffsetSeconds(playbackStartElapsedMs),
      );

      const updateCurrentDate = () => {
        const timelineDay = getWeightedStoryTimelineDayAtElapsedMs(
          weightedStoryTimeline,
          playbackStartElapsedMs + getNowMs() - playbackStartedAtMs,
        );

        if (!timelineDay) return;

        this.currentDate = timelineDay.date;
      };

      updateCurrentDate();
      playbackTimer = setInterval(updateCurrentDate, playbackTickMs);
    },
    pause() {
      const audioStore = useAudioStore();

      if (this.isPlaying) {
        playbackStartElapsedMs =
          (playbackStartElapsedMs + getNowMs() - playbackStartedAtMs) %
          STORY_CYCLE_DURATION_MS;
      }

      this.isPlaying = false;
      clearPlaybackTimer();
      audioStore.pauseBaseRhythmLoop();
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

      this.pause();
      audioStore.resetBaseRhythmLoop();
      this.currentDate = formatStoryDate(getStoryCycleStart(this.currentDate));
      setPlaybackAnchor(this.currentDate);
    },
    seekToDate(date: StoryDateInput) {
      const audioStore = useAudioStore();

      this.currentDate = formatStoryDate(date);
      setPlaybackAnchor(this.currentDate);

      if (this.isPlaying) {
        audioStore.pauseBaseRhythmLoop();
        void audioStore.startBaseRhythmLoop(
          getBaseRhythmOffsetSeconds(playbackStartElapsedMs),
        );
      }
    },
  },
});
