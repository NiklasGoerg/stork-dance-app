<template>
  <MigrationStoryLayout
    :season="activeSeasonId"
    :map-aria-label="t('story.aria.map', { title: actTitle })"
    :stage-aria-label="t('story.aria.stage', { title: actTitle })"
    :controls-aria-label="t('story.aria.runtimeMetadata')"
  >
    <template #map>
      <section
        class="migration-map"
        :class="{ 'migration-map--gesture-active': store.isGestureActive }"
      >
        <BirdMap
          data-source="story"
          playback-source="migration-runtime"
          :show-controls="false"
          :show-map-navigation="false"
          :story-cycle-ids="activeCycleId ? [activeCycleId] : []"
          :story-cycle-definitions="activeCycleDefinitions"
          :single-story-cycle-mode="true"
          @story-frame="controller.reportMapFrame"
        />
        <StoryProgressSidebar />
        <StoryGestureOverlay
          :gesture-label="gestureLabel"
          :state="gestureStore.state"
          :feedback-text="gestureStore.feedbackText"
          :show-dev-controls="showDevControls"
          @mark="gestureStore.markGestureSuccessful"
          @repeat="gestureStore.repeatAttempt"
          @cancel="gestureStore.cancelGesture"
        />
      </section>
    </template>

    <template #avatar>
      <section
        class="migration-avatar"
        :aria-label="t('story.aria.instructor')"
      >
        <MovementStage
          :landmarks="instructorLandmarks"
          source-mode="recorded-motion"
          :source-aspect="controller.gestures.instructorSourceAspect.value"
          :fill-frame="true"
        />
        <div
          v-if="store.playbackState === 'cycle_transition'"
          class="migration-overlay"
        >
          {{ t("story.acts.act2.cycleCompleted") }}
        </div>
        <div v-if="store.playbackState === 'error'" class="migration-overlay">
          {{ store.error }}
        </div>
        <div v-if="runtimeStore.showContinueGate" class="migration-overlay">
          <strong>{{
            t("story.acts.act2.actCompleted", { title: actTitle })
          }}</strong>
          <button
            class="btn btn--primary"
            type="button"
            @click="continueToNextAct"
          >
            {{ t("common.continue") }}
          </button>
        </div>
      </section>
    </template>

    <template #camera>
      <section
        class="migration-camera"
        :aria-label="t('story.aria.userMirror')"
      >
        <MovementCamera
          mode="camera"
          :fixed="false"
          :show-hands="false"
          @pose-landmarks="controller.handlePoseFrame"
        />
      </section>
    </template>

    <template #clock>
      <div class="migration-clock">
        <SeasonClock :show-controls="false" :date="store.currentDate">
          <span class="migration-clock__date">{{ store.currentDate }}</span>
        </SeasonClock>
      </div>
    </template>

    <template #guidance>
      <section class="migration-guidance" :aria-label="activeSceneTitle">
        <p class="migration-guidance__eyebrow">{{ store.currentDate }}</p>
        <h1>{{ activeSceneTitle }}</h1>
        <p>{{ activeSceneNarration }}</p>
        <dl class="migration-guidance__meta">
          <div>
            <dt>{{ actTitle }}</dt>
            <dd>{{ activeCycleCountLabel }}</dd>
          </div>
          <div v-if="store.activeCycleRun">
            <dt>{{ t("map.storyCycles") }}</dt>
            <dd>{{ activeCycleTitle }}</dd>
          </div>
        </dl>
        <dl v-if="showDevControls" class="migration-guidance__debug">
          <div>
            <dt>Season</dt>
            <dd>{{ store.seasonAudio.currentSeason ?? "none" }}</dd>
          </div>
          <div>
            <dt>Theme assets</dt>
            <dd>{{ themeLoadLabel }}</dd>
          </div>
        </dl>
      </section>
    </template>

    <template #controls>
      <MigrationActControls
        :cycle-runs="cycleRuns"
        :allow-single-cycle="act.id === 'act-3' || act.id === 'act-4'"
        @start-story="controller.startStory"
        @start-cycle="controller.startSingleCycle"
        @pause="controller.pause"
        @resume="controller.resume"
        @reset="controller.reset"
      />
    </template>
  </MigrationStoryLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import BirdMap from "~/components/map/BirdMap.vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import MigrationActControls from "~/components/story/MigrationActControls.vue";
import MigrationStoryLayout from "~/components/story/MigrationStoryLayout.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import StoryGestureOverlay from "~/components/story/StoryGestureOverlay.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useMigrationActRuntime } from "~/composables/migrationActs/useMigrationActRuntime";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import { migrationStoryCycleDefinitions as storyCycleDefinitions } from "~/utils/migrationStoryData";
import { getSeasonForDate } from "~/utils/storyCycle";
import { resolveMigrationActCycleRuns } from "~/utils/migrationActs/config";
import type { StoryAct } from "~/story/types";

const props = defineProps<{ act: StoryAct }>();
const { t, getActTitle, getSceneTitle, getSceneNarration } =
  useStoryTranslations();
const store = useMigrationActStore();
const runtimeStore = useStoryRuntimeStore();
const storyEngine = useStoryEngine();
const cycleRuns = resolveMigrationActCycleRuns(props.act);
const controller = useMigrationActRuntime({ act: props.act, cycleRuns });
const gestureStore = controller.gestures.store;
const showDevControls = import.meta.dev;

const actTitle = computed(() => getActTitle(props.act));
const activeCycleId = computed(() => store.activeCycleId);
const activeCycleDefinitions = computed(() =>
  storyCycleDefinitions.filter((cycle) => cycle.label === activeCycleId.value),
);
const activeSeasonId = computed(() =>
  store.currentDate ? getSeasonForDate(store.currentDate).id : "summer",
);
const activeScene = computed(
  () =>
    props.act.scenes[
      Math.min(store.activeCycleIndex, props.act.scenes.length - 1)
    ] ?? null,
);
const activeSceneTitle = computed(() =>
  activeScene.value ? getSceneTitle(activeScene.value) : actTitle.value,
);
const activeSceneNarration = computed(() =>
  activeScene.value ? getSceneNarration(activeScene.value) : "",
);
const activeCycleTitle = computed(() => store.activeCycleRun?.title ?? "");
const activeCycleCountLabel = computed(() =>
  t("story.acts.act2.cycleCount", {
    current: store.activeCycleIndex + 1,
    total: store.cycleRuns.length,
  }),
);
const instructorLandmarks = computed(
  () => controller.gestures.instructorFrame.value?.landmarks ?? null,
);
const gestureLabel = computed(
  () =>
    controller.activeEvent.value?.eventType.replace("_", " ") ??
    gestureStore.activeGesture?.label ??
    "Gesture",
);
const themeLoadLabel = computed(
  () =>
    store.seasonAudio.error ||
    (store.seasonAudio.isReady ? "ready" : "loading"),
);

const continueToNextAct = async () => {
  const nextActId = runtimeStore.currentAct?.nextActId;
  storyEngine.continueFromGate();
  if (nextActId) await navigateTo(`/story/${nextActId}`);
};

onMounted(() => void controller.initialize());
onBeforeUnmount(() => controller.dispose());
</script>

<style scoped>
.migration-map,
.migration-avatar,
.migration-camera,
.migration-clock {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.migration-map--gesture-active :deep(.leaflet-container) {
  filter: saturate(0.7) brightness(0.82);
}

.migration-avatar,
.migration-camera {
  background: #121714;
}

.migration-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-content: center;
  gap: var(--space-3);
  padding: var(--space-5);
  background: rgba(18, 23, 20, 0.82);
  color: white;
  text-align: center;
}

.migration-clock {
  display: grid;
  place-items: center;
}

.migration-clock__date,
.migration-guidance__eyebrow {
  font-weight: 700;
}

.migration-guidance__meta {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-4) 0 0;
}

.migration-guidance__debug {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-1) var(--space-3);
  margin: var(--space-3) 0 0;
  font-size: 0.72rem;
}

.migration-guidance__debug div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.migration-guidance__debug dd {
  margin: 0;
  text-align: right;
}

.migration-guidance__meta div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}

.migration-guidance__meta dd {
  margin: 0;
  text-align: right;
}
</style>
