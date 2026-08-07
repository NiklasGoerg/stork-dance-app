import { computed, ref } from "vue";
import type { NarrationResult, NarrationSpeakOptions } from "~/types/narration";
import {
  migrationActNarrationCatalog,
  type MigrationActNarrationId,
} from "~/utils/migrationActs/narrationCatalog";

type MigrationActNarrationService = {
  speakText?: (
    text: string,
    options?: Pick<NarrationSpeakOptions, "behavior" | "onStart" | "onEnd">,
  ) => Promise<NarrationResult> | NarrationResult;
  stop: () => void;
};

export const useMigrationActNarration = (
  narration?: MigrationActNarrationService,
) => {
  const currentId = ref<MigrationActNarrationId | null>(null);
  const currentTitle = ref("");
  const currentText = ref("");
  const lastResult = ref<NarrationResult | null>(null);
  let token = 0;

  const present = async (id: MigrationActNarrationId) => {
    const cue = migrationActNarrationCatalog[id];
    if (!cue.enabled) {
      lastResult.value = { status: "skipped" };
      return lastResult.value;
    }

    const cueToken = ++token;
    currentId.value = id;
    currentTitle.value = cue.title;
    currentText.value = cue.text;

    if (!cue.speak || !narration?.speakText) {
      lastResult.value = {
        status: narration?.speakText ? "skipped" : "disabled",
      };
      return lastResult.value;
    }

    try {
      const result = await narration.speakText(cue.text, {
        behavior: "replace",
      });
      if (cueToken === token) lastResult.value = result;
      return result;
    } catch (error) {
      const result = { status: "error", error } satisfies NarrationResult;
      if (cueToken === token) lastResult.value = result;
      return result;
    }
  };

  const stop = () => {
    token++;
    narration?.stop();
    lastResult.value = { status: "cancelled" };
  };

  return {
    present,
    stop,
    panelContent: computed(() => ({
      id: currentId.value,
      title: currentTitle.value,
      text: currentText.value,
    })),
    diagnostics: computed(() => ({
      currentId: currentId.value,
      lastResult: lastResult.value,
    })),
  };
};
