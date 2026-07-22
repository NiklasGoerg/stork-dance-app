<template>
  <main class="story-stage-page">
    <section
      class="map-panel"
      :class="{ 'map-panel--gesture-active': isGestureActive }"
      aria-label="Story map"
    >
      <div class="map-panel__content">
        <BirdMap
          :story-cycle-definitions="storyCycleDefinitions"
          :single-story-cycle-mode="true"
        />
      </div>

      <StoryGestureOverlay
        :gesture-label="gestureOverlayLabel"
        :state="gestureState"
        :feedback-text="storyGestureStore.feedbackText"
        :show-dev-controls="isGestureDevControlsVisible"
        @mark="storyGestureStore.markGestureSuccessful"
        @repeat="storyGestureStore.repeatAttempt"
        @cancel="storyGestureStore.cancelGesture"
      />
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
      <div class="story-cycle-controls__actions">
        <button
          class="btn btn--primary"
          type="button"
          :disabled="isStoryPlaybackControlDisabled"
          @click="storyPlaybackStore.togglePlayback"
        >
          {{ storyPlaybackStore.isPlaying ? "Pause Story" : "Play Story" }}
        </button>
        <button
          class="btn"
          type="button"
          :disabled="isStoryPlaybackControlDisabled"
          @click="restartStoryCycle"
        >
          Restart
        </button>
      </div>

      <div class="gesture-test-controls__actions">
        <button
          class="btn btn--primary"
          type="button"
          :disabled="isManualGestureDisabled"
          @click="startManualGesture('arrival')"
        >
          Test Arrival Gesture
        </button>
        <button
          class="btn btn--primary"
          type="button"
          :disabled="isManualGestureDisabled"
          @click="startManualGesture('departure')"
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
          <dt>Story</dt>
          <dd>{{ storyPlaybackDebugLabel }}</dd>
        </div>
        <div>
          <dt>Auto</dt>
          <dd>{{ automaticGestureDebugLabel }}</dd>
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
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BirdMap from "~/components/map/BirdMap.vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import StoryGestureOverlay from "~/components/story/StoryGestureOverlay.vue";
import { useMovementPlayback } from "~/composables/useMovementPlayback";
import { usePoseComparison } from "~/composables/usePoseComparison";
import { useStorkData } from "~/composables/useStorkData";
import { loadGestureMovement } from "~/story/gestureMovements";
import type { StoryGestureId } from "~/story/gestures";
import {
  createStoryGestureEvents,
  formatStoryGestureEventLabel,
  type StoryGestureEvent,
} from "~/story/storyGestureEvents";
import { useAudioStore } from "~/store/audioStore";
import { useStoryGestureStore } from "~/store/storyGestureStore";
import type { StoryGestureResult } from "~/store/storyGestureStore";
import { useStoryPlaybackStore } from "~/store/storyPlayback";
import type { PoseLandmarkLike } from "~/types/pose";
import type { AvatarSourceMode, MovementRecording } from "~/types/movement";
import { normalizeMovementRecordingToViewport } from "~/utils/movementFrames";
import { buildPhaseSmoothedCycleTimeline } from "~/utils/storyCycle";
import { storyCycleDefinitions } from "~/utils/storkStoryCycles";

const poseLandmarks = ref<PoseLandmarkLike[] | null>(null);
const avatarSourceMode = ref<AvatarSourceMode>("live-camera");
const testDanceRecording = ref<MovementRecording | null>(null);
const gestureMovementRecording = ref<MovementRecording | null>(null);
const isTestDanceLoading = ref(false);
const isGestureMovementLoading = ref(false);
const previousAvatarSourceMode = ref<AvatarSourceMode | null>(null);
const storyGestureEvents = ref<StoryGestureEvent[]>([]);
const activeAutomaticGestureEventId = ref<string | null>(null);
const isAutomaticGestureTransitioning = ref(false);
const avatarStageAspect = 16 / 9;
const audioStore = useAudioStore();
const storyPlaybackStore = useStoryPlaybackStore();
const storyGestureStore = useStoryGestureStore();
const { selectedMapMode, selectedStoryCycleIds, showStoryCyclesTogether } =
  useStorkData({
    storyCycleDefinitions,
  });
const automaticGesturePauseReason = "automatic-story-gesture";
const baseRhythmLoop = computed(() => audioStore.baseRhythmLoop);
const baseRhythmPosition = computed(() => audioStore.baseRhythmPosition);
const activeGesture = computed(() => storyGestureStore.activeGesture);
const gestureState = computed(() => storyGestureStore.state);
const isGestureActive = computed(() => storyGestureStore.isActive);
const selectedStoryCycle = computed(
  () =>
    storyCycleDefinitions.find(
      (cycle) => cycle.label === selectedStoryCycleIds.value[0],
    ) ?? storyCycleDefinitions[0]!,
);
const isAutomaticGestureContextReady = computed(
  () =>
    selectedMapMode.value === "story" &&
    selectedStoryCycleIds.value.length === 1 &&
    !showStoryCyclesTogether.value,
);
const selectedStoryTimeline = computed(() =>
  buildPhaseSmoothedCycleTimeline(selectedStoryCycle.value, {
    year: selectedStoryCycle.value.targetYear,
  }),
);
const activeAutomaticGestureEvent = computed(() =>
  storyGestureEvents.value.find(
    (event) => event.id === activeAutomaticGestureEventId.value,
  ),
);
const gestureOverlayLabel = computed(() =>
  activeAutomaticGestureEvent.value
    ? formatStoryGestureEventLabel(activeAutomaticGestureEvent.value)
    : (activeGesture.value?.label ?? "Gesture"),
);
const isStoryPlaybackControlDisabled = computed(
  () =>
    isGestureActive.value ||
    isAutomaticGestureTransitioning.value ||
    !isAutomaticGestureContextReady.value,
);
const isManualGestureDisabled = computed(
  () =>
    isGestureActive.value ||
    isAutomaticGestureTransitioning.value ||
    storyPlaybackStore.isPlaying,
);
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
const storyPlaybackDebugLabel = computed(
  () =>
    `${storyPlaybackStore.isPlaying ? "playing" : "paused"} @ ${(
      storyPlaybackStore.currentElapsedMs / 1000
    ).toFixed(1)}s`,
);
const automaticGestureDebugLabel = computed(() => {
  if (!isAutomaticGestureContextReady.value) return "disabled";

  const activeEvent = activeAutomaticGestureEvent.value;

  if (activeEvent) return `${formatStoryGestureEventLabel(activeEvent)}`;

  const counts = storyGestureEvents.value.reduce(
    (summary, event) => {
      summary[event.status]++;
      return summary;
    },
    { pending: 0, active: 0, completed: 0, skipped: 0 },
  );

  return `${counts.completed + counts.skipped}/${storyGestureEvents.value.length}`;
});
const baseRhythmStatus = computed(() => {
  if (baseRhythmLoop.value.isLoading) return "loading";
  if (!baseRhythmLoop.value.isLoaded) return "click play";

  return baseRhythmLoop.value.isPlaying ? "playing" : "loaded";
});
const isGestureDevControlsVisible = import.meta.dev;
const {
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

const logAutomaticStoryGesture = (message: string, details?: unknown) => {
  if (!import.meta.dev) return;

  if (details === undefined) {
    console.info(`[StoryGesture] ${message}`);
    return;
  }

  console.info(`[StoryGesture] ${message}`, details);
};

const resetAutomaticGestureEvents = (reason: string) => {
  storyGestureEvents.value = createStoryGestureEvents(
    selectedStoryCycle.value,
    selectedStoryTimeline.value,
    `${selectedStoryCycle.value.targetYear}-06-01`,
  );
  activeAutomaticGestureEventId.value = null;

  logAutomaticStoryGesture(
    `Created ${storyGestureEvents.value.length} events for cycle ${selectedStoryCycle.value.label}`,
    {
      reason,
      events: storyGestureEvents.value.map((event) => ({
        id: event.id,
        boundaryDate: event.boundaryDate,
        boundaryTimeS: (event.boundaryTimeMs / 1000).toFixed(1),
      })),
    },
  );
};

const configureSelectedStoryCycle = () => {
  if (!isAutomaticGestureContextReady.value) return;

  storyPlaybackStore.configureCycle(selectedStoryCycle.value);
  resetAutomaticGestureEvents("cycle configured");
};

const setAutomaticGestureEventStatus = (
  eventId: string,
  status: StoryGestureEvent["status"],
) => {
  storyGestureEvents.value = storyGestureEvents.value.map((event) =>
    event.id === eventId ? { ...event, status } : event,
  );
};

const getFirstCrossedPendingEvent = (
  previousElapsedMs: number,
  currentElapsedMs: number,
) =>
  storyGestureEvents.value.find(
    (event) =>
      event.status === "pending" &&
      previousElapsedMs < event.boundaryTimeMs &&
      currentElapsedMs >= event.boundaryTimeMs,
  ) ?? null;

const getGestureResultEventStatus = (result: StoryGestureResult) =>
  result === "completed" ? "completed" : "skipped";

// Pauses the story exactly at a phase boundary, delegates to the existing gesture flow, then resumes.
const runAutomaticGestureEvent = async (event: StoryGestureEvent) => {
  if (isAutomaticGestureTransitioning.value || storyGestureStore.isActive) {
    logAutomaticStoryGesture("Automatic trigger ignored: gesture busy");
    return;
  }

  isAutomaticGestureTransitioning.value = true;
  activeAutomaticGestureEventId.value = event.id;
  setAutomaticGestureEventStatus(event.id, "active");

  const label = formatStoryGestureEventLabel(event);
  const shouldResumeStoryPlayback =
    storyPlaybackStore.pauseStoryPlaybackAtElapsedMs(
      event.boundaryTimeMs,
      automaticGesturePauseReason,
    );

  logAutomaticStoryGesture(`Crossing ${label.toLowerCase()} boundary`, {
    boundaryDate: event.boundaryDate,
    boundaryTimeS: (event.boundaryTimeMs / 1000).toFixed(1),
  });
  logAutomaticStoryGesture(
    `Story paused at ${(event.boundaryTimeMs / 1000).toFixed(1)} s`,
  );
  logAutomaticStoryGesture(`Starting ${event.type} gesture`);

  try {
    const result = await storyGestureStore.startGesture(event.type);
    const status = getGestureResultEventStatus(result);

    setAutomaticGestureEventStatus(event.id, status);

    if (result === "completed") {
      logAutomaticStoryGesture(`${label} completed`);
    } else {
      logAutomaticStoryGesture(`${label} skipped`, { result });
    }
  } catch (error) {
    setAutomaticGestureEventStatus(event.id, "skipped");
    console.error("[StoryGesture] Automatic gesture failed.", error);
  } finally {
    activeAutomaticGestureEventId.value = null;
    previousStoryElapsedMs = event.boundaryTimeMs;

    if (shouldResumeStoryPlayback && !isUnmounting) {
      storyPlaybackStore.resumeStoryPlayback(automaticGesturePauseReason);
      logAutomaticStoryGesture(
        `Resuming story at ${(event.boundaryTimeMs / 1000).toFixed(1)} s`,
      );
    } else {
      storyPlaybackStore.releaseStoryPlaybackPause(automaticGesturePauseReason);
    }

    isAutomaticGestureTransitioning.value = false;
  }
};

const handleAutomaticGestureCrossing = (
  previousElapsedMs: number,
  currentElapsedMs: number,
) => {
  if (isAutomaticGestureTransitioning.value) return;
  if (storyGestureStore.isActive) return;
  if (!isAutomaticGestureContextReady.value) return;
  if (storyPlaybackStore.isSeeking) return;
  if (!storyPlaybackStore.isPlaying) return;
  if (currentElapsedMs <= previousElapsedMs) return;

  const event = getFirstCrossedPendingEvent(
    previousElapsedMs,
    currentElapsedMs,
  );

  if (!event) return;

  void runAutomaticGestureEvent(event);
};

const startManualGesture = (id: StoryGestureId) => {
  if (isManualGestureDisabled.value) return;

  void storyGestureStore.startGesture(id);
};

const restartStoryCycle = () => {
  storyPlaybackStore.resetToStoryStart();
  resetAutomaticGestureEvents("story restarted");
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
let previousStoryElapsedMs = storyPlaybackStore.currentElapsedMs;
let handledSeekRevision = storyPlaybackStore.seekRevision;

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
  [
    selectedMapMode,
    () => selectedStoryCycleIds.value.join("|"),
    showStoryCyclesTogether,
  ],
  () => {
    if (!isAutomaticGestureContextReady.value) {
      storyGestureEvents.value = [];
      activeAutomaticGestureEventId.value = null;
      previousStoryElapsedMs = storyPlaybackStore.currentElapsedMs;
      handledSeekRevision = storyPlaybackStore.seekRevision;
      return;
    }

    configureSelectedStoryCycle();
    previousStoryElapsedMs = storyPlaybackStore.currentElapsedMs;
    handledSeekRevision = storyPlaybackStore.seekRevision;
  },
  { immediate: true },
);

watch(
  () => storyPlaybackStore.playbackSessionId,
  () => {
    resetAutomaticGestureEvents("playback session reset");
    previousStoryElapsedMs = storyPlaybackStore.currentElapsedMs;
  },
);

watch(
  () => storyPlaybackStore.seekRevision,
  (seekRevision) => {
    handledSeekRevision = seekRevision;
    previousStoryElapsedMs = storyPlaybackStore.currentElapsedMs;
  },
);

watch(
  () => storyPlaybackStore.currentElapsedMs,
  (currentElapsedMs) => {
    if (handledSeekRevision !== storyPlaybackStore.seekRevision) {
      handledSeekRevision = storyPlaybackStore.seekRevision;
      previousStoryElapsedMs = currentElapsedMs;
      return;
    }

    const previousElapsedMs = previousStoryElapsedMs;

    previousStoryElapsedMs = currentElapsedMs;
    handleAutomaticGestureCrossing(previousElapsedMs, currentElapsedMs);
  },
);

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

  activeAutomaticGestureEventId.value = null;
  isAutomaticGestureTransitioning.value = false;
  storyPlaybackStore.releaseStoryPlaybackPause(automaticGesturePauseReason);
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

.story-cycle-controls__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(31, 49, 39, 0.12);
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
  isolation: isolate;
  overflow: hidden;
  border-right: 1px solid rgba(36, 54, 42, 0.16);
}

.map-panel__content {
  position: absolute;
  inset: 0;
  z-index: 1;
  min-width: 0;
  min-height: 0;
  transition:
    filter 0.18s ease,
    opacity 0.18s ease;
}

.map-panel--gesture-active .map-panel__content {
  filter: grayscale(0.45) brightness(0.82);
  opacity: 0.5;
}

.map-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgba(240, 244, 239, 0.62);
  opacity: 0;
  pointer-events: none;
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
