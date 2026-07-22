<template>
  <main class="story-stage-page">
    <section
      class="map-panel"
      :class="{ 'map-panel--gesture-active': isGestureActive }"
      aria-label="Story map"
    >
      <BirdMap />
    </section>

    <section class="movement-panel" aria-label="Movement stage">
      <section class="avatar-stage" aria-label="Avatar stage">
        <div class="avatar-stage__surface">
          <div class="avatar-stage__toolbar" aria-label="Movement source">
            <button
              class="stage-toggle"
              type="button"
              :disabled="isGestureActive"
              :class="{
                'stage-toggle--active': avatarSourceMode === 'live-camera',
              }"
              @click="setAvatarSourceMode('live-camera')"
            >
              Live Camera
            </button>
            <button
              class="stage-toggle"
              type="button"
              :disabled="isTestDanceLoading || isGestureActive"
              :class="{
                'stage-toggle--active': avatarSourceMode === 'recorded-motion',
              }"
              @click="setAvatarSourceMode('recorded-motion')"
            >
              {{ isTestDanceLoading ? "Loading" : "Test Dance" }}
            </button>
          </div>

          <dl class="audio-debug" aria-label="Base rhythm debug">
            <div>
              <dt>BPM</dt>
              <dd>{{ baseRhythmLoop.bpm }}</dd>
            </div>
            <div>
              <dt>Bar</dt>
              <dd>{{ baseRhythmPosition.currentBar }}</dd>
            </div>
            <div>
              <dt>Beat</dt>
              <dd>{{ baseRhythmPosition.currentBeat }}</dd>
            </div>
            <div>
              <dt>Audio</dt>
              <dd>{{ baseRhythmStatus }}</dd>
            </div>
            <div v-if="baseRhythmLoop.error">
              <dt>Error</dt>
              <dd>{{ baseRhythmLoop.error }}</dd>
            </div>
          </dl>

          <MovementStage
            :landmarks="stageLandmarks"
            :source-mode="avatarSourceMode"
            :source-aspect="stageSourceAspect"
          />
        </div>
      </section>

      <section class="support-rail" aria-label="Playback and user mirror">
        <section class="season-clock-panel" aria-label="Season clock">
          <SeasonClock />
        </section>

        <section class="user-mirror-panel" aria-label="User mirror">
          <MovementCamera
            mode="camera"
            :fixed="false"
            :show-hands="false"
            @pose-landmarks="poseLandmarks = $event"
          />
        </section>
      </section>
    </section>

    <section class="gesture-test-controls" aria-label="Gesture test controls">
      <div class="gesture-test-controls__actions">
        <button
          class="btn btn--primary"
          type="button"
          :disabled="isGestureActive"
          @click="storyGestureStore.startGesture('arrival')"
        >
          Test Arrival Gesture
        </button>
        <button
          class="btn btn--primary"
          type="button"
          :disabled="isGestureActive"
          @click="storyGestureStore.startGesture('departure')"
        >
          Test Departure Gesture
        </button>
      </div>

      <dl class="gesture-debug" aria-label="Gesture debug">
        <div>
          <dt>Gesture</dt>
          <dd>{{ activeGesture?.label ?? "None" }}</dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{{ gestureState }}</dd>
        </div>
        <div>
          <dt>Beat</dt>
          <dd>
            {{ baseRhythmPosition.currentBar }}:{{
              baseRhythmPosition.currentBeat
            }}
          </dd>
        </div>
        <div>
          <dt>Attempt</dt>
          <dd>{{ storyGestureStore.attemptCount }}</dd>
        </div>
        <div>
          <dt>Paused</dt>
          <dd>{{ storyPlaybackPausedLabel }}</dd>
        </div>
        <div>
          <dt>Movement</dt>
          <dd>{{ gestureMovementStatus }}</dd>
        </div>
        <div>
          <dt>Loaded</dt>
          <dd>{{ storyGestureStore.movementLoaded ? "yes" : "no" }}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{{ gestureMovementTimeLabel }}</dd>
        </div>
        <div>
          <dt>Decision</dt>
          <dd>{{ storyGestureStore.decision }}</dd>
        </div>
        <div>
          <dt>Checkpoint</dt>
          <dd>{{ currentCheckpointDebugLabel }}</dd>
        </div>
        <div>
          <dt>Done</dt>
          <dd>{{ completedCheckpointDebugLabel }}</dd>
        </div>
        <div>
          <dt>Pose input</dt>
          <dd>{{ hasPoseInput ? "yes" : "no" }}</dd>
        </div>
      </dl>
    </section>

    <StoryPoseDebugPanel
      v-if="isPoseDebugVisible"
      v-model:target-pose-id="targetPoseId"
      :definitions="poseDefinitions"
      :features="currentPoseFeatures"
      :evaluations="currentPoseEvaluations"
      :stable-results="stablePoseResults"
      :calibration="poseCalibration"
    />

    <StoryGestureOverlay
      :gesture-label="activeGesture?.label ?? 'Gesture'"
      :state="gestureState"
      :feedback-text="storyGestureStore.feedbackText"
      :show-dev-controls="isPoseDebugVisible"
      @mark="storyGestureStore.markGestureSuccessful"
      @repeat="storyGestureStore.repeatAttempt"
      @cancel="storyGestureStore.cancelGesture"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BirdMap from "~/components/map/BirdMap.vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import StoryGestureOverlay from "~/components/story/StoryGestureOverlay.vue";
import StoryPoseDebugPanel from "~/components/story/StoryPoseDebugPanel.vue";
import { useMovementPlayback } from "~/composables/useMovementPlayback";
import { usePoseComparison } from "~/composables/usePoseComparison";
import { loadGestureMovement } from "~/story/gestureMovements";
import { useAudioStore } from "~/store/audioStore";
import { useStoryGestureStore } from "~/store/storyGestureStore";
import { useStoryPlaybackStore } from "~/store/storyPlayback";
import type { PoseLandmarkLike } from "~/types/pose";
import type { AvatarSourceMode, MovementRecording } from "~/types/movement";
import { normalizeMovementRecordingToViewport } from "~/utils/movementFrames";
import { poseDefinitions } from "~/utils/pose/poseDefinitionRegistry";

const poseLandmarks = ref<PoseLandmarkLike[] | null>(null);
const avatarSourceMode = ref<AvatarSourceMode>("live-camera");
const testDanceRecording = ref<MovementRecording | null>(null);
const gestureMovementRecording = ref<MovementRecording | null>(null);
const isTestDanceLoading = ref(false);
const isGestureMovementLoading = ref(false);
const previousAvatarSourceMode = ref<AvatarSourceMode | null>(null);
const avatarStageAspect = 16 / 9;
const audioStore = useAudioStore();
const storyPlaybackStore = useStoryPlaybackStore();
const storyGestureStore = useStoryGestureStore();
const baseRhythmLoop = computed(() => audioStore.baseRhythmLoop);
const baseRhythmPosition = computed(() => audioStore.baseRhythmPosition);
const activeGesture = computed(() => storyGestureStore.activeGesture);
const gestureState = computed(() => storyGestureStore.state);
const isGestureActive = computed(() => storyGestureStore.isActive);
const isGestureAttemptRunning = computed(() =>
  ["attempt-playing", "retry-scheduled", "success-exit"].includes(
    storyGestureStore.state,
  ),
);
const storyPlaybackPausedLabel = computed(() =>
  storyPlaybackStore.isStoryPlaybackPaused ? "yes" : "no",
);
const gestureMovementStatus = computed(() =>
  isGestureMovementLoading.value
    ? "loading"
    : storyGestureStore.movementLoadError
      ? "error"
      : storyGestureStore.movementPlaybackSource,
);
const hasPoseInput = computed(() => Boolean(poseLandmarks.value?.length));
const currentGestureCheckpoint = computed(
  () => storyGestureStore.currentCheckpoint,
);
const gestureMovementTimeLabel = computed(
  () =>
    `${Math.round(storyGestureStore.currentSourceTimeMs)} / ${Math.round(
      activeGesture.value?.timing.successEndMs ??
        movementPlaybackDurationMs.value,
    )} ms`,
);
const currentCheckpointDebugLabel = computed(() => {
  const checkpoint = currentGestureCheckpoint.value;

  if (!checkpoint) return "none";

  return `${checkpoint.label} @ ${checkpoint.targetMovementTimeMs}ms`;
});
const completedCheckpointDebugLabel = computed(
  () =>
    `${storyGestureStore.completedCheckpointCount}/${storyGestureStore.requiredCheckpointCount}`,
);
const baseRhythmStatus = computed(() => {
  if (baseRhythmLoop.value.isLoading) return "loading";
  if (!baseRhythmLoop.value.isLoaded) return "click play";

  return baseRhythmLoop.value.isPlaying ? "playing" : "loaded";
});
const isPoseDebugVisible = import.meta.dev;
const {
  targetPoseId,
  currentFeatures: currentPoseFeatures,
  currentEvaluations: currentPoseEvaluations,
  stableResults: stablePoseResults,
  stableMatches: stablePoseMatches,
  calibration: poseCalibration,
  resetStability: resetPoseStability,
} = usePoseComparison({
  landmarks: poseLandmarks,
  freezeCalibration: isGestureAttemptRunning,
});
const testDanceUrl = new URL(
  "../../assets/movement_library/test-dance.json",
  import.meta.url,
).href;

const {
  currentFrame,
  durationMs: movementPlaybackDurationMs,
  loadRecording,
  play: playRecording,
  seekToTime: seekRecordingToTime,
  stop: stopRecording,
} = useMovementPlayback();

const recordedLandmarks = computed(() => currentFrame.value?.landmarks ?? null);

const stageLandmarks = computed(() =>
  avatarSourceMode.value === "recorded-motion"
    ? recordedLandmarks.value
    : poseLandmarks.value,
);

const stageSourceAspect = computed(() => {
  if (avatarSourceMode.value === "recorded-motion") return avatarStageAspect;

  return 4 / 3;
});

const loadTestDanceRecording = async () => {
  if (testDanceRecording.value) return testDanceRecording.value;

  isTestDanceLoading.value = true;

  try {
    const response = await fetch(testDanceUrl);
    const recording = normalizeMovementRecordingToViewport(
      (await response.json()) as MovementRecording,
      { targetAspect: avatarStageAspect },
    );

    testDanceRecording.value = recording;

    return recording;
  } finally {
    isTestDanceLoading.value = false;
  }
};

const setAvatarSourceMode = async (mode: AvatarSourceMode) => {
  if (isGestureActive.value) return;

  avatarSourceMode.value = mode;

  if (mode === "recorded-motion") {
    const recording = await loadTestDanceRecording();

    loadRecording(recording);
    playRecording({ loop: true });

    return;
  }

  stopRecording();
};

// Loads the active gesture demonstration and switches the avatar into recorded playback.
const loadActiveGestureMovement = async () => {
  const gesture = activeGesture.value;

  if (!gesture || storyGestureStore.state !== "loading-movement") return;

  if (!previousAvatarSourceMode.value) {
    previousAvatarSourceMode.value = avatarSourceMode.value;
  }

  isGestureMovementLoading.value = true;

  try {
    const result = await loadGestureMovement(gesture);

    if (
      storyGestureStore.state !== "loading-movement" ||
      storyGestureStore.activeGestureId !== gesture.id
    ) {
      return;
    }

    avatarSourceMode.value = "recorded-motion";
    gestureMovementRecording.value = normalizeMovementRecordingToViewport(
      result.recording,
      { targetAspect: avatarStageAspect },
    );
    loadRecording(gestureMovementRecording.value);
    await storyGestureStore.markMovementLoaded(result.source);
  } catch (error) {
    storyGestureStore.abortGestureSetup(error);
  } finally {
    isGestureMovementLoading.value = false;
  }
};

// Returns the avatar to the source the user had selected before the gesture session.
const restoreAvatarSourceAfterGesture = async () => {
  const previousMode = previousAvatarSourceMode.value;

  stopRecording();
  gestureMovementRecording.value = null;
  storyGestureStore.setMovementPlaybackSource("none");
  previousAvatarSourceMode.value = null;

  if (previousMode === "recorded-motion") {
    try {
      const recording = await loadTestDanceRecording();

      avatarSourceMode.value = "recorded-motion";
      loadRecording(recording);
      playRecording({ loop: true });
      return;
    } catch (error) {
      console.warn(
        "[StoryGesture] Could not restore test dance playback.",
        error,
      );
    }
  }

  avatarSourceMode.value = previousMode ?? "live-camera";
};

let audioDebugTimer: ReturnType<typeof setInterval> | null = null;
let gestureRenderFrameId = 0;
let isUnmounting = false;

const stopGestureRenderLoop = () => {
  if (!gestureRenderFrameId) return;

  cancelAnimationFrame(gestureRenderFrameId);
  gestureRenderFrameId = 0;
};

// Keeps avatar playback and checkpoint detection locked to the base rhythm transport.
const renderGestureFrame = () => {
  if (!storyGestureStore.isActive) {
    stopGestureRenderLoop();
    return;
  }

  const transportTimeMs = audioStore.getBaseRhythmTransportTimeMs();

  storyGestureStore.updateTransportTime(transportTimeMs);

  if (!storyGestureStore.isActive) {
    stopGestureRenderLoop();
    return;
  }

  if (gestureMovementRecording.value) {
    seekRecordingToTime(storyGestureStore.currentSourceTimeMs);
  }

  storyGestureStore.handlePoseSnapshot({
    stableResults: stablePoseResults.value,
    hasPoseInput: hasPoseInput.value,
    calibration: poseCalibration.value,
  });

  gestureRenderFrameId = requestAnimationFrame(renderGestureFrame);
};

const startGestureRenderLoop = () => {
  if (gestureRenderFrameId) return;

  gestureRenderFrameId = requestAnimationFrame(renderGestureFrame);
};

onMounted(() => {
  audioDebugTimer = setInterval(() => {
    audioStore.syncBaseRhythmLoopOffset();
  }, 250);
});

watch(
  () => storyGestureStore.state,
  (state) => {
    if (storyGestureStore.isActive) {
      startGestureRenderLoop();
    }

    if (state === "loading-movement") {
      void loadActiveGestureMovement();
    }
  },
);

watch(
  () => storyGestureStore.movementPlaybackKey,
  () => {
    if (storyGestureStore.state !== "attempt-playing") {
      return;
    }

    resetPoseStability();
  },
);

watch(stablePoseMatches, () => {
  if (storyGestureStore.state !== "attempt-playing") return;

  storyGestureStore.handlePoseSnapshot({
    stableResults: stablePoseResults.value,
    hasPoseInput: hasPoseInput.value,
    calibration: poseCalibration.value,
  });
});

watch(
  () => storyGestureStore.state,
  (state) => {
    if (state === "inactive" && !isUnmounting) {
      stopGestureRenderLoop();
      void restoreAvatarSourceAfterGesture();
    }
  },
);

onBeforeUnmount(() => {
  isUnmounting = true;

  if (audioDebugTimer) {
    clearInterval(audioDebugTimer);
    audioDebugTimer = null;
  }

  storyGestureStore.cleanupGesture();
  stopGestureRenderLoop();
  stopRecording();
  storyPlaybackStore.pause();
});
</script>

<style scoped>
.story-stage-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-columns: 60% 40%;
  overflow: hidden;
  background: #edf2ef;
}

.gesture-test-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 9;
  display: grid;
  width: min(320px, calc(100% - 24px));
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(31, 49, 39, 0.16);
  border-radius: 8px;
  background: rgba(248, 251, 247, 0.84);
  color: #26382f;
  box-shadow: 0 10px 28px rgba(32, 50, 40, 0.14);
  backdrop-filter: blur(10px);
}

.gesture-test-controls__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.gesture-test-controls .btn {
  min-height: 34px;
  padding: 7px 9px;
  font-size: 0.76rem;
}

.gesture-test-controls .btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.gesture-debug {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
  font-size: 0.68rem;
}

.gesture-debug div {
  min-width: 0;
}

.gesture-debug dt {
  color: rgba(31, 49, 39, 0.58);
  font-size: 0.58rem;
  font-weight: 800;
  text-transform: uppercase;
}

.gesture-debug dd {
  margin: 1px 0 0;
  overflow: hidden;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-panel,
.movement-panel {
  min-width: 0;
  min-height: 0;
}

.map-panel {
  position: relative;
  border-right: 1px solid rgba(36, 54, 42, 0.16);
}

.map-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 3;
  background: rgba(240, 244, 239, 0.56);
  opacity: 0;
  pointer-events: none;
  backdrop-filter: saturate(0.82) brightness(0.95);
  transition: opacity 0.18s ease;
}

.map-panel--gesture-active::after {
  opacity: 1;
}

.movement-panel {
  display: grid;
  grid-template-rows: 70% 30%;
  background:
    linear-gradient(
      180deg,
      rgba(252, 253, 248, 0.96),
      rgba(232, 240, 235, 0.92)
    ),
    #eef3ef;
}

.avatar-stage {
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(36, 54, 42, 0.14);
}

.avatar-stage__surface {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.avatar-stage__toolbar {
  position: absolute;
  z-index: 2;
  top: 12px;
  left: 12px;
  display: inline-flex;
  gap: 6px;
  padding: 5px;
  border: 1px solid rgba(31, 49, 39, 0.16);
  border-radius: 8px;
  background: rgba(248, 251, 247, 0.78);
  backdrop-filter: blur(10px);
}

.stage-toggle {
  min-height: 30px;
  padding: 5px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: rgba(31, 49, 39, 0.72);
  font-size: 0.82rem;
  font-weight: 650;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease;
}

.stage-toggle:disabled {
  opacity: 0.65;
  cursor: wait;
}

.stage-toggle:hover,
.stage-toggle:focus-visible {
  background: rgba(255, 255, 255, 0.72);
  outline: none;
}

.stage-toggle--active {
  border-color: rgba(31, 49, 39, 0.16);
  background: #26382f;
  color: #ffffff;
}

.support-rail {
  min-height: 0;
  display: grid;
  grid-template-columns: 50% 50%;
}

.season-clock-panel,
.user-mirror-panel {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.season-clock-panel {
  display: grid;
  place-items: center;
  padding: 8px;
  border-right: 1px solid rgba(36, 54, 42, 0.14);
}

.audio-debug {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: grid;
  width: min(220px, calc(100% - 20px));
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
  padding: 8px;
  border: 1px solid rgba(31, 49, 39, 0.14);
  border-radius: 8px;
  background: rgba(248, 251, 247, 0.82);
  color: #26382f;
  font-size: 0.72rem;
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.audio-debug div {
  min-width: 0;
}

.audio-debug dt {
  color: rgba(31, 49, 39, 0.58);
  font-size: 0.64rem;
  font-weight: 750;
  text-transform: uppercase;
}

.audio-debug dd {
  margin: 1px 0 0;
  overflow: hidden;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.season-clock-panel :deep(.season-clock) {
  width: min(94%, 320px, calc(30dvh - 44px));
  gap: 6px;
  padding: 9px;
  box-shadow: none;
}

.user-mirror-panel {
  background: #121714;
}

.user-mirror-panel :deep(.container) {
  border-radius: 0;
}
</style>
