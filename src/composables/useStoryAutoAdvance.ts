import { ref } from "vue";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";

export const useStoryAutoAdvance = () => {
  const runtimeStore = useStoryRuntimeStore();
  const storyEngine = useStoryEngine();
  const advancing = ref(false);

  const advanceToNextAct = async () => {
    if (advancing.value) return;

    const nextActId = runtimeStore.currentAct?.nextActId;
    if (!nextActId) return;

    advancing.value = true;
    try {
      storyEngine.continueFromGate();
      await navigateTo(`/story/${nextActId}`);
    } finally {
      advancing.value = false;
    }
  };

  return {
    advanceToNextAct,
    advancing,
  };
};
