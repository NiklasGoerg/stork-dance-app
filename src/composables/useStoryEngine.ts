import { computed } from "vue";
import { getStoryAct } from "~/story/acts";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import type { StoryActId } from "~/story/types";
import { useStoryEvents } from "~/composables/useStoryEvents";

let sceneTimer: ReturnType<typeof setTimeout> | null = null;

const clearSceneTimer = () => {
  if (!sceneTimer) return;

  clearTimeout(sceneTimer);
  sceneTimer = null;
};

export const useStoryEngine = () => {
  const runtimeStore = useStoryRuntimeStore();
  const { emitStoryEvent } = useStoryEvents();

  const currentAct = computed(() => runtimeStore.currentAct);
  const currentScene = computed(() => runtimeStore.currentScene);

  const loadActConfig = (actId: StoryActId) => getStoryAct(actId);

  const scheduleCurrentScene = () => {
    clearSceneTimer();

    const scene = runtimeStore.currentScene;

    if (!scene?.durationMs || runtimeStore.playbackState !== "playing") return;

    sceneTimer = setTimeout(() => {
      goToNextScene();
    }, scene.durationMs);
  };

  const startAct = (actId: StoryActId) => {
    runtimeStore.startStory(actId);
    scheduleCurrentScene();
  };

  const goToNextScene = () => {
    const activeActId = runtimeStore.currentActId;

    if (!activeActId) return;

    runtimeStore.nextScene();

    if (runtimeStore.playbackState === "waiting-for-gate") {
      emitStoryEvent({ type: "act.completed", actId: activeActId });
      return;
    }

    scheduleCurrentScene();
  };

  const pauseStory = () => {
    clearSceneTimer();
    runtimeStore.pause();
  };

  const resumeStory = () => {
    runtimeStore.play();
    scheduleCurrentScene();
  };

  const resetStory = () => {
    clearSceneTimer();
    runtimeStore.reset();
  };

  const continueFromGate = () => {
    const activeActId = runtimeStore.currentActId;

    if (activeActId) {
      emitStoryEvent({ type: "gate.continue", actId: activeActId });
    }

    runtimeStore.confirmContinueGate();
    scheduleCurrentScene();
  };

  const stopStoryEngine = () => {
    clearSceneTimer();
  };

  return {
    currentAct,
    currentScene,
    loadActConfig,
    startAct,
    goToNextScene,
    pauseStory,
    resumeStory,
    resetStory,
    continueFromGate,
    stopStoryEngine,
  };
};
