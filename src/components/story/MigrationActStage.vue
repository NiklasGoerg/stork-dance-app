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
          :camera-mode="store.mapCameraMode"
          :show-controls="false"
          :show-map-navigation="false"
          :story-cycle-ids="activeCycleId ? [activeCycleId] : []"
          :story-cycle-definitions="activeCycleDefinitions"
          :single-story-cycle-mode="true"
          @story-frame="controller.reportMapFrame"
        />
        <StoryProgressSidebar />
        <CycleTransitionCover
          v-if="cycleTransitionCoverMounted"
          :label="t('story.acts.act4.transition.label')"
          :from-title="store.cycleTransitionOverlay.fromTitle"
          :to-title="store.cycleTransitionOverlay.toTitle"
          class="migration-map__cycle-cover"
        />
        <MigrationGestureCountdown
          v-if="countdownNumber"
          :gesture-id="gestureStore.activeGestureId ?? undefined"
          :count="countdownNumber"
          :initial="Boolean(store.initialCountdownNumber)"
        />
        <Transition name="migration-cycle-overlay">
          <div
            v-if="store.cycleOverlay.visible"
            class="migration-cycle-overlay"
            aria-live="polite"
          >
            <div class="migration-cycle-overlay__year">
              {{ store.cycleOverlay.title }}
            </div>
            <div class="migration-cycle-overlay__meta">
              {{
                t(
                  store.cycleOverlay.subtitleKey,
                  store.cycleOverlay.subtitleParams,
                )
              }}
            </div>
          </div>
        </Transition>
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
        :show-debug-toggle="showDebugToggle"
        :is-debug-mode="store.debug.enabled"
        :is-auto-progress-enabled="store.debug.autoProgressEnabled"
        :actions="activeInfoPanelModel.actions"
        @start-story="handleStartStory"
        @start-cycle="controller.startSingleCycle"
        @pause="handlePause"
        @resume="handleResume"
        @reset="handleReset"
        @action="handlePanelAction"
        @toggle-debug="controller.toggleDebug"
        @toggle-auto-progress="controller.toggleAutoProgress"
      />
    </template>
  </MigrationStoryLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import BirdMap from "~/components/map/BirdMap.vue";
import CycleTransitionCover from "~/components/story/CycleTransitionCover.vue";
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
import { isCycleTransitionCoverMounted } from "~/utils/migrationActs/cycleTransitionCover";
import { resolveMigrationActCycleRuns } from "~/utils/migrationActs/config";
import type { StoryAct } from "~/story/types";
import type { MigrationInfoPanelActionId } from "~/types/migrationAct";

const props = defineProps<{ act: StoryAct }>();
const { t, getActTitle } = useStoryTranslations();
const route = useRoute();
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
const routeDebugEnabled = computed(
  () => import.meta.dev && route.query.debug === "true",
);
const showDebugToggle = computed(
  () =>
    import.meta.dev &&
    !guidedController.enabled &&
    (props.act.id === "act-3" || props.act.id === "act-4"),
);
const activeCycleId = computed(() => store.activeCycleId);
const cycleTransitionCoverMounted = computed(() =>
  isCycleTransitionCoverMounted(store.cycleTransitionOverlay.state),
);
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
  store.setDebugEnabled(routeDebugEnabled.value);
  await controller.initialize();
  guidedController.initialize();
});
watch(
  () => routeDebugEnabled.value,
  (enabled) => store.setDebugEnabled(enabled),
);
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

.migration-cycle-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-content: center;
  gap: var(--space-2);
  color: #ffffff;
  text-align: center;
  text-shadow: 0 2px 12px rgb(0 0 0 / 0.56);
  pointer-events: none;
}

.migration-cycle-overlay__year {
  font-size: clamp(2.6rem, 7vw, 5.8rem);
  font-weight: 800;
  line-height: 0.95;
}

.migration-cycle-overlay__meta {
  font-size: clamp(1rem, 2vw, 1.5rem);
  font-weight: 700;
}

.migration-cycle-overlay-enter-active,
.migration-cycle-overlay-leave-active {
  transition:
    opacity 420ms ease,
    transform 420ms ease;
}

.migration-cycle-overlay-enter-from,
.migration-cycle-overlay-leave-to {
  opacity: 0;
  transform: translateY(8px);
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
