<template>
  <main class="act2-page">
    <section class="act2-map" aria-label="Act 2 migration map">
      <BirdMap :show-controls="false" :story-cycle-ids="[act2.cycleId]" />
    </section>

    <section class="act2-stage" aria-label="Act 2 story stage">
      <section class="act2-instructor" aria-label="Instruction avatar">
        <div class="act2-instructor__surface">
          <div class="act2-status">
            <span>{{ act2.title }}</span>
            <strong>Cycle {{ activeCycle }} / {{ repeatCount }}</strong>
          </div>

          <MovementStage
            :landmarks="instructorLandmarks"
            source-mode="recorded-motion"
            :source-aspect="instructorSourceAspect"
          />

          <div v-if="showCycleCompleted" class="act2-overlay">
            Cycle completed
          </div>

          <div v-if="runtimeStore.showContinueGate" class="act2-overlay">
            <strong>Act 2 completed</strong>
            <button type="button" @click="continueToNextAct">Continue</button>
          </div>
        </div>
      </section>

      <section class="act2-support" aria-label="Act 2 support views">
        <section class="act2-clock-panel" aria-label="Season clock">
          <SeasonClock :show-controls="false">
            <span class="act2-clock-date">{{ currentDate }}</span>
          </SeasonClock>
        </section>

        <section class="act2-mirror" aria-label="User mirror">
          <MovementCamera mode="camera" :fixed="false" :show-hands="false" />
        </section>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import BirdMap from "~/components/map/BirdMap.vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import { useMovementPlayback } from "~/composables/useMovementPlayback";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useAudioStore } from "~/store/audioStore";
import { useStoryPlaybackStore } from "~/store/storyPlayback";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import { act2 } from "~/story/acts/act2";
import type { MovementRecording } from "~/types/movement";
import {
  buildPhaseSmoothedCycleTimeline,
  getWeightedStoryTimelineDayAtElapsedMs,
  STORY_CYCLE_DURATION_MS,
} from "~/utils/storyCycle";
import { storyCycleDefinitions } from "~/utils/storkStoryCycles";

const repeatCount = act2.repeatCount ?? 3;
const cycleDurationMs = act2.cycleDurationMs ?? STORY_CYCLE_DURATION_MS;
const cycleStartYear = act2.cycleStartYear ?? 2016;
const storyCycle = storyCycleDefinitions.find(
  (cycle) => cycle.label === act2.cycleId,
);
const storyTimeline = buildPhaseSmoothedCycleTimeline(storyCycle, {
  year: cycleStartYear,
  cycleDurationMs,
});
const firstTimelineDay = storyTimeline[0];
const lastTimelineDay = storyTimeline[storyTimeline.length - 1];
const firstCycleDate = firstTimelineDay?.date ?? `${cycleStartYear}-06-01`;
const lastCycleDate = lastTimelineDay?.date ?? `${cycleStartYear + 1}-05-31`;
const testDanceUrl = new URL(
  "../../assets/movement_library/test-dance.json",
  import.meta.url,
).href;

const storyEngine = useStoryEngine();
const audioStore = useAudioStore();
const runtimeStore = useStoryRuntimeStore();
const storyPlaybackStore = useStoryPlaybackStore();
const { currentDate } = storeToRefs(storyPlaybackStore);
const {
  currentFrame,
  loadRecording,
  play: playInstructorMovement,
  stop: stopInstructorMovement,
} = useMovementPlayback();

const instructorRecording = ref<MovementRecording | null>(null);
const isLoadingInstructor = ref(false);
const activeCycle = ref(1);
const completedCycles = ref(0);
const showCycleCompleted = ref(false);
const isCycleRunning = ref(false);

let animationFrameId = 0;
let cycleStartedAtMs = 0;
let overlayTimer: ReturnType<typeof setTimeout> | null = null;

const instructorLandmarks = computed(
  () => currentFrame.value?.landmarks ?? null,
);

const instructorSourceAspect = computed(() => {
  const source = instructorRecording.value?.source;

  if (!source?.width || !source.height) return 4 / 3;

  return source.width / source.height;
});

const clearAnimationFrame = () => {
  if (!animationFrameId) return;

  cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;
};

const clearOverlayTimer = () => {
  if (!overlayTimer) return;

  clearTimeout(overlayTimer);
  overlayTimer = null;
};

const setRuntimeSceneForCycle = () => {
  const sceneIndex = Math.min(completedCycles.value, act2.scenes.length - 1);

  runtimeStore.setCurrentScene(sceneIndex);
};

const loadInstructorRecording = async () => {
  if (instructorRecording.value || isLoadingInstructor.value) {
    return instructorRecording.value;
  }

  isLoadingInstructor.value = true;

  try {
    const response = await fetch(testDanceUrl);

    if (!response.ok) {
      throw new Error(`Could not load ${act2.instructorMovementId}.`);
    }

    instructorRecording.value = (await response.json()) as MovementRecording;

    return instructorRecording.value;
  } finally {
    isLoadingInstructor.value = false;
  }
};

const updateCycleDate = (elapsedMs: number) => {
  const timelineDay =
    getWeightedStoryTimelineDayAtElapsedMs(storyTimeline, elapsedMs) ??
    (elapsedMs >= cycleDurationMs ? lastTimelineDay : firstTimelineDay);

  if (!timelineDay || timelineDay.date === currentDate.value) return;

  storyPlaybackStore.seekToDate(timelineDay.date);
};

const completeCycle = () => {
  clearAnimationFrame();
  isCycleRunning.value = false;
  audioStore.pauseBaseRhythmLoop();
  completedCycles.value++;
  showCycleCompleted.value = true;
  storyPlaybackStore.seekToDate(lastCycleDate);
  setRuntimeSceneForCycle();

  overlayTimer = setTimeout(() => {
    showCycleCompleted.value = false;

    if (completedCycles.value >= repeatCount) {
      runtimeStore.completeAct();
      stopInstructorMovement();
      audioStore.resetBaseRhythmLoop();
      return;
    }

    activeCycle.value = completedCycles.value + 1;
    startCycle();
  }, 1800);
};

const tickCycle = () => {
  if (!isCycleRunning.value) return;

  const elapsedMs = performance.now() - cycleStartedAtMs;

  if (elapsedMs >= cycleDurationMs) {
    completeCycle();
    return;
  }

  updateCycleDate(elapsedMs);
  animationFrameId = requestAnimationFrame(tickCycle);
};

const startCycle = () => {
  clearAnimationFrame();
  clearOverlayTimer();
  setRuntimeSceneForCycle();
  storyPlaybackStore.seekToDate(firstCycleDate);
  audioStore.resetBaseRhythmLoop();
  void audioStore.startBaseRhythmLoop(0);
  cycleStartedAtMs = performance.now();
  isCycleRunning.value = true;
  animationFrameId = requestAnimationFrame(tickCycle);
};

const startAct = async () => {
  clearAnimationFrame();
  clearOverlayTimer();
  stopInstructorMovement();

  storyEngine.startAct(act2.id);
  storyPlaybackStore.pause();
  audioStore.resetBaseRhythmLoop();
  activeCycle.value = 1;
  completedCycles.value = 0;
  showCycleCompleted.value = false;

  const recording = await loadInstructorRecording();

  if (recording) {
    loadRecording(recording);
    playInstructorMovement({ loop: true });
  }

  startCycle();
};

const continueToNextAct = async () => {
  const nextActId = runtimeStore.currentAct?.nextActId;

  storyEngine.continueFromGate();

  if (!nextActId) return;

  await navigateTo(`/story/${nextActId}`);
};

onMounted(() => {
  void startAct();
});

onBeforeUnmount(() => {
  clearAnimationFrame();
  clearOverlayTimer();
  stopInstructorMovement();
  storyPlaybackStore.pause();
  audioStore.resetBaseRhythmLoop();
  storyEngine.stopStoryEngine();
});
</script>

<style scoped>
.act2-page {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-columns: 50% 50%;
  overflow: hidden;
  background: #edf2ef;
}

.act2-map,
.act2-stage,
.act2-instructor,
.act2-support,
.act2-clock-panel,
.act2-mirror {
  min-width: 0;
  min-height: 0;
}

.act2-map {
  border-right: 1px solid rgba(36, 54, 42, 0.16);
}

.act2-stage {
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

.act2-instructor {
  padding: 18px 20px;
  border-bottom: 1px solid rgba(36, 54, 42, 0.14);
}

.act2-instructor__surface {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.act2-status {
  position: absolute;
  z-index: 2;
  top: 12px;
  left: 12px;
  display: grid;
  gap: 3px;
  padding: 8px 10px;
  border: 1px solid rgba(31, 49, 39, 0.14);
  border-radius: 8px;
  background: rgba(248, 251, 247, 0.82);
  color: rgba(31, 49, 39, 0.76);
  font-size: 0.78rem;
  font-weight: 650;
  backdrop-filter: blur(10px);
}

.act2-status strong {
  color: #26382f;
  font-size: 0.9rem;
}

.act2-overlay {
  position: absolute;
  z-index: 3;
  inset: 0;
  display: grid;
  place-items: center;
  gap: 12px;
  padding: 20px;
  background: rgba(238, 244, 240, 0.72);
  color: #17211b;
  font-size: clamp(1.4rem, 4vw, 2.6rem);
  font-weight: 800;
  text-align: center;
  backdrop-filter: blur(4px);
}

.act2-overlay strong {
  font-size: clamp(1.5rem, 4vw, 2.8rem);
}

.act2-overlay button {
  min-height: 42px;
  padding: 10px 18px;
  border: 1px solid #26382f;
  border-radius: 8px;
  background: #26382f;
  color: #ffffff;
  font-size: 0.96rem;
  font-weight: 750;
  cursor: pointer;
}

.act2-support {
  display: grid;
  grid-template-columns: 50% 50%;
}

.act2-clock-panel,
.act2-mirror {
  position: relative;
  overflow: hidden;
}

.act2-clock-panel {
  display: grid;
  place-items: center;
  padding: 8px;
  border-right: 1px solid rgba(36, 54, 42, 0.14);
}

.act2-clock-panel :deep(.season-clock) {
  width: min(94%, 320px, calc(30dvh - 28px));
  gap: 6px;
  padding: 9px;
  box-shadow: none;
}

.act2-clock-date {
  color: #26382f;
  font-size: 0.78rem;
  font-weight: 800;
}

.act2-mirror {
  background: #121714;
}

.act2-mirror :deep(.container) {
  border-radius: 0;
}

@media (max-width: 860px) {
  .act2-page {
    grid-template-columns: 1fr;
    grid-template-rows: 46% 54%;
  }
}
</style>
