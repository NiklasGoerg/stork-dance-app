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
        <MigrationGestureCountdown
          v-if="countdownNumber"
          :gesture-id="gestureStore.activeGestureId ?? undefined"
          :count="countdownNumber"
          :initial="Boolean(store.initialCountdownNumber)"
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
          :source-aspect="instructorSourceAspect"
          :fill-frame="true"
        />
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
          :skeleton-visual-mode="skeletonVisualMode"
          :skeleton-pulse-progress="skeletonPulseProgress"
          @pose-landmarks="controller.handlePoseFrame"
        />
      </section>
    </template>

    <template #clock>
      <div class="migration-clock">
        <SeasonClock
          fill-container
          :show-controls="false"
          :date="store.currentDate"
        >
          <span class="migration-clock__date">{{ store.currentDate }}</span>
        </SeasonClock>
      </div>
    </template>

    <template #guidance>
      <MigrationActInfoPanel
        :model="infoPanel.model.value"
        @action="handlePanelAction"
      />
    </template>

    <template #controls>
      <div class="migration-controls-stack">
        <MigrationActControls
          :cycle-runs="cycleRuns"
          :allow-single-cycle="act.id === 'act-3' || act.id === 'act-4'"
          @start-story="controller.startStory"
          @start-cycle="controller.startSingleCycle"
          @pause="controller.pause"
          @resume="controller.resume"
          @reset="controller.reset"
        />
        <details v-if="showDevControls" class="migration-diagnostics">
          <summary>Diagnostics</summary>
          <dl>
            <div v-for="row in diagnosticRows" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
        </details>
      </div>
    </template>
  </MigrationStoryLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import BirdMap from "~/components/map/BirdMap.vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import MigrationActControls from "~/components/story/MigrationActControls.vue";
import MigrationActInfoPanel from "~/components/story/MigrationActInfoPanel.vue";
import MigrationGestureCountdown from "~/components/story/MigrationGestureCountdown.vue";
import MigrationStoryLayout from "~/components/story/MigrationStoryLayout.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useMigrationActInfoPanelModel } from "~/composables/migrationActs/useMigrationActInfoPanelModel";
import { useMigrationGestureDiagnostics } from "~/composables/migrationActs/useMigrationGestureDiagnostics";
import { useMigrationActRuntime } from "~/composables/migrationActs/useMigrationActRuntime";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import { migrationStoryCycleDefinitions as storyCycleDefinitions } from "~/utils/migrationStoryData";
import { getSeasonForDate } from "~/utils/storyCycle";
import { resolveMigrationActCycleRuns } from "~/utils/migrationActs/config";
import type { StoryAct } from "~/story/types";
import type { MigrationInfoPanelActionId } from "~/types/migrationAct";

const props = defineProps<{ act: StoryAct }>();
const { t, getActTitle } = useStoryTranslations();
const store = useMigrationActStore();
const runtimeStore = useStoryRuntimeStore();
const storyEngine = useStoryEngine();
const cycleRuns = resolveMigrationActCycleRuns(props.act);
const controller = useMigrationActRuntime({ act: props.act, cycleRuns });
const gestureStore = controller.gestures.store;
const gestureDiagnosticRows = useMigrationGestureDiagnostics();
const showDevControls = import.meta.dev;
const infoPanel = useMigrationActInfoPanelModel({
  showDevActions: showDevControls,
  completed: computed(
    () => runtimeStore.showContinueGate || store.playbackState === "completed",
  ),
  showContinueAction: computed(() => runtimeStore.showContinueGate),
});

const actTitle = computed(() => getActTitle(props.act));
const activeCycleId = computed(() => store.activeCycleId);
const activeCycleDefinitions = computed(() =>
  storyCycleDefinitions.filter((cycle) => cycle.label === activeCycleId.value),
);
const activeSeasonId = computed(() =>
  store.currentDate ? getSeasonForDate(store.currentDate).id : "summer",
);
const countdownNumber = computed(
  () => store.initialCountdownNumber ?? gestureStore.countdownNumber,
);
const instructorLandmarks = computed(
  () =>
    (gestureStore.isActive
      ? controller.gestures.instructorFrame.value
      : controller.movement.instructorFrame.value
    )?.landmarks ?? null,
);
const instructorSourceAspect = computed(() =>
  gestureStore.isActive
    ? controller.gestures.instructorSourceAspect.value
    : controller.movement.sourceAspect.value,
);
const skeletonVisualMode = computed(() =>
  gestureStore.isActive
    ? controller.gestures.skeletonFeedbackState.value.mode
    : controller.movementRecognition.skeletonFeedbackState.value.mode,
);
const skeletonPulseProgress = computed(() =>
  gestureStore.isActive
    ? controller.gestures.pulseProgress.value
    : controller.movementRecognition.pulseProgress.value,
);
const formatDebugNumber = (value: number | null, digits = 3) =>
  value === null ? "none" : value.toFixed(digits);
const themeLoadLabel = computed(
  () =>
    store.seasonAudio.error ||
    (store.seasonAudio.isReady ? "ready" : "loading"),
);
const diagnosticRows = computed(() => [
  ...gestureDiagnosticRows.value,
  { label: "playbackState", value: store.playbackState },
  { label: "currentStoryPhase", value: store.currentPhase ?? "none" },
  {
    label: "currentMovement",
    value: controller.movement.resolvedMovement.value?.movementId ?? "none",
  },
  {
    label: "recognitionProfile",
    value: controller.movementRecognition.recognitionProfile.value ?? "none",
  },
  {
    label: "movementEvaluationStatus",
    value: controller.movementRecognition.lastEvaluationStatus.value,
  },
  {
    label: "failedCriteria",
    value:
      gestureStore.latestEvaluationResult?.failedCriteria.join(", ") || "none",
  },
  { label: "pauseReasons", value: store.pauseReasons.join(", ") || "none" },
  {
    label: "movementSourceTimeMs",
    value: formatDebugNumber(controller.movement.movementSourceTimeMs.value, 1),
  },
  {
    label: "currentBeatWindow",
    value: controller.movementRecognition.currentBeatWindow.value,
  },
  { label: "season", value: store.seasonAudio.currentSeason ?? "none" },
  { label: "themeAssets", value: themeLoadLabel.value },
]);

const continueToNextAct = async () => {
  const nextActId = runtimeStore.currentAct?.nextActId;
  storyEngine.continueFromGate();
  if (nextActId) await navigateTo(`/story/${nextActId}`);
};

const handlePanelAction = (actionId: MigrationInfoPanelActionId) => {
  if (actionId === "cancelGesture") gestureStore.cancelGesture();
  if (actionId === "markGestureSuccessful") {
    gestureStore.markGestureSuccessful();
  }
  if (actionId === "repeatGesture") gestureStore.repeatAttempt();
  if (actionId === "continueGesture") gestureStore.continueGesture();
  if (actionId === "continueToNextAct") void continueToNextAct();
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

.migration-map--gesture-active :deep(.bird-map) {
  filter: saturate(0.7) brightness(0.82);
  pointer-events: none;
}

.migration-avatar,
.migration-camera {
  background: #121714;
}

.migration-clock {
  display: grid;
  place-items: center;
}

.migration-clock__date {
  font-weight: 700;
}

.migration-controls-stack {
  display: grid;
  gap: var(--space-2);
}

.migration-diagnostics {
  font-size: 0.76rem;
}

.migration-diagnostics summary {
  width: max-content;
  color: var(--color-text-muted);
  cursor: pointer;
  font-weight: 800;
}

.migration-diagnostics dl {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-1) var(--space-3);
  margin: var(--space-2) 0 0;
}

.migration-diagnostics dl div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.migration-diagnostics dd {
  margin: 0;
  overflow-wrap: anywhere;
  text-align: right;
}
</style>
