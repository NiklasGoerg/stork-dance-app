import { computed } from "vue";

import { useNarrator } from "~/composables/narration/useNarrator.client";
import type {
  NarrationResult,
  NarrationSpeakBehavior,
  NarrationSpeakOptions,
} from "~/types/narration";

export type NarrationCueKey = string;

export interface PlayNarrationOptions {
  params?: Record<string, string | number>;
  behavior?: NarrationSpeakBehavior;
}

export const useNarration = () => {
  const { t } = useI18n();
  const narrator = useNarrator();
  const isSpeaking = computed(() => narrator.isSpeaking.value);
  const isPaused = computed(() => narrator.isPaused.value);

  const play = async (
    cueKey: NarrationCueKey,
    options: PlayNarrationOptions = {},
  ): Promise<NarrationResult> => {
    const text = t(cueKey, options.params ?? {});

    return await narrator.speakText(text, {
      behavior: options.behavior,
    });
  };

  const speakText = async (
    text: string,
    options: Pick<
      NarrationSpeakOptions,
      "behavior" | "rate" | "onStart" | "onEnd"
    > = {},
  ): Promise<NarrationResult> =>
    await narrator.speakText(text, {
      behavior: options.behavior,
      rate: options.rate,
      onStart: options.onStart,
      onEnd: options.onEnd,
    });

  return {
    play,
    speakText,
    stop: narrator.stop,
    pause: narrator.pause,
    resume: narrator.resume,
    isSpeaking,
    isPaused,
  };
};
