<template>
  <div class="panel card-panel">
    <h2 class="panel-title">
      <BaseIcon :path="mdiMicrophone" :title="t('record.webcam.iconTitle')" />
      {{ t("record.webcam.title") }}
    </h2>

    <div class="control-layout">
      <div class="field">
        <label for="movementName">{{ t("record.webcam.movementName") }}</label>
        <input
          id="movementName"
          v-model="movementName"
          type="text"
          :placeholder="t('record.webcam.movementNamePlaceholder')"
          class="input-modern"
        />
      </div>

      <div class="control-main">
        <button
          class="btn btn--primary"
          :disabled="isCountingDown"
          @click="onToggleRecord"
        >
          <BaseIcon :path="primaryActionIcon" /> {{ primaryActionLabel }}
        </button>
        <button
          class="btn icon-btn"
          :disabled="!canExport"
          :title="t('record.webcam.exportTitle')"
          @click="exportRecording"
        >
          <BaseIcon :path="mdiContentSave" />
        </button>
      </div>

      <div class="control-meta">
        <span class="control-inline-note">
          {{ recordingNote }}
        </span>
      </div>

      <div class="status">
        <span class="status-chip" :class="isRecording ? 'active' : ''">
          <span class="dot" />
          {{ isRecording ? t("record.webcam.recording") : t("common.idle") }}
        </span>
        <span v-if="countdown > 0" class="countdown">
          <i18n-t keypath="record.webcam.startingIn" tag="span">
            <template #count>
              <b>{{ countdown }}</b>
            </template>
          </i18n-t>
        </span>
        <span v-if="recording" class="frames-info">
          <i18n-t keypath="common.frames" tag="span">
            <template #count>
              <b>{{ recording.frames.length }}</b>
            </template>
          </i18n-t>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  mdiContentSave,
  mdiMicrophone,
  mdiRecordCircle,
  mdiStop,
  mdiTimerSand,
} from "@mdi/js";

import BaseIcon from "~/components/ui/BaseIcon.vue";
import { useMovementRecorder } from "~/composables/useMovementRecorder";

const { t } = useI18n();
const movementName = ref("movement");

const {
  isRecording,
  countdown,
  recording,

  startRecording,
  stopRecording,
  exportRecording,
} = useMovementRecorder();

const isCountingDown = computed(() => countdown.value > 0);

const canExport = computed(
  () => Boolean(recording.value) && !isRecording.value,
);

const primaryActionLabel = computed(() => {
  if (isCountingDown.value) return t("record.webcam.starting");

  return isRecording.value ? t("record.webcam.stop") : t("record.webcam.start");
});

const primaryActionIcon = computed(() => {
  if (isCountingDown.value) return mdiTimerSand;

  return isRecording.value ? mdiStop : mdiRecordCircle;
});

const recordingNote = computed(() => {
  if (isCountingDown.value) {
    return t("record.webcam.note.prepare");
  }

  if (recording.value?.frames.length) {
    return t("record.webcam.note.export");
  }

  return t("record.webcam.note.start");
});

const onToggleRecord = async () => {
  if (isCountingDown.value) return;

  if (isRecording.value) {
    stopRecording();

    return;
  }

  await startRecording(movementName.value);
};
</script>

<style scoped>
.status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.countdown {
  color: var(--color-primary);
  font-size: 0.9rem;
  font-weight: 600;
}
.frames-info {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
</style>
