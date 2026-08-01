import { defineStore } from "pinia";

import type {
  NarrationSettingsState,
  NarrationVoicePreference,
} from "~/types/narration";

const narrationSettingsStorageKey = "data-dance:narration-settings:v1";
const minSpeechRate = 0.1;
const maxSpeechRate = 10;
const minSpeechPitch = 0;
const maxSpeechPitch = 2;
const minSpeechVolume = 0;
const maxSpeechVolume = 1;

let hasLoadedPersistedSettings = false;

export const defaultNarrationSettings: NarrationSettingsState = {
  enabled: true,
  preferredVoice: {
    voiceUri: null,
    name: null,
    lang: null,
  },
  rate: 0.95,
  pitch: 1,
  volume: 1,
};

const cloneDefaultNarrationSettings = (): NarrationSettingsState => ({
  ...defaultNarrationSettings,
  preferredVoice: { ...defaultNarrationSettings.preferredVoice },
});

const clampNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

const normalizeNullableString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null;

const normalizeVoicePreference = (value: unknown): NarrationVoicePreference => {
  if (!value || typeof value !== "object") {
    return { ...defaultNarrationSettings.preferredVoice };
  }

  const preference = value as Partial<NarrationVoicePreference>;

  return {
    voiceUri: normalizeNullableString(preference.voiceUri),
    name: normalizeNullableString(preference.name),
    lang: normalizeNullableString(preference.lang),
  };
};

const normalizeSettings = (value: unknown): NarrationSettingsState => {
  if (!value || typeof value !== "object") {
    return cloneDefaultNarrationSettings();
  }

  const settings = value as Partial<NarrationSettingsState>;

  return {
    enabled:
      typeof settings.enabled === "boolean"
        ? settings.enabled
        : defaultNarrationSettings.enabled,
    preferredVoice: normalizeVoicePreference(settings.preferredVoice),
    rate: clampNumber(
      settings.rate,
      minSpeechRate,
      maxSpeechRate,
      defaultNarrationSettings.rate,
    ),
    pitch: clampNumber(
      settings.pitch,
      minSpeechPitch,
      maxSpeechPitch,
      defaultNarrationSettings.pitch,
    ),
    volume: clampNumber(
      settings.volume,
      minSpeechVolume,
      maxSpeechVolume,
      defaultNarrationSettings.volume,
    ),
  };
};

const persistSettings = (state: NarrationSettingsState) => {
  if (import.meta.server) return;

  try {
    window.localStorage.setItem(
      narrationSettingsStorageKey,
      JSON.stringify({
        enabled: state.enabled,
        preferredVoice: state.preferredVoice,
        rate: state.rate,
        pitch: state.pitch,
        volume: state.volume,
      }),
    );
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
};

export const useNarrationSettingsStore = defineStore("narrationSettings", {
  state: cloneDefaultNarrationSettings,
  actions: {
    loadPersistedSettings() {
      if (import.meta.server || hasLoadedPersistedSettings) return;

      hasLoadedPersistedSettings = true;

      try {
        const savedSettings = window.localStorage.getItem(
          narrationSettingsStorageKey,
        );

        if (!savedSettings) return;

        this.$patch(normalizeSettings(JSON.parse(savedSettings)));
      } catch {
        this.$patch(cloneDefaultNarrationSettings());
      }
    },
    setEnabled(enabled: boolean) {
      this.enabled = enabled;
      persistSettings(this.$state);
    },
    setPreferredVoice(voice: NarrationVoicePreference) {
      this.preferredVoice = normalizeVoicePreference(voice);
      persistSettings(this.$state);
    },
    setRate(rate: number) {
      this.rate = clampNumber(
        rate,
        minSpeechRate,
        maxSpeechRate,
        defaultNarrationSettings.rate,
      );
      persistSettings(this.$state);
    },
    setPitch(pitch: number) {
      this.pitch = clampNumber(
        pitch,
        minSpeechPitch,
        maxSpeechPitch,
        defaultNarrationSettings.pitch,
      );
      persistSettings(this.$state);
    },
    setVolume(volume: number) {
      this.volume = clampNumber(
        volume,
        minSpeechVolume,
        maxSpeechVolume,
        defaultNarrationSettings.volume,
      );
      persistSettings(this.$state);
    },
    resetSettings() {
      this.$patch(cloneDefaultNarrationSettings());
      persistSettings(this.$state);
    },
  },
});
