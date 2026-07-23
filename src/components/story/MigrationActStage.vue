<template>
  <main class="act2-page">
    <section
      class="act2-map"
      :aria-label="t('story.aria.map', { title: actTitle })"
    >
      <BirdMap
        :show-controls="false"
        :show-map-navigation="false"
        :story-cycle-ids="[activeCycleConfig.cycleId]"
        :story-cycle-definitions="activeCycleDefinitions"
      />
      <StoryProgressSidebar />
    </section>

    <section
      class="act2-stage"
      :aria-label="t('story.aria.stage', { title: actTitle })"
    >
      <section
        class="act2-comparison"
        :aria-label="t('story.aria.support', { title: actTitle })"
      >
        <section
          class="act2-instructor"
          :aria-label="t('story.aria.instructor')"
        >
          <div class="act2-instructor__surface">
            <div class="act2-status">
              <span>{{ actTitle }}</span>
              <strong>
                {{
                  t("story.acts.act2.cycleCount", {
                    current: activeCycleNumber,
                    total: cycleCount,
                  })
                }}
              </strong>
              <span v-if="activeCycleConfig.title">
                {{ activeCycleTitle }}
              </span>
            </div>

            <MovementStage
              :landmarks="instructorLandmarks"
              source-mode="recorded-motion"
              :source-aspect="instructorSourceAspect"
              :fill-frame="true"
            />

            <div v-if="showCycleCompleted" class="act2-overlay">
              {{ t("story.acts.act2.cycleCompleted") }}
            </div>

            <div v-if="runtimeStore.showContinueGate" class="act2-overlay">
              <strong>
                {{ t("story.acts.act2.actCompleted", { title: actTitle }) }}
              </strong>
              <button type="button" @click="continueToNextAct">
                {{ t("common.continue") }}
              </button>
            </div>
          </div>
        </section>

        <section class="act2-mirror" :aria-label="t('story.aria.userMirror')">
          <MovementCamera mode="camera" :fixed="false" :show-hands="false" />
        </section>
      </section>

      <section class="act2-info-panel" :aria-label="activeSceneTitle">
        <p class="act2-info-panel__eyebrow">{{ currentDate }}</p>
        <h1>{{ activeSceneTitle }}</h1>
        <p>{{ activeSceneNarration }}</p>

        <dl class="act2-info-panel__meta">
          <div>
            <dt>{{ actTitle }}</dt>
            <dd>
              {{
                t("story.acts.act2.cycleCount", {
                  current: activeCycleNumber,
                  total: cycleCount,
                })
              }}
            </dd>
          </div>
          <div v-if="activeCycleTitle">
            <dt>{{ t("map.storyCycles") }}</dt>
            <dd>{{ activeCycleTitle }}</dd>
          </div>
        </dl>
      </section>
    </section>

    <section class="act2-clock-panel" :aria-label="t('story.aria.seasonClock')">
      <SeasonClock :show-controls="false">
        <span class="act2-clock-date">{{ currentDate }}</span>
      </SeasonClock>
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
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useMovementPlayback } from "~/composables/useMovementPlayback";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useAudioStore } from "~/store/audioStore";
import { useStoryPlaybackStore } from "~/store/storyPlayback";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import {
  findMigrationCycleDefinition,
  getMigrationCycleDefinitions,
  resolveMigrationActCycles,
} from "~/story/migrationCycles";
import type { StoryAct } from "~/story/types";
import type { MovementRecording } from "~/types/movement";
import {
  buildPhaseSmoothedCycleTimeline,
  getWeightedStoryTimelineDayAtElapsedMs,
  STORY_CYCLE_DURATION_MS,
} from "~/utils/storyCycle";

const props = defineProps<{
  act: StoryAct;
}>();

const {
  t,
  getActTitle,
  getSceneTitle,
  getSceneNarration,
  getMigrationCycleTitle,
} = useStoryTranslations();
const act = computed(() => props.act);
const actTitle = computed(() => getActTitle(act.value));
const migrationCycles = computed(() => resolveMigrationActCycles(act.value));
const cycleCount = computed(() => migrationCycles.value.length);
const activeCycleIndex = ref(0);
const activeCycleNumber = computed(() => activeCycleIndex.value + 1);
const activeCycleConfig = computed(
  () =>
    migrationCycles.value[activeCycleIndex.value] ??
    migrationCycles.value[0] ?? {
      id: "fallback-cycle",
      cycleId: act.value.cycleId ?? "",
      cycleStartYear: act.value.cycleStartYear,
      cycleDurationMs: act.value.cycleDurationMs,
    },
);
const activeCycleTitle = computed(() =>
  getMigrationCycleTitle(activeCycleConfig.value),
);
const activeCycleDefinitions = computed(() =>
  getMigrationCycleDefinitions(activeCycleConfig.value),
);
const activeStoryCycle = computed(() =>
  findMigrationCycleDefinition(activeCycleConfig.value),
);
const activeCycleDurationMs = computed(
  () => activeCycleConfig.value.cycleDurationMs ?? STORY_CYCLE_DURATION_MS,
);
const activeCycleStartYear = computed(
  () =>
    activeCycleConfig.value.cycleStartYear ??
    activeStoryCycle.value?.targetYear ??
    act.value.cycleStartYear ??
    2016,
);
const activeStoryTimeline = computed(() =>
  buildPhaseSmoothedCycleTimeline(activeStoryCycle.value, {
    year: activeCycleStartYear.value,
    cycleDurationMs: activeCycleDurationMs.value,
  }),
);
const firstTimelineDay = computed(() => activeStoryTimeline.value[0]);
const lastTimelineDay = computed(
  () => activeStoryTimeline.value[activeStoryTimeline.value.length - 1],
);
const firstCycleDate = computed(
  () => firstTimelineDay.value?.date ?? `${activeCycleStartYear.value}-06-01`,
);
const lastCycleDate = computed(
  () =>
    lastTimelineDay.value?.date ?? `${activeCycleStartYear.value + 1}-05-31`,
);
const instructorMovementId = computed(
  () => act.value.instructorMovementId ?? "test-dance",
);
const instructorMovementUrlById = {
  "test-dance": new URL(
    "../../assets/movement_library/test-dance.json",
    import.meta.url,
  ).href,
};
const instructorMovementUrl = computed(
  () =>
    instructorMovementUrlById[
      instructorMovementId.value as keyof typeof instructorMovementUrlById
    ],
);
const completionDelayMs = 1800;

if (cycleCount.value === 0) {
  throw new Error(`${act.value.title} has no migration cycles configured.`);
}

const storyEngine = useStoryEngine();
const audioStore = useAudioStore();
const runtimeStore = useStoryRuntimeStore();
const storyPlaybackStore = useStoryPlaybackStore();
const { currentDate } = storeToRefs(storyPlaybackStore);
const activeScene = computed(
  () => runtimeStore.currentScene ?? act.value.scenes[activeCycleIndex.value],
);
const activeSceneTitle = computed(() =>
  activeScene.value ? getSceneTitle(activeScene.value) : actTitle.value,
);
const activeSceneNarration = computed(() =>
  activeScene.value ? getSceneNarration(activeScene.value) : "",
);
const {
  currentFrame,
  loadRecording,
  play: playInstructorMovement,
  stop: stopInstructorMovement,
} = useMovementPlayback();

const instructorRecording = ref<MovementRecording | null>(null);
const isLoadingInstructor = ref(false);
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
  const sceneIndex = Math.min(
    completedCycles.value,
    act.value.scenes.length - 1,
  );

  runtimeStore.setCurrentScene(sceneIndex);
};

const loadInstructorRecording = async () => {
  if (instructorRecording.value || isLoadingInstructor.value) {
    return instructorRecording.value;
  }

  isLoadingInstructor.value = true;

  try {
    if (!instructorMovementUrl.value) {
      throw new Error(`Could not load ${instructorMovementId.value}.`);
    }

    const response = await fetch(instructorMovementUrl.value);

    if (!response.ok) {
      throw new Error(`Could not load ${instructorMovementId.value}.`);
    }

    instructorRecording.value = (await response.json()) as MovementRecording;

    return instructorRecording.value;
  } finally {
    isLoadingInstructor.value = false;
  }
};

const updateCycleDate = (elapsedMs: number) => {
  const timelineDay =
    getWeightedStoryTimelineDayAtElapsedMs(
      activeStoryTimeline.value,
      elapsedMs,
    ) ??
    (elapsedMs >= activeCycleDurationMs.value
      ? lastTimelineDay.value
      : firstTimelineDay.value);

  if (!timelineDay || timelineDay.date === currentDate.value) return;

  storyPlaybackStore.seekToDate(timelineDay.date);
};

const completeCycle = () => {
  clearAnimationFrame();
  isCycleRunning.value = false;
  storyPlaybackStore.pause();
  audioStore.resetBaseRhythmLoop();
  completedCycles.value++;
  showCycleCompleted.value = true;
  storyPlaybackStore.seekToDate(lastCycleDate.value);

  const hasNextCycle = completedCycles.value < cycleCount.value;

  if (hasNextCycle) {
    activeCycleIndex.value = completedCycles.value;
    storyPlaybackStore.seekToDate(firstCycleDate.value);
  }

  setRuntimeSceneForCycle();

  overlayTimer = setTimeout(() => {
    showCycleCompleted.value = false;

    if (!hasNextCycle) {
      runtimeStore.completeAct();
      stopInstructorMovement();
      audioStore.resetBaseRhythmLoop();
      return;
    }

    startCycle();
  }, completionDelayMs);
};

const tickCycle = () => {
  if (!isCycleRunning.value) return;

  const elapsedMs = performance.now() - cycleStartedAtMs;

  if (elapsedMs >= activeCycleDurationMs.value) {
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
  storyPlaybackStore.pause();
  storyPlaybackStore.seekToDate(firstCycleDate.value);
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

  storyEngine.startAct(act.value.id);
  storyPlaybackStore.pause();
  audioStore.resetBaseRhythmLoop();
  activeCycleIndex.value = 0;
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
  --act-stage-comparison-size: 25vw;
  --act-stage-clock-size: clamp(220px, 17vw, 320px);
  --act-stage-clock-overlap: clamp(110px, 8.5vw, 160px);

  position: relative;
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
.act2-comparison,
.act2-info-panel,
.act2-clock-panel,
.act2-mirror {
  min-width: 0;
  min-height: 0;
}

.act2-map {
  position: relative;
  border-right: 1px solid rgba(36, 54, 42, 0.16);
}

.act2-stage {
  display: grid;
  grid-template-rows: var(--act-stage-comparison-size) minmax(0, 1fr);
  background:
    linear-gradient(
      180deg,
      rgba(252, 253, 248, 0.96),
      rgba(232, 240, 235, 0.92)
    ),
    #eef3ef;
}

.act2-comparison {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-bottom: 1px solid rgba(36, 54, 42, 0.14);
}

.act2-instructor {
  position: relative;
  overflow: hidden;
  border-right: 1px solid rgba(36, 54, 42, 0.14);
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

.act2-clock-panel,
.act2-mirror {
  position: relative;
  overflow: hidden;
}

.act2-clock-panel {
  position: absolute;
  left: 50%;
  bottom: 18px;
  z-index: 760;
  width: var(--act-stage-clock-size);
  overflow: visible;
  transform: translateX(-50%);
}

.act2-info-panel {
  display: grid;
  align-content: start;
  gap: 10px;
  overflow: auto;
  padding: 24px 24px 24px calc(var(--act-stage-clock-overlap) + 30px);
  background:
    linear-gradient(
      90deg,
      rgba(232, 240, 235, 0.74),
      rgba(249, 252, 248, 0.96) 30%
    ),
    #f4f8f5;
  color: #26382f;
}

.act2-info-panel__eyebrow {
  margin: 0;
  color: rgba(31, 49, 39, 0.58);
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
}

.act2-info-panel h1 {
  margin: 0;
  color: #17241c;
  font-size: clamp(1.35rem, 2.1vw, 2.35rem);
  line-height: 1.08;
}

.act2-info-panel p {
  max-width: 62ch;
  margin: 0;
  color: rgba(31, 49, 39, 0.76);
  font-size: clamp(0.94rem, 1vw, 1.08rem);
}

.act2-info-panel__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, max-content));
  gap: 10px 18px;
  margin: 12px 0 0;
  font-size: 0.74rem;
}

.act2-info-panel__meta div {
  min-width: 0;
}

.act2-info-panel__meta dt {
  color: rgba(31, 49, 39, 0.58);
  font-size: 0.64rem;
  font-weight: 800;
  text-transform: uppercase;
}

.act2-info-panel__meta dd {
  margin: 2px 0 0;
  color: #26382f;
  font-weight: 800;
}

.act2-clock-panel :deep(.season-clock) {
  width: 100%;
  gap: 6px;
  padding: 10px;
  background: rgba(250, 253, 248, 0.86);
  box-shadow: 0 14px 36px rgba(31, 49, 39, 0.18);
  backdrop-filter: blur(10px);
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

.act2-mirror :deep(.video),
.act2-mirror :deep(.canvas) {
  object-fit: cover;
}

@media (max-width: 1180px) {
  .act2-page {
    --act-stage-clock-size: 220px;
    --act-stage-clock-overlap: 110px;
  }

  .act2-info-panel__meta {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .act2-page {
    --act-stage-clock-size: 190px;
    --act-stage-clock-overlap: 95px;
  }

  .act2-status {
    max-width: calc(100% - 24px);
    font-size: 0.72rem;
  }

  .act2-clock-panel {
    bottom: 12px;
  }

  .act2-info-panel {
    padding: 18px 18px 18px calc(var(--act-stage-clock-overlap) + 20px);
  }
}
</style>
