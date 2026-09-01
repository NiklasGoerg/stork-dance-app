<template>
  <ActEntryScreen
    v-if="isEntryVisible"
    :title="entryContent.title"
    :subtitle="entryContent.subtitle"
    :description="entryContent.description"
    :back-label="entryContent.backLabel"
    :continue-label="entryContent.continueLabel"
    :locked="stageMode === 'starting'"
    @back="handleEntryBack"
    @continue="handleEntryContinue"
  />

  <MigrationStoryLayout
    v-else
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
        <div
          v-if="activeCyclePeriodLabel"
          class="migration-map__period-indicator"
          aria-live="polite"
        >
          {{ activeCyclePeriodLabel }}
        </div>
        <StoryProgressSidebar />
        <CycleTransitionCover
          v-if="cycleTransitionCoverMounted"
          :label="t('story.acts.act3.transition.label')"
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
        :allow-single-cycle="act.id === 'act-3'"
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

    <template #overlay>
      <div class="migration-runtime-controls">
        <ActDebugDock
          v-if="showMigrationDebugDock"
          :open="store.debug.enabled"
          :toggle-label="t('story.debug.toggle')"
          :panel-label="t('story.debug.controls')"
          @toggle="controller.toggleDebug"
        >
          <button
            v-if="canShowStoryProgress"
            type="button"
            class="btn"
            @click="handleStoryProgress"
          >
            {{ t("story.acts.act2.controls.storyProgress") }}
          </button>
          <template v-if="canShowCycleDebugControls">
            <button
              v-for="cycle in cycleRuns"
              :key="cycle.id"
              class="btn"
              type="button"
              @click="controller.startSingleCycle(cycle.id)"
            >
              {{ getMigrationCycleButtonLabel(cycle) }}
            </button>
            <button
              class="migration-auto-toggle"
              type="button"
              :class="{
                'migration-auto-toggle--active':
                  store.debug.autoProgressEnabled,
              }"
              :aria-pressed="store.debug.autoProgressEnabled"
              @click="controller.toggleAutoProgress"
            >
              <span class="migration-auto-toggle__track" aria-hidden="true">
                <span class="migration-auto-toggle__thumb" />
              </span>
              <span>
                {{
                  t("story.debug.autoProgress", {
                    state: store.debug.autoProgressEnabled
                      ? t("common.on")
                      : t("common.off"),
                  })
                }}
              </span>
            </button>
          </template>
        </ActDebugDock>
        <button
          v-if="showPauseButton"
          class="migration-pause-button"
          type="button"
          :aria-pressed="isUserPaused"
          @click="handlePauseButton"
        >
          {{ pauseButtonLabel }}
        </button>
        <button
          v-if="showSkipMovementButton"
          class="migration-skip-button"
          type="button"
          @click="handleSkipMovement"
        >
          {{ t("story.acts.act3.controls.skipMovement") }}
        </button>
      </div>

      <PauseOverlay
        v-if="isUserPaused"
        :title="t('common.pauseOverlay.title')"
        :text="t('common.pauseOverlay.text')"
        :back-label="t('common.backToStart')"
        :resume-label="t('common.resume')"
        title-id="migration-pause-overlay-title"
        description-id="migration-pause-overlay-description"
        @back="handleBackToStart"
        @resume="handleResume"
      />
    </template>
  </MigrationStoryLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BirdMap from "~/components/map/BirdMap.vue";
import ActDebugDock from "~/components/story/ActDebugDock.vue";
import ActEntryScreen from "~/components/story/ActEntryScreen.vue";
import CycleTransitionCover from "~/components/story/CycleTransitionCover.vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import MigrationActControls from "~/components/story/MigrationActControls.vue";
import MigrationActInfoPanel from "~/components/story/MigrationActInfoPanel.vue";
import MigrationGestureCountdown from "~/components/story/MigrationGestureCountdown.vue";
import MigrationStoryLayout from "~/components/story/MigrationStoryLayout.vue";
import PauseOverlay from "~/components/story/PauseOverlay.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useMigrationActInfoPanelModel } from "~/composables/migrationActs/useMigrationActInfoPanelModel";
import { useMigrationActRuntime } from "~/composables/migrationActs/useMigrationActRuntime";
import { useGuidedMigrationController } from "~/composables/act2/useGuidedMigrationController";
import { useNarration } from "~/composables/narration/useNarration";
import { useStoryAutoAdvance } from "~/composables/useStoryAutoAdvance";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import { migrationStoryCycleDefinitions as storyCycleDefinitions } from "~/utils/migrationStoryData";
import { getSeasonForDate } from "~/utils/storyCycle";
import { isCycleTransitionCoverMounted } from "~/utils/migrationActs/cycleTransitionCover";
import {
  getMigrationCycleButtonLabel,
  resolveMigrationActCycleRuns,
} from "~/utils/migrationActs/config";
import { usePresenterActions } from "~/composables/usePresenterActions";
import { formatMigrationCyclePeriod } from "~/utils/storyPeriodLabel";
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
const { advanceToNextAct } = useStoryAutoAdvance();
const guidedController = useGuidedMigrationController({
  runtime: controller,
  enabled: props.act.id === "act-2",
  instructionNarration,
  translate: (key) => translateGuidedNarration(key),
  onGuidedCycleCompleted: async () => {
    runtimeStore.completeAct();
    await advanceToNextAct();
  },
});
const gestureStore = controller.gestures.store;
const infoPanel = useMigrationActInfoPanelModel({
  showDevActions: false,
  completed: computed(
    () => runtimeStore.showContinueGate || store.playbackState === "completed",
  ),
  showContinueAction: computed(() => runtimeStore.showContinueGate),
});

type MigrationStageMode = "entry" | "starting" | "running";
type MigrationPresenterContext = "running" | "paused";

const isGuidedAct = computed(() => props.act.id === "act-2");
const isGatedMigrationAct = computed(
  () => props.act.id === "act-2" || props.act.id === "act-3",
);
const stageMode = ref<MigrationStageMode>(
  isGatedMigrationAct.value ? "entry" : "running",
);
const isNavigatingHome = ref(false);
const isEntryVisible = computed(
  () => isGatedMigrationAct.value && stageMode.value !== "running",
);
const entryContent = computed(() => {
  if (props.act.id === "act-3") {
    return {
      title: t("story.acts.act3.entry.title"),
      subtitle: t("story.acts.act3.entry.subtitle"),
      description: t("story.acts.act3.entry.description"),
      backLabel: t("story.acts.act3.entry.back"),
      continueLabel: t("story.acts.act3.entry.continue"),
    };
  }

  return {
    title: t("story.acts.act2.entry.title"),
    subtitle: t("story.acts.act2.entry.subtitle"),
    description: undefined,
    backLabel: t("story.acts.act2.entry.back"),
    continueLabel: t("story.acts.act2.entry.continue"),
  };
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
    !isGatedMigrationAct.value &&
    (!guidedController.enabled ||
      activeInfoPanelModel.value.actions.length > 0),
);
const routeDebugEnabled = computed(
  () => import.meta.dev && route.query.debug === "true",
);
const showDebugToggle = computed(
  () =>
    import.meta.dev && !guidedController.enabled && props.act.id === "act-3",
);
const activeCycleId = computed(() => store.activeCycleId);
const activeCyclePeriodLabel = computed(() =>
  formatMigrationCyclePeriod(store.activeCycleRun),
);
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
const canShowStoryProgress = computed(
  () =>
    isGuidedAct.value &&
    stageMode.value === "running" &&
    store.debug.enabled &&
    activeInfoPanelModel.value.actions.some(
      (action) =>
        action.id === "forceCompleteGuidedStep" && action.disabled !== true,
    ),
);
const canShowCycleDebugControls = computed(
  () =>
    props.act.id === "act-3" &&
    stageMode.value === "running" &&
    store.debug.enabled,
);
const showMigrationDebugDock = computed(
  () => isGatedMigrationAct.value && stageMode.value === "running",
);
const isUserPaused = computed(() => store.hasUserPause);
const showPauseButton = computed(
  () =>
    isGatedMigrationAct.value &&
    stageMode.value === "running" &&
    !runtimeStore.showContinueGate,
);
const showSkipMovementButton = computed(() => {
  const gestureId = gestureStore.activeGestureId;

  if (
    props.act.id === "act-2" &&
    guidedController.canSkipCurrentBlockingInteraction.value
  ) {
    return stageMode.value === "running" && !isUserPaused.value;
  }

  return (
    props.act.id === "act-3" &&
    stageMode.value === "running" &&
    !isUserPaused.value &&
    store.isGestureActive &&
    (gestureId === "departure" || gestureId === "arrival") &&
    (store.playbackState === "gesture_lead_in" ||
      store.playbackState === "gesture_playing")
  );
});
const pauseButtonLabel = computed(() =>
  isUserPaused.value ? t("common.resume") : t("common.pause"),
);
const isActivePresenterEnabled = computed(
  () => isGatedMigrationAct.value && stageMode.value === "running",
);
const activePresenterContext = computed<MigrationPresenterContext | null>(
  () => {
    if (!isActivePresenterEnabled.value) return null;
    return isUserPaused.value ? "paused" : "running";
  },
);
const continueToNextAct = async () => {
  const nextActId = runtimeStore.currentAct?.nextActId;
  storyEngine.continueFromGate();
  if (nextActId) await navigateTo(`/story/${nextActId}`);
};

const handleBackToStart = async () => {
  if (isNavigatingHome.value) return;

  isNavigatingHome.value = true;
  await navigateTo("/");
};

const handleStoryProgress = () => {
  handlePanelAction("forceCompleteGuidedStep");
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

const startMigrationStage = async () => {
  if (!isGatedMigrationAct.value || stageMode.value !== "entry") return;

  stageMode.value = "starting";
  store.setDebugEnabled(routeDebugEnabled.value);
  await controller.initialize();
  guidedController.initialize();
  stageMode.value = "running";

  if (isGuidedAct.value) {
    guidedController.startGuidedJourney();
    return;
  }

  await controller.startStory();
};

const handleEntryBack = async () => {
  if (stageMode.value === "starting") return;

  if (props.act.id === "act-3") {
    await navigateTo("/story/act-2");
    return;
  }

  await navigateTo("/story/prologue");
};

const handleEntryContinue = () => {
  void startMigrationStage();
};

const handleStartStory = () => controller.startStory();
const handlePause = () => guidedController.pause();
const handleResume = () => void guidedController.resume();
const handlePauseButton = () => {
  if (isUserPaused.value) {
    handleResume();
    return;
  }

  handlePause();
};
const handleSkipMovement = () => {
  if (!showSkipMovementButton.value) return;

  if (props.act.id === "act-2") {
    guidedController.skipCurrentBlockingInteraction();
    return;
  }

  controller.skipCurrentBlockingInteraction();
};
const handleReset = () => {
  if (guidedController.enabled) void guidedController.resetAct();
  else void controller.reset();
};
const handleActivePresenterPageUp = () => {
  if (activePresenterContext.value === "paused") {
    void handleBackToStart();
    return;
  }

  if (activePresenterContext.value === "running" && showPauseButton.value) {
    handlePause();
  }
};

const handleActivePresenterPageDown = () => {
  if (activePresenterContext.value === "paused") {
    handleResume();
    return;
  }

  if (showSkipMovementButton.value) handleSkipMovement();
};

onMounted(async () => {
  if (isGatedMigrationAct.value) return;

  store.setDebugEnabled(routeDebugEnabled.value);
  await controller.initialize();
  guidedController.initialize();
});
watch(
  () => routeDebugEnabled.value,
  (enabled) => store.setDebugEnabled(enabled),
);
watch(
  () => runtimeStore.showContinueGate,
  (showContinueGate) => {
    if (
      showContinueGate &&
      props.act.id === "act-3" &&
      stageMode.value === "running"
    ) {
      void advanceToNextAct();
    }
  },
);
onBeforeUnmount(() => {
  guidedController.dispose();
  controller.dispose();
});

usePresenterActions({
  enabled: isActivePresenterEnabled,
  onPageUp: handleActivePresenterPageUp,
  onPageDown: handleActivePresenterPageDown,
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

.migration-map__period-indicator {
  position: absolute;
  top: clamp(12px, 2dvh, 22px);
  left: 50%;
  z-index: 18;
  transform: translateX(-50%);
  padding: 7px 14px;
  border: 1px solid rgb(31 49 39 / 0.16);
  border-radius: 999px;
  background: rgb(248 251 247 / 0.86);
  color: var(--act4-color-text-strong);
  font-size: clamp(1.05rem, 1.35vw, 1.55rem);
  font-weight: 760;
  line-height: 1;
  box-shadow: 0 8px 22px rgb(31 49 39 / 0.12);
  backdrop-filter: blur(10px);
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
  container-type: size;
  padding: clamp(18px, 1.4vw, 28px);
}

.migration-clock :deep(.season-clock--fill-container) {
  width: min(100cqw, 100cqh);
  height: min(100cqw, 100cqh);
  max-width: 100%;
  max-height: 100%;
}

.migration-clock__date {
  font-weight: 700;
}

.migration-runtime-controls {
  position: fixed;
  z-index: 850;
  bottom: 14px;
  left: 14px;
  display: flex;
  align-items: end;
  gap: 8px;
  pointer-events: none;
}

.migration-runtime-controls :deep(.act-debug-dock) {
  position: static;
}

.migration-pause-button,
.migration-skip-button {
  min-height: 30px;
  padding: 5px 10px;
  border: 1px solid rgb(31 49 39 / 0.18);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.72);
  color: rgb(31 49 39 / 0.7);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 850;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.12);
  backdrop-filter: blur(10px);
}

.migration-pause-button[aria-pressed="true"] {
  border-color: rgb(31 49 39 / 0.36);
  background: rgb(31 49 39 / 0.92);
  color: #ffffff;
}

.migration-skip-button {
  border-color: rgb(31 49 39 / 0.24);
  background: rgb(255 255 255 / 0.82);
  color: rgb(31 49 39 / 0.78);
}

.migration-auto-toggle {
  flex: 0 0 auto;
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid rgb(31 49 39 / 0.18);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.72);
  color: #26382f;
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

.migration-auto-toggle--active {
  border-color: rgb(42 108 74 / 0.42);
  background: rgb(219 244 228 / 0.9);
  color: #1f5b3d;
}

.migration-auto-toggle__track {
  position: relative;
  width: 28px;
  height: 16px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgb(31 49 39 / 0.22);
  transition: background 140ms ease;
}

.migration-auto-toggle--active .migration-auto-toggle__track {
  background: #2f8e5d;
}

.migration-auto-toggle__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgb(31 49 39 / 0.22);
  transition: transform 140ms ease;
}

.migration-auto-toggle--active .migration-auto-toggle__thumb {
  transform: translateX(12px);
}
</style>
