import { useSpeechSynthesis } from "@vueuse/core";
import { computed, onScopeDispose, ref } from "vue";

import type {
  NarrationResult,
  NarrationSpeakOptions,
  NarrationVoicePreference,
} from "~/types/narration";
import { useNarrationSettingsStore } from "~/store/narration";
import {
  getNarrationVoicePreference,
  normalizeNarrationLocale,
  resolveNarrationVoice,
} from "~/utils/narration/voiceSelection";

interface NarrationRequest {
  utterance: SpeechSynthesisUtterance;
  resolve: (result: NarrationResult) => void;
  resolved: boolean;
}

const voices = ref<SpeechSynthesisVoice[]>([]);
const isSpeaking = ref(false);
const isPaused = ref(false);
const lastError = ref<unknown>(null);
const activeUtterance = ref<SpeechSynthesisUtterance | null>(null);
const pendingRequests = new Set<NarrationRequest>();

let activeConsumerCount = 0;
let isVoiceListenerRegistered = false;

const getSpeechSynthesis = () => {
  if (import.meta.server) return null;

  return window.speechSynthesis ?? null;
};

const refreshVoices = () => {
  const speechSynthesis = getSpeechSynthesis();

  voices.value = speechSynthesis?.getVoices() ?? [];

  return voices.value;
};

const syncSpeechState = () => {
  const speechSynthesis = getSpeechSynthesis();

  isSpeaking.value = Boolean(
    speechSynthesis?.speaking ||
    speechSynthesis?.pending ||
    pendingRequests.size > 0,
  );
  isPaused.value = Boolean(speechSynthesis?.paused);
};

const registerVoiceListener = () => {
  const speechSynthesis = getSpeechSynthesis();

  if (!speechSynthesis) return;

  refreshVoices();

  if (isVoiceListenerRegistered) return;

  speechSynthesis.addEventListener("voiceschanged", refreshVoices);
  isVoiceListenerRegistered = true;
};

const unregisterVoiceListener = () => {
  const speechSynthesis = getSpeechSynthesis();

  if (!speechSynthesis || !isVoiceListenerRegistered) return;

  speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
  isVoiceListenerRegistered = false;
};

const clearUtteranceHandlers = (utterance: SpeechSynthesisUtterance) => {
  utterance.onstart = null;
  utterance.onend = null;
  utterance.onerror = null;
  utterance.onpause = null;
  utterance.onresume = null;
};

const resolveRequest = (request: NarrationRequest, result: NarrationResult) => {
  if (request.resolved) return;

  request.resolved = true;
  pendingRequests.delete(request);
  clearUtteranceHandlers(request.utterance);

  if (activeUtterance.value === request.utterance) {
    activeUtterance.value = null;
  }

  request.resolve(result);
  syncSpeechState();
};

const cancelPendingRequests = () => {
  for (const request of [...pendingRequests]) {
    resolveRequest(request, { status: "cancelled" });
  }
};

const isCancellationError = (event: SpeechSynthesisErrorEvent) =>
  event.error === "canceled" || event.error === "interrupted";

const getLocaleString = (locale: string | string[] | null | undefined) =>
  Array.isArray(locale) ? locale[0] : locale;

export const useNarrator = () => {
  const settingsStore = useNarrationSettingsStore();
  const { t, locale } = useI18n();
  const vueUseSpeech = useSpeechSynthesis("");
  const isSupported = computed(() =>
    Boolean(vueUseSpeech.isSupported.value && getSpeechSynthesis()),
  );
  const requestedLocale = computed(() =>
    normalizeNarrationLocale(getLocaleString(locale.value)),
  );
  const selectedVoice = computed(() =>
    resolveNarrationVoice(
      voices.value,
      settingsStore.preferredVoice,
      requestedLocale.value,
    ),
  );

  settingsStore.loadPersistedSettings();
  activeConsumerCount++;
  registerVoiceListener();
  syncSpeechState();

  onScopeDispose(() => {
    activeConsumerCount = Math.max(0, activeConsumerCount - 1);

    if (activeConsumerCount === 0) {
      unregisterVoiceListener();
    }
  });

  const stop = () => {
    const speechSynthesis = getSpeechSynthesis();

    cancelPendingRequests();
    activeUtterance.value = null;
    isSpeaking.value = false;
    isPaused.value = false;

    speechSynthesis?.cancel();
  };

  const pause = () => {
    const speechSynthesis = getSpeechSynthesis();

    if (!speechSynthesis || !isSupported.value) return;

    speechSynthesis.pause();
    syncSpeechState();
  };

  const resume = () => {
    const speechSynthesis = getSpeechSynthesis();

    if (!speechSynthesis || !isSupported.value) return;

    speechSynthesis.resume();
    syncSpeechState();
  };

  const speakText = async (
    text: string,
    options: NarrationSpeakOptions = {},
  ): Promise<NarrationResult> => {
    const speechSynthesis = getSpeechSynthesis();

    settingsStore.loadPersistedSettings();

    if (!settingsStore.enabled) return { status: "disabled" };
    if (!speechSynthesis || !isSupported.value)
      return { status: "unsupported" };
    if (!text.trim()) return { status: "skipped" };

    const behavior = options.behavior ?? "replace";

    syncSpeechState();

    if (behavior === "skip-if-speaking" && isSpeaking.value) {
      return { status: "skipped" };
    }

    if (behavior === "replace") {
      stop();
    }

    const voicePreference: NarrationVoicePreference = options.voiceUri
      ? {
          voiceUri: options.voiceUri,
          name: settingsStore.preferredVoice.name,
          lang: settingsStore.preferredVoice.lang,
        }
      : settingsStore.preferredVoice;
    const language =
      normalizeNarrationLocale(options.lang) ?? requestedLocale.value;
    const voice = resolveNarrationVoice(
      voices.value,
      voicePreference,
      language,
    );
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = language ?? voice?.lang ?? "en-US";
    utterance.rate = options.rate ?? settingsStore.rate;
    utterance.pitch = options.pitch ?? settingsStore.pitch;
    utterance.volume = options.volume ?? settingsStore.volume;

    if (voice) {
      utterance.voice = voice;
    }

    return await new Promise<NarrationResult>((resolve) => {
      const request: NarrationRequest = {
        utterance,
        resolve,
        resolved: false,
      };

      pendingRequests.add(request);

      utterance.onstart = () => {
        activeUtterance.value = utterance;
        isSpeaking.value = true;
        isPaused.value = false;
      };
      utterance.onend = () => {
        resolveRequest(request, { status: "completed" });
      };
      utterance.onerror = (event) => {
        if (isCancellationError(event)) {
          resolveRequest(request, { status: "cancelled" });

          return;
        }

        lastError.value = event;
        resolveRequest(request, { status: "error", error: event });
      };
      utterance.onpause = () => {
        isPaused.value = true;
        syncSpeechState();
      };
      utterance.onresume = () => {
        isPaused.value = false;
        syncSpeechState();
      };

      try {
        speechSynthesis.speak(utterance);
        syncSpeechState();
      } catch (error) {
        lastError.value = error;
        resolveRequest(request, { status: "error", error });
      }
    });
  };

  const previewVoice = (voiceUri?: string) =>
    speakText(t("narration.voicePreview"), {
      voiceUri,
      behavior: "replace",
      rate: settingsStore.rate,
      pitch: settingsStore.pitch,
      volume: settingsStore.volume,
    });

  return {
    voices,
    selectedVoice,
    isSupported,
    isSpeaking,
    isPaused,
    lastError,
    activeUtterance,
    refreshVoices,
    speakText,
    previewVoice,
    stop,
    pause,
    resume,
    getNarrationVoicePreference,
  };
};
