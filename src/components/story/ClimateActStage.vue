<template>
  <main class="climate-act-page" :style="climateActThemeStyle">
    <StoryProgressSidebar />

    <div class="climate-act-main">
      <Act5InfoCard class="climate-act-context" :model="act5InfoCardModel" />

      <section
        class="climate-act-avatar"
        :aria-label="t('story.aria.instructor')"
      >
        <MovementStage
          :landmarks="act5Store.isCompleted ? null : instructorLandmarks"
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

      <Act5ClimateProgressChart
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

    <section
      class="climate-act-bottom-bar"
      :aria-label="t('story.aria.runtimeMetadata')"
    >
      <div class="climate-act-bottom-bar__actions">
        <button
          class="btn btn--primary"
          type="button"
          @click="controller.startFullFlow"
        >
          {{ t("story.acts.act5.controls.startAct5") }}
        </button>
        <button class="btn" type="button" @click="controller.startStoryFlow">
          {{ t("story.acts.act5.controls.startAct5WithoutTutorial") }}
        </button>
        <button class="btn btn--primary" type="button" @click="togglePlayback">
          {{ playbackToggleLabel }}
        </button>
        <button class="btn" type="button" @click="controller.reset">
          {{ t("story.acts.act5.controls.reset") }}
        </button>
        <button
          v-if="runtimeStore.showContinueGate"
          class="btn btn--primary"
          type="button"
          @click="continueToNextAct"
        >
          {{ t("common.continue") }}
        </button>
        <template v-if="isDebugMode">
          <button
            class="btn"
            type="button"
            @click="controller.startTutorialFlow"
          >
            {{ t("story.acts.act5.debug.startAct5Tutorial") }}
          </button>
          <button
            class="climate-act-auto-toggle"
            type="button"
            :class="{
              'climate-act-auto-toggle--active': isAct5AutoProgressEnabled,
            }"
            :aria-pressed="isAct5AutoProgressEnabled"
            @click="controller.toggleAutoProgress"
          >
            <span class="climate-act-auto-toggle__track" aria-hidden="true">
              <span class="climate-act-auto-toggle__thumb" />
            </span>
            <span>{{ t("story.acts.act5.debug.autoProgress") }}</span>
          </button>
          <button class="btn" type="button" @click="triggerSkeletonPulseTest">
            {{ t("story.acts.act5.debug.testSkeletonPulse") }}
          </button>
          <button
            v-for="season in debugSeasonConfigs"
            :key="`debug-start-${season.id}`"
            class="btn"
            type="button"
            @click="controller.startDebugSeason(season.id)"
          >
            {{
              t("story.acts.act5.debug.startSeason", {
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
        </template>
      </div>

      <dl class="climate-act-bottom-bar__meta">
        <div>
          <dt>{{ t("story.acts.act5.status.state") }}</dt>
          <dd>{{ playbackState }}</dd>
        </div>
        <div>
          <dt>{{ t("story.acts.act5.status.season") }}</dt>
          <dd>{{ currentSeasonLabel }}</dd>
        </div>
        <div>
          <dt>{{ t("story.acts.act5.status.repetition") }}</dt>
          <dd>{{ repetitionLabel }}</dd>
        </div>
        <div>
          <dt>{{ t("story.acts.act5.status.time") }}</dt>
          <dd>{{ timeLabel }}</dd>
        </div>
      </dl>

      <button
        class="climate-act-debug-toggle"
        type="button"
        :class="{ 'climate-act-debug-toggle--active': isDebugMode }"
        :aria-pressed="isDebugMode"
        @click="controller.toggleDebug"
      >
        {{ t("story.acts.act5.debug.toggle") }}
      </button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import Act5ClimateProgressChart from "~/components/story/Act5ClimateProgressChart.vue";
import Act5InfoCard from "~/components/story/Act5InfoCard.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useAct5Controller } from "~/features/act5/controller/useAct5Controller";
import { useAct5ChartModel } from "~/features/act5/presenter/useAct5ChartModel";
import { useAct5ControlsModel } from "~/features/act5/presenter/useAct5ControlsModel";
import { useAct5InfoCardModel } from "~/features/act5/presenter/useAct5InfoCardModel";
import { useAct5SeasonTheme } from "~/features/act5/presenter/useAct5SeasonTheme";
import { useAct5SkeletonFeedbackModel } from "~/features/act5/presenter/useAct5SkeletonFeedbackModel";
import { useAct5RecognitionAdapter } from "~/features/act5/recognition/useAct5RecognitionAdapter";
import { useClimateSeasonData } from "~/composables/useClimateSeasonData";
import { useSeasonalLearningCycle } from "~/composables/useSeasonalLearningCycle";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useAct5Store } from "~/store/act5Store";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import { act5IntroCycleConfig } from "~/story/act5IntroCycle";
import type {
  Act5RecognitionSequenceEvaluation,
  Act5SequenceTarget,
} from "~/features/act5/types/act5";
import type { StoryAct } from "~/story/types";

const props = defineProps<{
  act: StoryAct;
}>();

const { t } = useStoryTranslations();
const route = useRoute();
const storyEngine = useStoryEngine();
const runtimeStore = useStoryRuntimeStore();
const act5Store = useAct5Store();
const climateData = useClimateSeasonData();
const climateDataUserError = computed(() =>
  act5Store.errorMessage ? t("story.acts.act5.climateData.loadError") : "",
);

const cycle = useSeasonalLearningCycle(act5IntroCycleConfig);
const {
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
  totalDurationMs,
} = cycle;

const routeDebugEnabled = computed(() => route.query.debug === "true");
let forwardRecognitionResult: (
  target: Act5SequenceTarget,
  evaluation: Act5RecognitionSequenceEvaluation,
) => void = () => {};

const recognition = useAct5RecognitionAdapter({
  activeTarget: computed(() => act5Store.currentTarget),
  isRecognitionSuppressed: computed(
    () =>
      act5Store.sequenceStatus === "periodTransition" ||
      act5Store.sequenceStatus === "retryInterlude" ||
      act5Store.isCompleted,
  ),
  autoProgressEnabled: computed(() => act5Store.debug.autoProgressEnabled),
  onSequenceEvaluation: (target, evaluation) => {
    forwardRecognitionResult(target, evaluation);
  },
});

const controller = useAct5Controller({
  cycle: {
    currentSeason,
    currentSeasonIndex,
    playbackState,
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
    queueSeasonIndexRestart: cycle.queueSeasonIndexRestart,
    queueSeasonIndexEndAction: cycle.queueSeasonIndexEndAction,
  },
  recognition,
  actId: props.act.id,
  debugEnabled: routeDebugEnabled,
  getRetryFeedbackText: (target) => infoCardModel.getFeedbackText(target),
});
forwardRecognitionResult = controller.handleRecognitionResult;

const { climateActThemeStyle } = useAct5SeasonTheme({ currentSeason });
const chartRows = computed(() => climateData.dataset.value?.rows ?? []);
const chartModel = useAct5ChartModel({ rows: chartRows, recognition });
const infoCardModel = useAct5InfoCardModel({
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
const act5InfoCardModel = infoCardModel.model;
const currentSeasonLabel = infoCardModel.currentSeasonLabel;
const {
  isDebugMode,
  isAutoProgressEnabled: isAct5AutoProgressEnabled,
  playbackToggleLabel,
  debugSeasonConfigs,
  getDebugSeasonSequenceLabel,
} = useAct5ControlsModel({ playbackState });
const {
  skeletonFeedbackState,
  pulseProgress: skeletonPulseProgress,
  triggerSkeletonPulseTest,
  dispose: disposeSkeletonFeedback,
} = useAct5SkeletonFeedbackModel({ recognition });

const mirrorLandmarksHorizontally = <T extends { x: number }>(
  landmarks: T[] | null | undefined,
): T[] | null =>
  landmarks?.map((landmark) => ({
    ...landmark,
    x: 1 - landmark.x,
  })) ?? null;
const shouldMirrorAutumnInstructor = computed(
  () =>
    (act5Store.currentSeason ?? currentSeason.value.id) === "autumn" &&
    repetitionIndex.value !== null &&
    repetitionIndex.value >= 2,
);
const instructorLandmarks = computed(() => {
  if (!showInstructorAvatar.value) return null;

  const landmarks = instructorFrame.value?.landmarks ?? null;

  return shouldMirrorAutumnInstructor.value
    ? mirrorLandmarksHorizontally(landmarks)
    : landmarks;
});
const repetitionLabel = computed(() =>
  repetitionIndex.value === null
    ? t("story.acts.act5.status.transition")
    : t("story.acts.act5.status.repetitionCount", {
        current: repetitionIndex.value + 1,
        total: act5IntroCycleConfig.repetitionCount,
      }),
);
const timeLabel = computed(
  () =>
    `${(elapsedMs.value / 1000).toFixed(1)} / ${(totalDurationMs.value / 1000).toFixed(0)} s`,
);

const togglePlayback = async () => {
  if (act5Store.isCompleted) return;

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

onMounted(() => {
  act5Store.setDebugEnabled(routeDebugEnabled.value);
  void controller.initialize();
});

onBeforeUnmount(() => {
  disposeSkeletonFeedback();
  controller.dispose();
});
</script>

<style scoped>
.climate-act-page {
  --climate-act-bottom-bar-height: clamp(64px, 8dvh, 84px);
  --climate-act-sidebar-width: 132px;
  --act5-season-background: var(--act5-season-winter-background);
  --act5-season-surface: var(--act5-season-winter-surface);

  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: var(--climate-act-sidebar-width) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) var(--climate-act-bottom-bar-height);
  overflow: hidden;
  background-color: var(--act5-season-background);
  transition: background-color 500ms ease;
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

.climate-act-page > :not(.story-progress) {
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
  background: var(--act5-color-surface);
  box-shadow: var(--act5-shadow-panel);
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
  color: var(--act5-color-text);
  box-shadow: var(--act5-shadow-bottom-bar);
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

.climate-act-debug-toggle {
  justify-self: end;
  min-height: 30px;
  padding: 5px 10px;
  border: 1px solid rgba(31, 49, 39, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.66);
  color: rgba(31, 49, 39, 0.68);
  font-size: 0.72rem;
  font-weight: 850;
  line-height: 1;
  cursor: pointer;
}

.climate-act-debug-toggle--active {
  border-color: rgba(31, 49, 39, 0.36);
  background: rgba(31, 49, 39, 0.92);
  color: #ffffff;
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

  .climate-act-debug-toggle {
    grid-column: 2;
    grid-row: 1;
  }
}
</style>
