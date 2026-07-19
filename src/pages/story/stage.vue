<template>
  <main class="story-stage-page">
    <section class="map-panel" aria-label="Story map">
      <BirdMap />
    </section>

    <section class="movement-panel" aria-label="Movement stage">
      <section class="avatar-stage" aria-label="Avatar stage">
        <div class="avatar-stage__surface">
          <div class="avatar-stage__toolbar" aria-label="Movement source">
            <button
              class="stage-toggle"
              type="button"
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
              :disabled="isTestDanceLoading"
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
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import BirdMap from "~/components/map/BirdMap.vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import { useMovementPlayback } from "~/composables/useMovementPlayback";
import { useAudioStore } from "~/store/audioStore";
import { useStoryPlaybackStore } from "~/store/storyPlayback";
import type { AvatarSourceMode, MovementRecording } from "~/types/movement";

const poseLandmarks = ref<NormalizedLandmark[] | null>(null);
const avatarSourceMode = ref<AvatarSourceMode>("live-camera");
const testDanceRecording = ref<MovementRecording | null>(null);
const isTestDanceLoading = ref(false);
const audioStore = useAudioStore();
const storyPlaybackStore = useStoryPlaybackStore();
const baseRhythmLoop = computed(() => audioStore.baseRhythmLoop);
const baseRhythmPosition = computed(() => audioStore.baseRhythmPosition);
const baseRhythmStatus = computed(() => {
  if (baseRhythmLoop.value.isLoading) return "loading";
  if (!baseRhythmLoop.value.isLoaded) return "click play";

  return baseRhythmLoop.value.isPlaying ? "playing" : "loaded";
});
const testDanceUrl = new URL(
  "../../assets/movement_library/test-dance.json",
  import.meta.url,
).href;

const {
  currentFrame,
  loadRecording,
  play: playRecording,
  stop: stopRecording,
} = useMovementPlayback();

const recordedLandmarks = computed(() => currentFrame.value?.landmarks ?? null);

const stageLandmarks = computed(() =>
  avatarSourceMode.value === "recorded-motion"
    ? recordedLandmarks.value
    : poseLandmarks.value,
);

const stageSourceAspect = computed(() => {
  if (avatarSourceMode.value !== "recorded-motion") return 4 / 3;

  const source = testDanceRecording.value?.source;
  if (!source?.width || !source.height) return 4 / 3;

  return source.width / source.height;
});

const loadTestDanceRecording = async () => {
  if (testDanceRecording.value) return testDanceRecording.value;

  isTestDanceLoading.value = true;

  try {
    const response = await fetch(testDanceUrl);
    const recording = (await response.json()) as MovementRecording;

    testDanceRecording.value = recording;

    return recording;
  } finally {
    isTestDanceLoading.value = false;
  }
};

const setAvatarSourceMode = async (mode: AvatarSourceMode) => {
  avatarSourceMode.value = mode;

  if (mode === "recorded-motion") {
    const recording = await loadTestDanceRecording();

    loadRecording(recording);
    playRecording({ loop: true });

    return;
  }

  stopRecording();
};

let audioDebugTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  audioDebugTimer = setInterval(() => {
    audioStore.syncBaseRhythmLoopOffset();
  }, 250);
});

onBeforeUnmount(() => {
  if (audioDebugTimer) {
    clearInterval(audioDebugTimer);
    audioDebugTimer = null;
  }

  stopRecording();
  storyPlaybackStore.pause();
});
</script>

<style scoped>
.story-stage-page {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-columns: 60% 40%;
  overflow: hidden;
  background: #edf2ef;
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
