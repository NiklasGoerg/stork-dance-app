import { ref, watch } from "vue";
import { useNarration } from "~/composables/narration/useNarration";
import { useStoryGestureStore } from "~/store/storyGestureStore";
import { getMigrationGestureFeedbackCatalogEntry } from "~/utils/migrationActs/gestureFeedback";
import { resolveMigrationActNarrationCue } from "~/utils/migrationActs/narrationCatalog";

export const useMigrationGestureNarration = () => {
  const narration = useNarration();
  const store = useStoryGestureStore();
  const handledResultIds = new Set<string>();
  const enabled = ref(true);
  const stopWatch = watch(
    () => store.latestEvaluationResult,
    (result) => {
      if (!enabled.value || !result || handledResultIds.has(result.id)) return;
      handledResultIds.add(result.id);
      if (result.status === "success") {
        const cue = resolveMigrationActNarrationCue(
          result.gestureId === "departure"
            ? "act4.departure.success"
            : "act4.arrival.success",
        );
        void narration.speakText(cue.text, { behavior: "replace" });
        return;
      }

      const cueId = getMigrationGestureFeedbackCatalogEntry(
        result.primaryFeedbackCode,
      )?.narrationKey;
      if (cueId) void narration.play(cueId, { behavior: "replace" });
    },
  );

  const setEnabled = (nextEnabled: boolean) => {
    enabled.value = nextEnabled;
    if (!nextEnabled) narration.stop();
  };

  const cleanup = () => {
    stopWatch();
    narration.stop();
    handledResultIds.clear();
  };

  return { cleanup, setEnabled };
};
