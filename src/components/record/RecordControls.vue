<template>
  <div class="panel card-panel">
    <h2 class="panel-title">
      <BaseIcon :path="mdiMicrophone" title="Record" />
      Record Movement
    </h2>

    <div class="control-layout">
      <div class="field">
        <label for="movementName">Movement Name</label>
        <input
          id="movementName"
          v-model="movementName"
          type="text"
          placeholder="e.g. arms_up"
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
          title="Export recording"
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
          {{ isRecording ? "Recording" : "Idle" }}
        </span>
        <span v-if="countdown > 0" class="countdown">
          Starting in: <b>{{ countdown }}</b>
        </span>
        <span v-if="recording" class="frames-info">
          Frames: <b>{{ recording.frames.length }}</b>
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
  if (isCountingDown.value) return "Starting...";

  return isRecording.value ? "Stop" : "Start";
});

const primaryActionIcon = computed(() => {
  if (isCountingDown.value) return mdiTimerSand;

  return isRecording.value ? mdiStop : mdiRecordCircle;
});

const recordingNote = computed(() => {
  if (isCountingDown.value) {
    return "Prepare your movement posture.";
  }

  if (recording.value?.frames.length) {
    return "Use save icon to export latest take.";
  }

  return "Press start to capture movement.";
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
