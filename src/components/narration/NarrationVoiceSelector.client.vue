<template>
  <div class="narration-selector" :class="{ 'is-muted': !enabledModel }">
    <label class="narration-selector__toggle" :title="toggleTitle">
      <input
        v-model="enabledModel"
        type="checkbox"
        :aria-label="t('narration.enabledAria')"
      />
      <BaseIcon
        :path="enabledModel ? mdiVolumeHigh : mdiVolumeOff"
        :title="t('narration.enabledLabel')"
      />
      <span>{{ enabledModel ? t("narration.on") : t("narration.off") }}</span>
    </label>

    <label class="narration-selector__field" :for="voiceSelectId">
      <span class="narration-selector__label">
        {{ t("narration.voiceLabel") }}
      </span>
      <select
        :id="voiceSelectId"
        v-model="selectedVoiceUri"
        class="narration-selector__select"
        :aria-label="t('narration.voiceSelectAria')"
        :disabled="isVoiceSelectDisabled"
        :title="voiceSelectTitle"
      >
        <option v-if="sortedVoices.length === 0" value="">
          {{ emptyVoiceLabel }}
        </option>
        <option
          v-for="voice in sortedVoices"
          :key="voice.voiceURI"
          :value="voice.voiceURI"
        >
          {{ getNarrationVoiceLabel(voice) }}
        </option>
      </select>
    </label>

    <button
      class="narration-selector__preview"
      type="button"
      :aria-label="t('narration.previewAria')"
      :disabled="isPreviewDisabled"
      :title="previewTitle"
      @click="onPreview"
    >
      <BaseIcon :path="mdiSpeakerPlay" />
      <span>{{ t("narration.testVoice") }}</span>
    </button>

    <span
      v-if="statusMessage"
      class="narration-selector__status"
      aria-live="polite"
    >
      {{ statusMessage }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { mdiSpeakerPlay, mdiVolumeHigh, mdiVolumeOff } from "@mdi/js";
import { storeToRefs } from "pinia";
import { computed, onBeforeUnmount, onMounted, ref, useId } from "vue";

import BaseIcon from "~/components/ui/BaseIcon.vue";
import { useNarrator } from "~/composables/narration/useNarrator.client";
import type { NarrationResultStatus } from "~/types/narration";
import { useNarrationSettingsStore } from "~/store/narration";
import {
  getNarrationVoiceLabel,
  getNarrationVoicePreference,
  normalizeNarrationLocale,
  sortNarrationVoices,
} from "~/utils/narration/voiceSelection";

const { t, locale } = useI18n();
const voiceSelectId = useId();
const settingsStore = useNarrationSettingsStore();
const { enabled, preferredVoice } = storeToRefs(settingsStore);
const narrator = useNarrator();
const hasWaitedForVoices = ref(false);
const previewStatus = ref<NarrationResultStatus | null>(null);
const previewRequestId = ref(0);
const isPreviewing = ref(false);

let voiceLoadingTimer: ReturnType<typeof setTimeout> | null = null;

const sortedVoices = computed(() =>
  sortNarrationVoices(
    narrator.voices.value,
    normalizeNarrationLocale(String(locale.value)),
  ),
);

const isWaitingForVoices = computed(
  () =>
    narrator.isSupported.value &&
    sortedVoices.value.length === 0 &&
    !hasWaitedForVoices.value,
);

const isVoiceSelectDisabled = computed(
  () => !narrator.isSupported.value || sortedVoices.value.length === 0,
);

const enabledModel = computed({
  get: () => enabled.value,
  set: (value: boolean) => {
    previewStatus.value = null;
    settingsStore.setEnabled(value);
  },
});

const selectedVoiceUri = computed({
  get: () =>
    preferredVoice.value.voiceUri ??
    narrator.selectedVoice.value?.voiceURI ??
    "",
  set: (voiceUri: string) => {
    previewStatus.value = null;

    const voice =
      sortedVoices.value.find((voice) => voice.voiceURI === voiceUri) ?? null;

    settingsStore.setPreferredVoice(getNarrationVoicePreference(voice));
  },
});

const emptyVoiceLabel = computed(() =>
  isWaitingForVoices.value
    ? t("narration.loadingVoices")
    : t("narration.noVoices"),
);

const voiceStateMessage = computed(() => {
  if (!narrator.isSupported.value) return t("narration.unsupported");
  if (isWaitingForVoices.value) return t("narration.loadingVoices");
  if (sortedVoices.value.length === 0) return t("narration.noVoices");

  return "";
});

const previewStatusMessage = computed(() => {
  if (previewStatus.value === "disabled") return t("narration.previewDisabled");
  if (previewStatus.value === "unsupported") return t("narration.unsupported");
  if (previewStatus.value === "error") return t("narration.previewError");

  return "";
});

const statusMessage = computed(
  () => voiceStateMessage.value || previewStatusMessage.value,
);

const voiceSelectTitle = computed(() => {
  if (!narrator.isSupported.value) return t("narration.unsupported");
  if (sortedVoices.value.length === 0) return emptyVoiceLabel.value;

  return t("narration.voiceSelectAria");
});

const previewTitle = computed(() => {
  if (!enabled.value) return t("narration.previewDisabled");
  if (!narrator.isSupported.value) return t("narration.unsupported");
  if (sortedVoices.value.length === 0) return emptyVoiceLabel.value;

  return t("narration.previewAria");
});

const toggleTitle = computed(() =>
  enabled.value ? t("narration.turnOff") : t("narration.turnOn"),
);

const isPreviewDisabled = computed(
  () =>
    !enabled.value ||
    !narrator.isSupported.value ||
    sortedVoices.value.length === 0,
);

const onPreview = async () => {
  const requestId = previewRequestId.value + 1;

  previewRequestId.value = requestId;
  previewStatus.value = null;
  isPreviewing.value = true;

  const result = await narrator.previewVoice(
    selectedVoiceUri.value || undefined,
  );

  if (previewRequestId.value !== requestId) return;

  previewStatus.value = result.status;
  isPreviewing.value = false;
};

onMounted(() => {
  narrator.refreshVoices();
  voiceLoadingTimer = setTimeout(() => {
    hasWaitedForVoices.value = true;
  }, 1400);
});

onBeforeUnmount(() => {
  if (voiceLoadingTimer) {
    clearTimeout(voiceLoadingTimer);
  }
});
</script>

<style scoped>
.narration-selector {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: rgba(28, 43, 34, 0.78);
  font-size: 0.78rem;
  font-weight: 650;
}

.narration-selector.is-muted {
  color: rgba(28, 43, 34, 0.56);
}

.narration-selector__toggle,
.narration-selector__field,
.narration-selector__preview {
  min-height: 32px;
  border: 1px solid rgba(30, 48, 38, 0.14);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.62);
}

.narration-selector__toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  cursor: pointer;
}

.narration-selector__toggle input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: #26382f;
}

.narration-selector__field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
}

.narration-selector__label {
  color: rgba(28, 43, 34, 0.58);
}

.narration-selector__select {
  width: clamp(150px, 22vw, 250px);
  min-height: 28px;
  border: none;
  background: transparent;
  color: #1c2b22;
  font: inherit;
  cursor: pointer;
}

.narration-selector__select:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.narration-selector__select:focus-visible,
.narration-selector__preview:focus-visible,
.narration-selector__toggle:focus-within {
  outline: 2px solid rgba(38, 56, 47, 0.24);
  outline-offset: 2px;
}

.narration-selector__preview {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  color: #ffffff;
  background: #26382f;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.narration-selector__preview:hover,
.narration-selector__preview:focus-visible {
  background: #18251f;
}

.narration-selector__preview:disabled {
  background: rgba(38, 56, 47, 0.18);
  color: rgba(28, 43, 34, 0.48);
  cursor: not-allowed;
}

.narration-selector__status {
  max-width: 180px;
  overflow: hidden;
  color: rgba(28, 43, 34, 0.64);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .narration-selector {
    justify-content: center;
    width: 100%;
  }

  .narration-selector__field {
    flex: 1 1 190px;
  }

  .narration-selector__select {
    width: 100%;
  }

  .narration-selector__status {
    max-width: 100%;
  }
}

@media (max-width: 560px) {
  .narration-selector {
    flex-wrap: wrap;
  }
}
</style>
