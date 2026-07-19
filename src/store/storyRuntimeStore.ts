import { defineStore } from "pinia";
import { getStoryAct } from "~/story/acts";
import type { StoryActId, StoryPlaybackState } from "~/story/types";

type StoryRuntimeState = {
  currentActId: StoryActId | null;
  currentSceneIndex: number;
  playbackState: StoryPlaybackState;
  elapsedSceneMs: number;
  showContinueGate: boolean;
};

const getInitialState = (): StoryRuntimeState => ({
  currentActId: null,
  currentSceneIndex: 0,
  playbackState: "idle",
  elapsedSceneMs: 0,
  showContinueGate: false,
});

export const useStoryRuntimeStore = defineStore("storyRuntime", {
  state: getInitialState,
  getters: {
    currentAct: (state) =>
      state.currentActId ? getStoryAct(state.currentActId) : null,
    currentScene: (state) => {
      if (!state.currentActId) return null;

      return (
        getStoryAct(state.currentActId).scenes[state.currentSceneIndex] ?? null
      );
    },
  },
  actions: {
    startStory(actId: StoryActId = "prologue") {
      this.currentActId = actId;
      this.currentSceneIndex = 0;
      this.playbackState = "playing";
      this.elapsedSceneMs = 0;
      this.showContinueGate = false;
    },
    setCurrentAct(actId: StoryActId) {
      this.startStory(actId);
    },
    setCurrentScene(sceneIndex: number) {
      if (!this.currentActId) return;

      const sceneCount = getStoryAct(this.currentActId).scenes.length;

      this.currentSceneIndex = Math.min(
        Math.max(sceneIndex, 0),
        Math.max(sceneCount - 1, 0),
      );
      this.elapsedSceneMs = 0;
    },
    play() {
      if (this.playbackState === "paused") {
        this.playbackState = "playing";
      }
    },
    pause() {
      if (this.playbackState === "playing") {
        this.playbackState = "paused";
      }
    },
    reset() {
      Object.assign(this, getInitialState());
    },
    tick(deltaMs: number) {
      if (this.playbackState !== "playing") return;

      this.elapsedSceneMs += deltaMs;
    },
    nextScene() {
      if (!this.currentActId) return;

      const sceneCount = getStoryAct(this.currentActId).scenes.length;

      if (this.currentSceneIndex < sceneCount - 1) {
        this.currentSceneIndex++;
        this.elapsedSceneMs = 0;
        return;
      }

      this.completeAct();
    },
    completeAct() {
      if (!this.currentActId) return;

      const currentAct = getStoryAct(this.currentActId);

      this.elapsedSceneMs = 0;

      if (currentAct.nextActId) {
        this.playbackState = "waiting-for-gate";
        this.showContinueGate = true;
        return;
      }

      this.playbackState = "completed";
      this.showContinueGate = false;
    },
    confirmContinueGate() {
      if (!this.currentActId || !this.showContinueGate) return;

      const currentAct = getStoryAct(this.currentActId);

      this.showContinueGate = false;

      if (!currentAct.nextActId) {
        this.playbackState = "completed";
        return;
      }

      this.startStory(currentAct.nextActId);
    },
  },
});
