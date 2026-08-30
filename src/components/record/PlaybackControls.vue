<template>
  <div class="panel card-panel">
    <h2 class="panel-title">
      <BaseIcon :path="mdiPlayCircleOutline" :title="t('playback.iconTitle')" />
      {{ t("playback.title") }}
    </h2>

    <div class="control-layout">
      <div class="field">
        <label for="movementAsset">{{ t("playback.movementAsset") }}</label>
        <select
          id="movementAsset"
          class="input-modern"
          :value="selectedAssetId"
          @change="onAssetSelected"
        >
          <option value="">{{ t("playback.selectAsset") }}</option>
          <option v-for="asset in assets" :key="asset.id" :value="asset.id">
            {{ asset.label }}
          </option>
        </select>
      </div>

      <div class="field">
        <label for="movementFile">{{ t("playback.movementJson") }}</label>
        <input
          id="movementFile"
          type="file"
          accept=".json"
          class="input-modern"
          @change="onFileSelected"
        />
      </div>

      <div v-if="activeSourceName" class="file-info">
        <span class="chip file-chip">
          <BaseIcon :path="mdiFileDocumentOutline" /> {{ activeSourceName }}
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
          :title="t('playback.resetTitle')"
          @click="$emit('reset')"
        >
          <BaseIcon :path="mdiRestart" />
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
import { computed } from "vue";
import {
  mdiFileDocumentOutline,
  mdiPause,
  mdiPlay,
  mdiPlayCircleOutline,
  mdiRestart,
} from "@mdi/js";

import BaseIcon from "~/components/ui/BaseIcon.vue";
import type { RecordPlaybackAsset } from "~/composables/useRecordMovementPlayback";
import type { MovementRecording } from "~/types/movement";

const { t } = useI18n();

const props = defineProps<{
  assets: RecordPlaybackAsset[];
  selectedAssetId: string;
  sourceName: string;
  recording: MovementRecording | null;
  hasRecording: boolean;
  isPlaying: boolean;
  hasCompleted: boolean;
  currentTimeMs: number;
  durationMs: number;
}>();

const emit = defineEmits<{
  loadAsset: [assetId: string];
  loadUploadedRecording: [recording: MovementRecording, fileName: string];
  play: [];
  pause: [];
  reset: [];
}>();

const primaryActionLabel = computed(() =>
  props.isPlaying ? t("playback.pause") : t("playback.start"),
);

const primaryActionIcon = computed(() =>
  props.isPlaying ? mdiPause : mdiPlay,
);

const activeSourceName = computed(
  () => props.sourceName || props.recording?.name || "",
);

const status = computed(() => {
  if (!props.hasRecording) return "idle";
  if (props.isPlaying) return "playing";
  if (props.hasCompleted) return "loaded";

  return "loaded";
});

const statusLabel = computed(() => {
  if (!props.hasRecording) return t("common.status.idle");
  if (props.isPlaying) return t("common.status.playing");

  return t("common.ready");
});

const playbackNote = computed(() => {
  if (!props.hasRecording) {
    return t("playback.note.load");
  }

  if (props.isPlaying) {
    return t("playback.note.playing");
  }

  if (props.currentTimeMs > 0 && props.currentTimeMs < props.durationMs) {
    return t("playback.note.paused");
  }

  return t("playback.note.ready");
});

const onTogglePlayback = () => {
  if (!props.hasRecording) return;

  if (props.isPlaying) {
    emit("pause");
    return;
  }

  emit("play");
};

const onAssetSelected = (event: Event) => {
  const select = event.target as HTMLSelectElement;
  if (!select.value) return;

  emit("loadAsset", select.value);
};

const onFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement;

  if (!input.files?.length) return;

  const file = input.files.item(0);
  if (!file) return;

  const text = await file.text();

  const data = JSON.parse(text);

  emit("loadUploadedRecording", data, file.name);
};
</script>

<style scoped>
.panel {
  min-width: 0;
}

.field,
.control-layout {
  min-width: 0;
}

.field label {
  overflow-wrap: anywhere;
}

.input-modern {
  width: 100%;
  min-width: 0;
}

.input-modern[type="file"] {
  font-size: 0.9rem;
}

.file-info {
  font-size: 14px;
  margin-bottom: 2px;
  min-width: 0;
}

.file-chip {
  max-width: 100%;
  min-width: 0;
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
  min-width: 0;
}

.status-chip {
  min-width: 0;
}

.control-main {
  min-width: 0;
}

.control-main .btn--primary {
  min-width: 0;
}

.control-inline-note {
  overflow-wrap: anywhere;
}
</style>
