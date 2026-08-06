<template>
  <MigrationStoryLayout
    :season="activeSeasonId"
    :map-aria-label="t('story.aria.map', { title: actTitle })"
    :stage-aria-label="t('story.aria.stage', { title: actTitle })"
    :controls-aria-label="t('story.aria.runtimeMetadata')"
    :show-controls="showBottomControls"
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
        :model="activeInfoPanelModel"
        :show-actions="false"
      />
    </template>

    <template #controls>
      <MigrationActControls
        :cycle-runs="cycleRuns"
        :allow-single-cycle="act.id === 'act-3' || act.id === 'act-4'"
        :show-story-action="showStoryAction"
        :show-reset-action="!guidedController.enabled"
        :actions="activeInfoPanelModel.actions"
        @start-story="handleStartStory"
        @start-cycle="controller.startSingleCycle"
        @pause="handlePause"
        @resume="handleResume"
        @reset="handleReset"
        @action="handlePanelAction"
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
import MigrationActInfoPanel from "~/components/story/MigrationActInfoPanel.vue";
import MigrationGestureCountdown from "~/components/story/MigrationGestureCountdown.vue";
import MigrationStoryLayout from "~/components/story/MigrationStoryLayout.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useMigrationActInfoPanelModel } from "~/composables/migrationActs/useMigrationActInfoPanelModel";
import { useMigrationActRuntime } from "~/composables/migrationActs/useMigrationActRuntime";
import { useGuidedMigrationController } from "~/composables/act2/useGuidedMigrationController";
import { useNarration } from "~/composables/narration/useNarration";
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
const instructionNarration = useNarration();
const { t: translateGuidedNarration } = useI18n();
const guidedController = useGuidedMigrationController({
  runtime: controller,
  enabled: props.act.id === "act-2",
  instructionNarration,
  translate: (key) => translateGuidedNarration(key),
});
const gestureStore = controller.gestures.store;
const infoPanel = useMigrationActInfoPanelModel({
  showDevActions: false,
  completed: computed(
    () => runtimeStore.showContinueGate || store.playbackState === "completed",
  ),
  showContinueAction: computed(() => runtimeStore.showContinueGate),
});

const actTitle = computed(() => getActTitle(props.act));
const activeInfoPanelModel = computed(() =>
  guidedController.isGuidedUiActive.value
    ? guidedController.panelModel.value
    : infoPanel.model.value,
);
const showStoryAction = computed(() => !guidedController.enabled);
const showBottomControls = computed(
  () =>
    !guidedController.enabled || activeInfoPanelModel.value.actions.length > 0,
);
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
  () => controller.instructorFrame.value?.landmarks ?? null,
);
const instructorSourceAspect = controller.instructorSourceAspect;
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
const continueToNextAct = async () => {
  const nextActId = runtimeStore.currentAct?.nextActId;
  storyEngine.continueFromGate();
  if (nextActId) await navigateTo(`/story/${nextActId}`);
};

const handlePanelAction = (actionId: MigrationInfoPanelActionId) => {
  if (
    actionId === "startGuidedJourney" ||
    actionId === "forceCompleteGuidedStep"
  ) {
    guidedController.handleAction(actionId);
    return;
  }
  if (actionId === "cancelGesture") gestureStore.cancelGesture();
  if (actionId === "markGestureSuccessful") {
    gestureStore.markGestureSuccessful();
  }
  if (actionId === "repeatGesture") gestureStore.repeatAttempt();
  if (actionId === "continueGesture") gestureStore.continueGesture();
  if (actionId === "continueToNextAct") void continueToNextAct();
};

const handleStartStory = () => controller.startStory();
const handlePause = () => guidedController.pause();
const handleResume = () => void guidedController.resume();
const handleReset = () => {
  if (guidedController.enabled) void guidedController.resetAct();
  else void controller.reset();
};

onMounted(async () => {
  await controller.initialize();
  guidedController.initialize();
});
onBeforeUnmount(() => {
  guidedController.dispose();
  controller.dispose();
});
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
</style>
