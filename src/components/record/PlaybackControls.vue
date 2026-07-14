<template>
  <div class="panel card-panel">
    <h2 class="panel-title">
      <BaseIcon :path="mdiPlayCircleOutline" title="Playback" />
      Playback Movement
    </h2>

    <div class="control-layout">
      <div class="field">
        <label for="movementFile">Movement JSON</label>
        <input
          id="movementFile"
          type="file"
          accept=".json"
          class="input-modern"
          @change="onFileSelected"
        >
      </div>

      <div v-if="fileName" class="file-info">
        <span class="chip file-chip">
          <BaseIcon :path="mdiFileDocumentOutline" /> {{ fileName }}
        </span>
      </div>

      <div class="control-main">
        <button
          class="btn btn--primary"
          :disabled="!hasRecording"
          @click="onTogglePlayback"
        >
          <BaseIcon :path="primaryActionIcon" /> {{ primaryActionLabel }}
        </button>
        <button
          class="btn icon-btn"
          :disabled="!hasRecording"
          title="Stop playback"
          @click="onStopPlayback"
        >
          <BaseIcon :path="mdiStop" />
        </button>
      </div>

      <div class="control-meta">
        <span class="control-inline-note">
          {{ playbackNote }}
        </span>
      </div>

      <div class="status">
        <span class="status-chip" :class="status">
          <span class="dot" />
          {{ statusLabel }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  mdiFileDocumentOutline,
  mdiPause,
  mdiPlay,
  mdiPlayCircleOutline,
  mdiStop,
} from "@mdi/js";

import BaseIcon from "~/components/ui/BaseIcon.vue";
import { useMovementPlayback } from "~/composables/useMovementPlayback";

const {
  loadRecording,
  recording,

  play: playRecording,
  pause: pauseRecording,
  stop: stopRecording,
} = useMovementPlayback();

const fileName = ref("");
const status = ref<"idle" | "loaded" | "playing" | "paused" | "stopped">(
  "idle",
);

const hasRecording = computed(() => Boolean(recording.value));

const primaryActionLabel = computed(() =>
  status.value === "playing" ? "Pause" : "Start",
);

const primaryActionIcon = computed(() =>
  status.value === "playing" ? mdiPause : mdiPlay,
);

const statusLabel = computed(
  () => status.value.charAt(0).toUpperCase() + status.value.slice(1),
);

const playbackNote = computed(() => {
  if (!hasRecording.value) {
    return "Load a recording to start playback.";
  }

  if (status.value === "playing") {
    return "Pause anytime or use stop to reset.";
  }

  if (status.value === "paused") {
    return "Resume with start or reset with stop.";
  }

  return "Ready to play the loaded movement.";
});

const onTogglePlayback = () => {
  if (!hasRecording.value) return;

  if (status.value === "playing") {
    pauseRecording();
    status.value = "paused";

    return;
  }

  playRecording();
  status.value = "playing";
};

const onStopPlayback = () => {
  if (!hasRecording.value) return;

  stopRecording();
  status.value = "stopped";
};

const onFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement;

  if (!input.files?.length) return;

  const file = input.files.item(0);
  if (!file) return;

  fileName.value = file.name;

  const text = await file.text();

  const data = JSON.parse(text);

  loadRecording(data);
  status.value = "loaded";
};
</script>

<style scoped>
.file-info {
  font-size: 14px;
  margin-bottom: 2px;
}
.file-chip {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status {
  font-size: 14px;
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
