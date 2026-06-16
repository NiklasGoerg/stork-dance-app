<template>
  <div class="panel card-panel">
    <h2 class="panel-title">
      <BaseIcon :path="mdiVideoOutline" title="Record video" />
      Record Video
    </h2>

    <div class="control-layout">
      <div class="field">
        <label for="videoMovementName">Movement Name</label>
        <input
          id="videoMovementName"
          v-model="movementName"
          type="text"
          placeholder="e.g. temperature_rise"
          class="input-modern"
          :disabled="isProcessing"
        >
      </div>

      <div class="field">
        <label for="movementVideo">Video File</label>
        <input
          id="movementVideo"
          type="file"
          accept="video/*"
          class="input-modern"
          :disabled="isProcessing"
          @change="onFileSelected"
        >
      </div>

      <video
        v-if="videoUrl"
        ref="video"
        :src="videoUrl"
        class="video-preview"
        controls
        playsinline
        @loadedmetadata="onMetadataLoaded"
        @ended="finishAnalysis"
      />

      <div class="control-main">
        <button
          class="btn btn--primary"
          :disabled="!canAnalyze"
          @click="analyzeVideo"
        >
          <BaseIcon :path="isProcessing ? mdiTimerSand : mdiPlayCircleOutline" />
          {{ isProcessing ? "Processing..." : "Analyze Video" }}
        </button>
      </div>

      <div class="progress" aria-live="polite">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${progress}%` }" />
        </div>
        <span class="control-inline-note">
          {{ progressLabel }}
        </span>
      </div>

      <div class="status">
        <span class="status-chip" :class="{ active: isProcessing }">
          <span class="dot" />
          {{ statusLabel }}
        </span>
        <span v-if="recording" class="frames-info">
          Frames: <b>{{ recording.frames.length }}</b>
        </span>
      </div>

      <p v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  mdiPlayCircleOutline,
  mdiTimerSand,
  mdiVideoOutline,
} from "@mdi/js";

import BaseIcon from "~/components/ui/BaseIcon.vue";
import { useMovementRecorder } from "~/composables/useMovementRecorder";
import { usePose } from "~/composables/usePose";

const movementName = ref("movement");
const video = ref<HTMLVideoElement | null>(null);
const videoUrl = ref("");
const duration = ref(0);
const progress = ref(0);
const isProcessing = ref(false);
const isReady = ref(false);
const errorMessage = ref("");

const { recording, startRecording, stopRecording, recordFrame, exportRecording } =
  useMovementRecorder();

let animationFrameId = 0;
let pose: Awaited<ReturnType<typeof usePose>> | null = null;

const cleanMovementName = computed(() => {
  const name = movementName.value.trim();

  return name.length > 0 ? name : "movement";
});

const canAnalyze = computed(
  () => Boolean(videoUrl.value) && isReady.value && !isProcessing.value,
);

const statusLabel = computed(() => {
  if (isProcessing.value) return "Processing";
  if (progress.value >= 100) return "Exported";
  if (videoUrl.value) return "Ready";

  return "Idle";
});

const progressLabel = computed(() => {
  if (!isProcessing.value && progress.value === 0) {
    return "Select a video to begin.";
  }

  return `${Math.round(progress.value)}%`;
});

const resetProcessing = () => {
  cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;
  progress.value = 0;
  errorMessage.value = "";
};

const onFileSelected = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.item(0);

  if (!file) return;

  if (videoUrl.value) {
    URL.revokeObjectURL(videoUrl.value);
  }

  stopRecording();
  resetProcessing();
  isProcessing.value = false;
  isReady.value = false;
  duration.value = 0;
  videoUrl.value = URL.createObjectURL(file);

  if (movementName.value === "movement") {
    movementName.value = file.name.replace(/\.[^/.]+$/, "");
  }
};

const onMetadataLoaded = () => {
  if (!video.value) return;

  duration.value = video.value.duration;
  isReady.value = Number.isFinite(duration.value) && duration.value > 0;
};

const updateProgress = () => {
  if (!video.value || duration.value <= 0) return;

  progress.value = Math.min(
    100,
    (video.value.currentTime / duration.value) * 100,
  );
};

const processFrame = () => {
  if (!isProcessing.value || !video.value || !pose) return;

  updateProgress();

  const timestamp = performance.now();
  const result = pose.detectForVideo(video.value, timestamp);
  const landmarks = result.landmarks?.[0] as NormalizedLandmark[] | undefined;

  if (landmarks) {
    recordFrame(landmarks);
  }

  if (video.value.ended) {
    finishAnalysis();

    return;
  }

  animationFrameId = requestAnimationFrame(processFrame);
};

const analyzeVideo = async () => {
  if (!video.value || !canAnalyze.value) return;

  try {
    resetProcessing();
    isProcessing.value = true;
    pose = await usePose();

    video.value.currentTime = 0;
    video.value.muted = true;

    await startRecording(cleanMovementName.value, {
      skipCountdown: true,
      source: {
        width: video.value.videoWidth,
        height: video.value.videoHeight,
      },
    });
    await video.value.play();

    animationFrameId = requestAnimationFrame(processFrame);
  } catch (error) {
    stopRecording();
    isProcessing.value = false;
    errorMessage.value =
      error instanceof Error ? error.message : "Video analysis failed.";
  }
};

const finishAnalysis = () => {
  if (!isProcessing.value) return;

  cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;
  progress.value = 100;
  isProcessing.value = false;

  stopRecording();
  exportRecording();
};

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId);
  stopRecording();

  if (videoUrl.value) {
    URL.revokeObjectURL(videoUrl.value);
  }
});
</script>

<style scoped>
.video-preview {
  width: 100%;
  max-height: 220px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: #000;
}

.progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-track {
  width: 100%;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-chip-bg);
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width var(--trans-fast);
}

.status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.frames-info {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.error-message {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.9rem;
}
</style>
