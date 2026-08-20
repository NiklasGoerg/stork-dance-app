<template>
  <ActEntryScreen
    v-if="isClimateEntryVisible"
    :title="t('story.acts.act4.entry.title')"
    :subtitle="t('story.acts.act4.entry.subtitle')"
    :description="t('story.acts.act4.entry.description')"
    :back-label="t('story.acts.act4.entry.back')"
    :continue-label="t('story.acts.act4.entry.continue')"
    :locked="climateStageMode === 'starting'"
    @back="handleEntryBack"
    @continue="handleEntryContinue"
  />

  <main
    v-else
    class="climate-act-page"
    :class="{ 'climate-act-page--debug-open': isDebugMode }"
    :style="climateActThemeStyle"
  >
    <StoryProgressSidebar />

    <div class="climate-act-main">
      <Act4InfoCard class="climate-act-context" :model="act4InfoCardModel" />

      <section
        class="climate-act-avatar"
        :aria-label="t('story.aria.instructor')"
      >
        <MovementStage
          :landmarks="act4Store.isCompleted ? null : instructorLandmarks"
          source-mode="recorded-motion"
          :source-aspect="instructorSourceAspect"
          :fill-frame="true"
        />
        <div v-if="countdownRemaining > 0" class="climate-act-countdown">
          {{ countdownRemaining }}
        </div>
      </section>

      <section
        class="climate-act-camera"
        :aria-label="t('story.aria.userMirror')"
      >
        <MovementCamera
          mode="camera"
          :fixed="false"
          :show-hands="false"
          :skeleton-visual-mode="skeletonFeedbackState.mode"
          :skeleton-pulse-progress="skeletonPulseProgress"
          @pose-landmarks="controller.handlePoseFrame"
        />
      </section>

      <Act4ClimateProgressChart
        class="climate-act-temperature-chart"
        :rows="chartModel.rows.value"
        :phase="chartModel.phase.value"
        :flow-id="chartModel.flowId.value"
        :sequence-status="chartModel.sequenceStatus.value"
        :active-step="chartModel.activeStep.value"
        :active-target-index="chartModel.activeTargetIndex.value"
        :attempt-number="chartModel.attemptNumber.value"
        :completed-step-ids="chartModel.completedStepIds.value"
        :period-transition="chartModel.periodTransition.value"
        :measure-evaluations="chartModel.measureEvaluations.value"
        :required-successful-repetitions="
          chartModel.requiredSuccessfulRepetitions.value
        "
      />
    </div>

    <button
      class="climate-act-debug-button"
      type="button"
      :class="{ 'climate-act-debug-button--active': isDebugMode }"
      :aria-pressed="isDebugMode"
      @click="controller.toggleDebug"
    >
      {{ t("story.debug.toggle") }}
    </button>

    <section
      v-if="isDebugMode"
      class="climate-act-bottom-bar"
      :aria-label="t('story.aria.runtimeMetadata')"
    >
      <div class="climate-act-bottom-bar__actions">
        <button
          class="btn btn--primary"
          type="button"
          @click="controller.startFullFlow"
        >
          {{ t("story.acts.act4.controls.startAct4") }}
        </button>
        <button class="btn" type="button" @click="controller.startStoryFlow">
          {{ t("story.acts.act4.controls.startAct4WithoutTutorial") }}
        </button>
        <button class="btn btn--primary" type="button" @click="togglePlayback">
          {{ playbackToggleLabel }}
        </button>
        <button class="btn" type="button" @click="controller.reset">
          {{ t("story.acts.act4.controls.reset") }}
        </button>
        <button
          v-if="runtimeStore.showContinueGate"
          class="btn btn--primary"
          type="button"
          @click="continueToNextAct"
        >
          {{ t("common.continue") }}
        </button>
        <button class="btn" type="button" @click="controller.startTutorialFlow">
          {{ t("story.acts.act4.debug.startAct4Tutorial") }}
        </button>
        <button
          class="climate-act-auto-toggle"
          type="button"
          :class="{
            'climate-act-auto-toggle--active': isAct4AutoProgressEnabled,
          }"
          :aria-pressed="isAct4AutoProgressEnabled"
          @click="controller.toggleAutoProgress"
        >
          <span class="climate-act-auto-toggle__track" aria-hidden="true">
            <span class="climate-act-auto-toggle__thumb" />
          </span>
          <span>{{ t("story.acts.act4.debug.autoProgress") }}</span>
        </button>
        <button class="btn" type="button" @click="triggerSkeletonPulseTest">
          {{ t("story.acts.act4.debug.testSkeletonPulse") }}
        </button>
        <button class="btn" type="button" @click="controller.playDebugOutro">
          {{ t("story.acts.act4.debug.playOutro") }}
        </button>
        <button
          v-for="season in debugSeasonConfigs"
          :key="`debug-start-${season.id}`"
          class="btn"
          type="button"
          @click="controller.startDebugSeason(season.id)"
        >
          {{
            t("story.acts.act4.debug.startSeason", {
              season: season.labelKey ? t(season.labelKey) : season.label,
            })
          }}
        </button>
        <button
          v-for="season in debugSeasonConfigs"
          :key="`debug-sequence-${season.id}`"
          class="btn"
          type="button"
          @click="controller.startDebugSeasonSequence(season.id)"
        >
          {{ getDebugSeasonSequenceLabel(season.id) }}
        </button>
      </div>

      <dl class="climate-act-bottom-bar__meta">
        <div>
          <dt>{{ t("story.acts.act4.status.state") }}</dt>
          <dd>{{ playbackState }}</dd>
        </div>
        <div>
          <dt>{{ t("story.acts.act4.status.season") }}</dt>
          <dd>{{ currentSeasonLabel }}</dd>
        </div>
        <div>
          <dt>{{ t("story.acts.act4.status.repetition") }}</dt>
          <dd>{{ repetitionLabel }}</dd>
        </div>
        <div>
          <dt>{{ t("story.acts.act4.status.time") }}</dt>
          <dd>{{ timeLabel }}</dd>
        </div>
      </dl>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import Act4ClimateProgressChart from "~/components/act4/ClimateProgressChart.vue";
import Act4InfoCard from "~/components/act4/InfoCard.vue";
import ActEntryScreen from "~/components/story/ActEntryScreen.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useAct4Controller } from "~/composables/act4/useAct4Controller";
import { useAct4ChartModel } from "~/composables/act4/useAct4ChartModel";
import { useAct4InfoCardModel } from "~/composables/act4/useAct4InfoCardModel";
import { useAct4Recognition } from "~/composables/act4/useAct4Recognition";
import { useAct4SkeletonFeedback } from "~/composables/act4/useAct4SkeletonFeedback";
import { useAct4ViewModel } from "~/composables/act4/useAct4ViewModel";
import { useClimateSeasonData } from "~/composables/useClimateSeasonData";
import { useSeasonalLearningCycle } from "~/composables/useSeasonalLearningCycle";
import { useStoryAutoAdvance } from "~/composables/useStoryAutoAdvance";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useAct4Store } from "~/store/act4";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import { act4IntroCycleConfig } from "~/story/act4IntroCycle";
import type {
  Act4RecognitionSequenceEvaluation,
  Act4SequenceTarget,
} from "~/types/act4";
import type { StoryAct } from "~/story/types";

const props = defineProps<{
  act: StoryAct;
}>();

const { t } = useStoryTranslations();
const route = useRoute();
const storyEngine = useStoryEngine();
const { advanceToNextAct } = useStoryAutoAdvance();
const runtimeStore = useStoryRuntimeStore();
const act4Store = useAct4Store();
const climateData = useClimateSeasonData();
const climateDataUserError = computed(() =>
  act4Store.errorMessage ? t("story.acts.act4.climateData.loadError") : "",
);

const cycle = useSeasonalLearningCycle(act4IntroCycleConfig);
const {
  currentBar,
  currentBeat,
  currentFrame: instructorFrame,
  currentMovementSourceAspect: instructorSourceAspect,
  currentSeason,
  currentSeasonIndex,
  countdownRemaining,
  elapsedMs,
  evaluationEnabled,
  isCompleted,
  isCountingDown,
  isTransition,
  playbackState,
  repetitionIndex,
  seasonElapsedMs,
  seasonPhase,
  showInstructorAvatar,
  movementLoaded,
  totalDurationMs,
} = cycle;

const routeDebugEnabled = computed(() => route.query.debug === "true");
type ClimateStageMode = "entry" | "starting" | "running";

const climateStageMode = ref<ClimateStageMode>("entry");
const isClimateEntryVisible = computed(
  () => climateStageMode.value !== "running",
);
let forwardRecognitionResult: (
  target: Act4SequenceTarget,
  evaluation: Act4RecognitionSequenceEvaluation,
) => void = () => {};

const recognition = useAct4Recognition({
  activeTarget: computed(() => act4Store.currentTarget),
  isRecognitionSuppressed: computed(
    () =>
      act4Store.sequenceStatus === "periodTransition" ||
      act4Store.sequenceStatus === "retryInterlude" ||
      act4Store.sequenceStatus === "tutorialExplanation" ||
      act4Store.sequenceStatus === "tutorialCompleted" ||
      act4Store.isCompleted,
  ),
  autoProgressEnabled: computed(() => act4Store.debug.autoProgressEnabled),
  onSequenceEvaluation: (target, evaluation) => {
    forwardRecognitionResult(target, evaluation);
  },
});

const controller = useAct4Controller({
  cycle: {
    currentSeason,
    currentSeasonIndex,
    playbackState,
    currentBar,
    seasonPhase,
    seasonElapsedMs,
    repetitionIndex,
    isTransition,
    evaluationEnabled,
    initialize: cycle.initialize,
    reset: cycle.reset,
    complete: cycle.complete,
    pause: cycle.pause,
    play: cycle.play,
    cleanup: cycle.cleanup,
    startCustomCycle: cycle.startCustomCycle,
    prepareCustomCycle: cycle.prepareCustomCycle,
    startExplanationPreview: cycle.startExplanationPreview,
    waitForExplanationPreviewBars: cycle.waitForExplanationPreviewBars,
    startPreparedCycleFromIndex: cycle.startPreparedCycleFromIndex,
    queueSeasonIndexRestart: cycle.queueSeasonIndexRestart,
    queueSeasonIndexEndAction: cycle.queueSeasonIndexEndAction,
  },
  recognition,
  actId: props.act.id,
  debugEnabled: routeDebugEnabled,
  getRetryFeedbackText: (target, feedbackCode) =>
    infoCardModel.getFeedbackText(target, feedbackCode),
});
forwardRecognitionResult = controller.handleRecognitionResult;

const chartRows = computed(() => climateData.dataset.value?.rows ?? []);
const chartModel = useAct4ChartModel({ rows: chartRows, recognition });
const infoCardModel = useAct4InfoCardModel({
  cycle: {
    currentSeason,
    currentBeat,
    countdownRemaining,
    playbackState,
    repetitionIndex,
    seasonElapsedMs,
    seasonPhase,
    isCountingDown,
    isCompleted,
    isTransition,
  },
  recognition,
  climateDataError: climateDataUserError,
  getSeasonBaselineStep: climateData.getSeasonBaselineStep,
});
const act4InfoCardModel = infoCardModel.model;
const currentSeasonLabel = infoCardModel.currentSeasonLabel;
const {
  isDebugMode,
  isAutoProgressEnabled: isAct4AutoProgressEnabled,
  playbackToggleLabel,
  debugSeasonConfigs,
  getDebugSeasonSequenceLabel,
  climateActThemeStyle,
} = useAct4ViewModel({ playbackState, currentSeason });
const {
  skeletonFeedbackState,
  pulseProgress: skeletonPulseProgress,
  triggerSkeletonPulseTest,
  dispose: disposeSkeletonFeedback,
} = useAct4SkeletonFeedback({ recognition });

const instructorLandmarks = computed(() => {
  if (!showInstructorAvatar.value || !movementLoaded.value) return null;

  return instructorFrame.value?.landmarks ?? null;
});
const repetitionLabel = computed(() =>
  repetitionIndex.value === null
    ? t("story.acts.act4.status.transition")
    : t("story.acts.act4.status.repetitionCount", {
        current: repetitionIndex.value + 1,
        total: act4IntroCycleConfig.repetitionCount,
      }),
);
const timeLabel = computed(
  () =>
    `${(elapsedMs.value / 1000).toFixed(1)} / ${(totalDurationMs.value / 1000).toFixed(0)} s`,
);

const togglePlayback = async () => {
  if (act4Store.isCompleted) return;

  if (
    playbackState.value === "playing" ||
    playbackState.value === "countdown"
  ) {
    controller.pause();
    return;
  }

  await controller.resume();
};

const continueToNextAct = async () => {
  const nextActId = runtimeStore.currentAct?.nextActId;

  storyEngine.continueFromGate();

  if (!nextActId) return;

  await navigateTo(`/story/${nextActId}`);
};

const startClimateStage = async () => {
  if (climateStageMode.value !== "entry") return;

  climateStageMode.value = "starting";
  act4Store.setDebugEnabled(routeDebugEnabled.value);
  await controller.initialize();
  climateStageMode.value = "running";
  await controller.startFullFlow();
};

const handleEntryContinue = () => {
  void startClimateStage();
};

const handleEntryBack = async () => {
  if (climateStageMode.value === "starting") return;

  await navigateTo("/story/act-3");
};

watch(
  () => runtimeStore.showContinueGate,
  (showContinueGate) => {
    if (showContinueGate && climateStageMode.value === "running") {
      void advanceToNextAct();
    }
  },
);

onBeforeUnmount(() => {
  disposeSkeletonFeedback();
  controller.dispose();
});
</script>

<style scoped>
.climate-act-page {
  --climate-act-bottom-bar-height: clamp(64px, 8dvh, 84px);
  --climate-act-sidebar-width: 132px;
  --act4-season-background: var(--act4-season-winter-background);
  --act4-season-surface: var(--act4-season-winter-surface);

  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: var(--climate-act-sidebar-width) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  overflow: hidden;
  background-color: var(--act4-season-background);
  transition: background-color 500ms ease;
}

.climate-act-page--debug-open {
  grid-template-rows: minmax(0, 1fr) var(--climate-act-bottom-bar-height);
}

.climate-act-page::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.38),
      rgba(255, 255, 255, 0.1) 48%,
      rgba(255, 255, 255, 0.26)
    ),
    linear-gradient(135deg, transparent, rgba(255, 255, 255, 0.24));
}

.climate-act-page > :not(.story-progress):not(.climate-act-debug-button) {
  position: relative;
  z-index: 1;
}

.climate-act-main,
.climate-act-context,
.climate-act-avatar,
.climate-act-camera,
.climate-act-temperature-chart,
.climate-act-bottom-bar {
  min-width: 0;
  min-height: 0;
}

.climate-act-main {
  grid-column: 2;
  grid-row: 1;
  display: grid;
  grid-template-columns:
    minmax(430px, 0.78fr)
    minmax(0, 1fr)
    minmax(0, 1.08fr);
  grid-template-rows: minmax(0, 1fr) minmax(0, 0.88fr);
  gap: 16px;
  overflow: hidden;
  padding: 16px 20px 16px 0;
}

.climate-act-context {
  position: relative;
  overflow: hidden;
}

.climate-act-avatar,
.climate-act-camera {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(31, 49, 39, 0.16);
  border-radius: 18px;
  background: var(--act4-color-surface);
  box-shadow: var(--act4-shadow-panel);
}

.climate-act-avatar {
  grid-column: 2;
  grid-row: 1;
}

.climate-act-countdown {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(23, 36, 28, 0.84);
  font-size: clamp(3.6rem, 8vw, 7rem);
  font-weight: 850;
  line-height: 1;
  pointer-events: none;
  text-shadow: 0 2px 18px rgba(248, 251, 247, 0.86);
}

.climate-act-camera {
  grid-column: 3;
  grid-row: 1;
  background: #121714;
}

.climate-act-camera :deep(.container) {
  border-radius: 0;
}

.climate-act-camera :deep(.video),
.climate-act-camera :deep(.canvas) {
  object-fit: cover;
}

.climate-act-temperature-chart {
  grid-column: 2 / -1;
  grid-row: 2;
  overflow: hidden;
}

.climate-act-main > .climate-act-context {
  grid-column: 1;
  grid-row: 1 / -1;
}

.climate-act-main > .climate-act-temperature-chart {
  grid-column: 2 / -1;
}

.climate-act-debug-button {
  position: absolute;
  bottom: 14px;
  left: 14px;
  z-index: 30;
  height: 30px;
  padding: 5px 10px;
  border: 1px solid rgba(31, 49, 39, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: rgba(31, 49, 39, 0.7);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 850;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(10px);
}

.climate-act-page--debug-open .climate-act-debug-button {
  bottom: calc(var(--climate-act-bottom-bar-height) + 12px);
}

.climate-act-debug-button--active {
  border-color: rgba(31, 49, 39, 0.36);
  background: rgba(31, 49, 39, 0.92);
  color: #ffffff;
}

.climate-act-bottom-bar {
  grid-column: 1 / -1;
  grid-row: 2;
  z-index: 20;
  box-sizing: border-box;
  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    max-content
    max-content;
  align-items: center;
  gap: clamp(12px, 2vw, 24px);
  height: var(--climate-act-bottom-bar-height);
  padding: 8px clamp(14px, 2vw, 24px);
  border-top: 1px solid rgba(31, 49, 39, 0.16);
  background: rgba(248, 251, 247, 0.96);
  color: var(--act4-color-text);
  box-shadow: var(--act4-shadow-bottom-bar);
  backdrop-filter: blur(10px);
}

.climate-act-bottom-bar__actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
  overflow: auto hidden;
  scrollbar-width: thin;
}

.climate-act-bottom-bar__actions .btn {
  flex: 0 0 auto;
  min-height: 30px;
  padding: 5px 10px;
  font-size: 0.72rem;
}

.climate-act-bottom-bar__actions .btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.climate-act-auto-toggle {
  flex: 0 0 auto;
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid rgba(31, 49, 39, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: #26382f;
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

.climate-act-auto-toggle--active {
  border-color: rgba(42, 108, 74, 0.42);
  background: rgba(219, 244, 228, 0.9);
  color: #1f5b3d;
}

.climate-act-auto-toggle__track {
  position: relative;
  width: 28px;
  height: 16px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(31, 49, 39, 0.22);
  transition: background 140ms ease;
}

.climate-act-auto-toggle--active .climate-act-auto-toggle__track {
  background: #2f8e5d;
}

.climate-act-auto-toggle__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(31, 49, 39, 0.22);
  transition: transform 140ms ease;
}

.climate-act-auto-toggle--active .climate-act-auto-toggle__thumb {
  transform: translateX(12px);
}

.climate-act-bottom-bar__meta {
  display: flex;
  gap: clamp(14px, 3vw, 34px);
  min-width: 0;
  max-height: 100%;
  margin: 0;
  overflow: auto hidden;
  font-size: 0.72rem;
}

.climate-act-bottom-bar__meta div {
  flex: 0 0 auto;
  min-width: 0;
  max-width: min(34vw, 360px);
}

.climate-act-bottom-bar__meta dt {
  color: rgba(31, 49, 39, 0.58);
  font-size: 0.64rem;
  font-weight: 800;
  text-transform: uppercase;
}

.climate-act-bottom-bar__meta dd {
  margin: 2px 0 0;
  overflow: hidden;
  color: #26382f;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1180px) {
  .climate-act-page {
    --climate-act-sidebar-width: 104px;
  }

  .climate-act-bottom-bar {
    grid-template-columns:
      minmax(0, 1fr)
      max-content
      max-content;
  }
}

@media (max-width: 860px) {
  .climate-act-page {
    --climate-act-bottom-bar-height: 84px;
    --climate-act-sidebar-width: 82px;
  }

  .climate-act-main {
    grid-template-columns:
      minmax(300px, 0.82fr)
      minmax(0, 1fr)
      minmax(0, 1fr);
    gap: 10px;
    padding: 12px 12px 12px 0;
  }

  .climate-act-bottom-bar {
    grid-template-columns: minmax(0, 1fr) max-content;
    align-content: center;
    overflow: hidden;
  }

  .climate-act-bottom-bar__meta {
    display: none;
  }
}
</style>
