import { defineStore } from "pinia";
import {
  formatStoryDate,
  getNextStoryDate,
  getStoryCycleStart,
  type StoryDateInput,
} from "~/utils/storyCycle";

const defaultStoryStartDate = "2022-06-01";

let playbackTimer: ReturnType<typeof setInterval> | null = null;

const clearPlaybackTimer = () => {
  if (!playbackTimer) return;

  clearInterval(playbackTimer);
  playbackTimer = null;
};

export const useStoryPlaybackStore = defineStore("storyPlayback", {
  state: () => ({
    currentDate: defaultStoryStartDate,
    isPlaying: false,
    dayDurationMs: 100,
  }),
  actions: {
    play() {
      if (this.isPlaying) return;

      this.isPlaying = true;
      clearPlaybackTimer();

      playbackTimer = setInterval(() => {
        this.currentDate = formatStoryDate(getNextStoryDate(this.currentDate));
      }, this.dayDurationMs);
    },
    pause() {
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
    },
    seekToDate(date: StoryDateInput) {
      this.currentDate = formatStoryDate(date);
    },
  },
});
