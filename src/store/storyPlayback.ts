import { defineStore } from "pinia";
import {
  buildGlobalWeightedCalendarTimeline,
  formatStoryDate,
  getStoryCycleStart,
  getWeightedStoryTimelineDayAtElapsedMs,
  getWeightedStoryTimelineElapsedMsForDate,
  STORY_CYCLE_DURATION_MS,
  type StoryDateInput,
} from "~/utils/storyCycle";

const defaultStoryStartYear = 2022;
const defaultStoryStartDate = `${defaultStoryStartYear}-06-01`;
const weightedStoryTimeline = buildGlobalWeightedCalendarTimeline(
  defaultStoryStartYear,
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

      this.isPlaying = true;
      clearPlaybackTimer();
      playbackStartedAtMs = getNowMs();

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
      if (this.isPlaying) {
        playbackStartElapsedMs =
          (playbackStartElapsedMs + getNowMs() - playbackStartedAtMs) %
          STORY_CYCLE_DURATION_MS;
      }

      this.isPlaying = false;
      clearPlaybackTimer();
    },
    togglePlayback() {
      if (this.isPlaying) {
        this.pause();
        return;
      }

      this.play();
    },
    resetToStoryStart() {
      this.pause();
      this.currentDate = formatStoryDate(getStoryCycleStart(this.currentDate));
      setPlaybackAnchor(this.currentDate);
    },
    seekToDate(date: StoryDateInput) {
      this.currentDate = formatStoryDate(date);
      setPlaybackAnchor(this.currentDate);
    },
  },
});
