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
          :landmarks="act5FlowCompleted ? null : instructorLandmarks"
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
          @pose-landmarks="poseLandmarks = $event"
        />
      </section>

      <Act5ClimateProgressChart
        class="climate-act-temperature-chart"
        :rows="seasonalTemperatureChartRows"
        :phase="activeAct5Phase"
        :flow-id="activeAct5FlowId"
        :sequence-status="activeAct5SequenceStatus"
        :active-step="activeAct5ClimateStep"
        :active-target-index="activeAct5TargetIndex"
        :attempt-number="activeAct5AttemptNumber"
        :period-transition="activeAct5PeriodTransition"
        :measure-evaluations="activeAct5ChartMeasureEvaluations"
        :required-successful-repetitions="
          activeAct5RequiredSuccessfulRepetitions
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
          @click="startAct5FullFlow"
        >
          {{ t("story.acts.act5.controls.startAct5") }}
        </button>
        <button class="btn" type="button" @click="startAct5WithoutTutorial">
          {{ t("story.acts.act5.controls.startAct5WithoutTutorial") }}
        </button>
        <button class="btn btn--primary" type="button" @click="togglePlayback">
          {{ playbackToggleLabel }}
        </button>
        <button class="btn" type="button" @click="resetCycle">
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
          <button class="btn" type="button" @click="startAct5TutorialDebug">
            {{ t("story.acts.act5.debug.startAct5Tutorial") }}
          </button>
          <button
            class="climate-act-auto-toggle"
            type="button"
            :class="{
              'climate-act-auto-toggle--active': isAct5AutoProgressEnabled,
            }"
            :aria-pressed="isAct5AutoProgressEnabled"
            @click="toggleAct5AutoProgress"
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
            @click="startDebugSeason(season.id)"
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
            @click="startDebugSeasonSequence(season.id)"
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
        @click="toggleDebugMode"
      >
        Debug
      </button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import Act5ClimateProgressChart from "~/components/story/Act5ClimateProgressChart.vue";
import Act5InfoCard from "~/components/story/Act5InfoCard.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useAutumnMovementRecognition } from "~/composables/useAutumnMovementRecognition";
import { useClimateSeasonData } from "~/composables/useClimateSeasonData";
import { useSeasonalLearningCycle } from "~/composables/useSeasonalLearningCycle";
import { useSpringMovementRecognition } from "~/composables/useSpringMovementRecognition";
import { useSummerMovementRecognition } from "~/composables/useSummerMovementRecognition";
import { useWinterMovementRecognition } from "~/composables/useWinterMovementRecognition";
import { useSkeletonVisualFeedback } from "~/composables/useSkeletonVisualFeedback";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import { act5IntroCycleConfig } from "~/story/act5IntroCycle";
import type {
  Act5InfoCardMode,
  Act5InfoCardModel,
  Act5InfoInstruction,
} from "~/types/act5InfoCard";
import type { Act5ClimateChartMeasureEvaluation } from "~/types/act5ClimateChart";
import type { PoseLandmarkLike } from "~/types/pose";
import type {
  MovementBeatEvaluationLike,
  MovementMeasureResult,
} from "~/composables/useBeatWindowMovementRecognition";
import type {
  BeatSkeletonFeedbackEvent,
  BeatSkeletonFeedbackResult,
} from "~/utils/movement/skeletonVisualFeedback";
import {
  ACT5_PERIOD_TRANSITION_THEME,
  ACT5_SEASON_THEMES,
  buildAct5ClimateStoryFlow,
  buildAct5FullFlow,
  buildAct5TutorialDebugFlow,
  type Act5FlowId,
  type Act5Phase,
  type Act5SequenceTarget,
} from "~/utils/movement/acts/climate/act5Flow";
import { climateMovementFlowRegistry } from "~/utils/movement/acts/climate/climateMovementFlows";
import type {
  ClimateMovementFlowStep,
  ClimateSeason,
} from "~/utils/movement/acts/climate/climateSeasonData";
import { formatClimateTemperature } from "~/utils/movement/acts/climate/climateSeasonData";
import {
  getAutumnDirectionForRepetition,
  getPrioritizedAutumnProblemEvaluation,
} from "~/utils/movement/acts/climate/autumn/autumnMovementRecognition";
import { getPrioritizedSpringProblemEvaluation } from "~/utils/movement/acts/climate/spring/springMovementRecognition";
import { getPrioritizedWinterProblemEvaluation } from "~/utils/movement/acts/climate/winter/winterMovementRecognition";
import type {
  AutumnDirection,
  AutumnFeedbackCode,
  AutumnRecognitionMetrics,
  AutumnValueClass,
} from "~/utils/movement/acts/climate/autumn/autumnMovementRecognition";
import type {
  SpringFeedbackCode,
  SpringValue,
} from "~/utils/movement/acts/climate/spring/springMovementRecognition";
import type {
  WinterFeedbackCode,
  WinterValue,
} from "~/utils/movement/acts/climate/winter/winterMovementRecognition";
import type {
  SummerFeedbackCode,
  SummerIntensity,
} from "~/utils/movement/acts/climate/summer/summerMovementRecognition";
import type {
  SeasonalCycleConfig,
  SeasonalCycleSeasonId,
} from "~/utils/seasonalCycle";
import type { StoryAct } from "~/story/types";

const props = defineProps<{
  act: StoryAct;
}>();

type SummerTestMode = "single100" | "intensitySequence";
type AutumnTestMode = "single100" | "valueSequence";
type SpringTestMode = "single100" | "valueSequence";
type WinterTestMode = "single100" | "valueSequence";
type ValueSequencePhase =
  | "idle"
  | "intro"
  | "performing"
  | "evaluatingIntensity"
  | "feedbackInterlude"
  | "transitioningToNextIntensity"
  | "completed";
type MovementTextTone =
  "neutral" | "instruction" | "excellent" | "success" | "error" | "warning";
type MovementTextPhase =
  | "idle"
  | "intro"
  | "tutorialIntro"
  | "tutorialPreview"
  | "tutorialPerformance"
  | "storyIntro"
  | "preparation"
  | "seasonPreparation"
  | "seasonPerformance"
  | "instruction"
  | "measureFeedback"
  | "feedbackInterlude"
  | "intervalTransition"
  | "transition"
  | "completed"
  | "error";
type MovementTextSource =
  | "fatalError"
  | "feedbackInterlude"
  | "measureExcellent"
  | "measureSuccess"
  | "measureError"
  | "measureTracking"
  | "sequenceIntro"
  | "tutorialIntro"
  | "tutorialPreview"
  | "storyIntro"
  | "seasonPreparation"
  | "preparation"
  | "movementGuidance"
  | "transition"
  | "completed"
  | "debug"
  | "idle";
type MovementTextPresentation = {
  valueLabel?: string;
  message: string;
  secondaryMessage?: string;
  tone: MovementTextTone;
  phase: MovementTextPhase;
  messageSource: MovementTextSource;
  messageKey?: string;
  beatInstructionKey?: string;
  measureId?: string;
  measureResult?: MovementMeasureResult;
  primaryFeedbackCode?: string;
};
type Act5SequenceStatus =
  | "idle"
  | "performing"
  | "feedbackInterlude"
  | "previewingNext"
  | "storyIntro"
  | "periodTransition"
  | "completed";
type Act5PeriodTransition = {
  previousPeriod: string;
  nextPeriod: string;
};
const ACT5_LARGE_SEASON_PREVIEW_DURATION_MS = 3_000;
type VisibleMeasureFeedback = {
  flowStepId: string;
  measureIndex: number;
  measureId: string;
  messageKey?: string;
  messageSource: MovementTextSource;
  result: MovementMeasureResult;
  primaryFeedbackCode?: string;
  text: string;
  tone: MovementTextTone;
};
type MeasureFeedbackEvaluation = {
  measureIndex: number;
  result: MovementMeasureResult;
  score?: number;
  primaryFeedbackCode?: string;
};

const summerIntensityGuidance: Record<
  SummerIntensity,
  {
    beatInstructionKeys: Record<number, string>;
  }
> = {
  "100": {
    beatInstructionKeys: {
      1: "story.acts.act5.summerInstructions.beats.1",
      2: "story.acts.act5.summerInstructions.beats.100.2",
      3: "story.acts.act5.summerInstructions.beats.100.3",
      4: "story.acts.act5.summerInstructions.beats.4",
    },
  },
  "60": {
    beatInstructionKeys: {
      1: "story.acts.act5.summerInstructions.beats.1",
      2: "story.acts.act5.summerInstructions.beats.60.2",
      3: "story.acts.act5.summerInstructions.beats.60.3",
      4: "story.acts.act5.summerInstructions.beats.4",
    },
  },
  "30": {
    beatInstructionKeys: {
      1: "story.acts.act5.summerInstructions.beats.1",
      2: "story.acts.act5.summerInstructions.beats.30.2",
      3: "story.acts.act5.summerInstructions.beats.30.3",
      4: "story.acts.act5.summerInstructions.beats.4",
    },
  },
  "10": {
    beatInstructionKeys: {
      1: "story.acts.act5.summerInstructions.beats.1",
      2: "story.acts.act5.summerInstructions.beats.10.2",
      3: "story.acts.act5.summerInstructions.beats.10.3",
      4: "story.acts.act5.summerInstructions.beats.4",
    },
  },
};

const summerBeatFallbackInstructions: Record<number, string> = {
  1: "story.acts.act5.summerInstructions.fallback.1",
  2: "story.acts.act5.summerInstructions.fallback.2",
  3: "story.acts.act5.summerInstructions.fallback.3",
  4: "story.acts.act5.summerInstructions.fallback.4",
};

const autumnBeatInstructions: Record<number, string> = {
  1: "story.acts.act5.autumnInstructions.beats.1",
  2: "story.acts.act5.autumnInstructions.beats.2",
  3: "story.acts.act5.autumnInstructions.beats.3",
  4: "story.acts.act5.autumnInstructions.beats.4",
};

const springBeatInstructions: Record<number, string> = {
  1: "story.acts.act5.springInstructions.beat1",
  2: "story.acts.act5.springInstructions.beat2",
  3: "story.acts.act5.springInstructions.beat3",
  4: "story.acts.act5.springInstructions.beat4",
};

const winterBeatInstructions: Record<number, string> = {
  1: "story.acts.act5.winterInstructions.beat1",
  2: "story.acts.act5.winterInstructions.beat2",
  3: "story.acts.act5.winterInstructions.beat3",
  4: "story.acts.act5.winterInstructions.beat4",
};

const { t, translate } = useStoryTranslations();
const getAutumnFeedbackCueText = (feedbackCode: AutumnFeedbackCode) =>
  t(`story.acts.act5.autumnFeedback.${feedbackCode}`);
const getSpringFeedbackCueText = (feedbackCode: SpringFeedbackCode) =>
  t(`story.acts.act5.springFeedback.${feedbackCode}`);
const getWinterFeedbackCueText = (feedbackCode: WinterFeedbackCode) =>
  t(`story.acts.act5.winterFeedback.${feedbackCode}`);
const getVisibleMeasureFeedback = (
  evaluation: MeasureFeedbackEvaluation,
  getProblemCue: () => string,
  step: ClimateMovementFlowStep | null,
  fallbackFlowStepId: string,
): VisibleMeasureFeedback => {
  const flowStepId = step?.id ?? fallbackFlowStepId;
  const measureId = `${flowStepId}-${evaluation.measureIndex}`;

  if (evaluation.result === "autoProgress") {
    return {
      flowStepId,
      measureIndex: evaluation.measureIndex,
      measureId,
      messageKey: "story.acts.act5.debug.autoProgressFeedback",
      messageSource: "debug",
      result: evaluation.result,
      text: t("story.acts.act5.debug.autoProgressFeedback"),
      tone: "neutral",
    };
  }

  if (evaluation.result === "success") {
    return {
      flowStepId,
      measureIndex: evaluation.measureIndex,
      measureId,
      messageKey: "story.acts.act5.movementText.bravo",
      messageSource: "measureExcellent",
      result: evaluation.result,
      primaryFeedbackCode: evaluation.primaryFeedbackCode,
      text: t("story.acts.act5.movementText.bravo"),
      tone: "excellent",
    };
  }

  if (evaluation.result === "almostCorrect") {
    return {
      flowStepId,
      measureIndex: evaluation.measureIndex,
      measureId,
      messageKey: "story.acts.act5.movementText.good",
      messageSource: "measureSuccess",
      result: evaluation.result,
      primaryFeedbackCode: evaluation.primaryFeedbackCode,
      text: t("story.acts.act5.movementText.good"),
      tone: "success",
    };
  }

  return {
    flowStepId,
    measureIndex: evaluation.measureIndex,
    measureId,
    messageSource:
      evaluation.result === "trackingUnavailable"
        ? "measureTracking"
        : "measureError",
    result: evaluation.result,
    primaryFeedbackCode: evaluation.primaryFeedbackCode,
    text: getProblemCue(),
    tone: evaluation.result === "trackingUnavailable" ? "warning" : "error",
  };
};
const storyEngine = useStoryEngine();
const runtimeStore = useStoryRuntimeStore();
const route = useRoute();
const climateData = useClimateSeasonData();
const poseLandmarks = ref<PoseLandmarkLike[] | null>(null);
const summerRecognition = useSummerMovementRecognition();
const autumnRecognition = useAutumnMovementRecognition();
const springRecognition = useSpringMovementRecognition();
const winterRecognition = useWinterMovementRecognition();
const {
  skeletonFeedbackState,
  pulseProgress: skeletonPulseProgress,
  triggerBeatSuccess,
  setTrackingLimited,
  resetSkeletonFeedback,
} = useSkeletonVisualFeedback();
const debugModeEnabled = ref(route.query.debug === "true");
const act5AutoProgressEnabled = ref(false);
const summerTestMode = ref<SummerTestMode>("single100");
const autumnTestMode = ref<AutumnTestMode>("single100");
const springTestMode = ref<SpringTestMode>("single100");
const winterTestMode = ref<WinterTestMode>("single100");
const summerSequencePhase = ref<ValueSequencePhase>("idle");
const autumnSequencePhase = ref<ValueSequencePhase>("idle");
const springSequencePhase = ref<ValueSequencePhase>("idle");
const winterSequencePhase = ref<ValueSequencePhase>("idle");
const currentSummerIntensityIndex = ref(0);
const currentAutumnValueIndex = ref(0);
const currentSpringValueIndex = ref(0);
const currentWinterValueIndex = ref(0);
const completedSummerStepIds = ref<string[]>([]);
const completedAutumnStepIds = ref<string[]>([]);
const completedSpringStepIds = ref<string[]>([]);
const completedWinterStepIds = ref<string[]>([]);
const climateDataUserError = ref("");
const isSummerFeedbackInterlude = ref(false);
const isAutumnFeedbackInterlude = ref(false);
const isSpringFeedbackInterlude = ref(false);
const isWinterFeedbackInterlude = ref(false);
const visibleSummerMeasureFeedback = ref<VisibleMeasureFeedback | null>(null);
const visibleAutumnMeasureFeedback = ref<VisibleMeasureFeedback | null>(null);
const visibleSpringMeasureFeedback = ref<VisibleMeasureFeedback | null>(null);
const visibleWinterMeasureFeedback = ref<VisibleMeasureFeedback | null>(null);
const summerFeedbackInterludeBeat = ref(1);
const autumnFeedbackInterludeBeat = ref(1);
const springFeedbackInterludeBeat = ref(1);
const winterFeedbackInterludeBeat = ref(1);
const summerFeedbackInterludeText = ref("");
const autumnFeedbackInterludeText = ref("");
const springFeedbackInterludeText = ref("");
const winterFeedbackInterludeText = ref("");
const summerRetryPreviewFeedbackText = ref("");
const autumnRetryPreviewFeedbackText = ref("");
const springRetryPreviewFeedbackText = ref("");
const winterRetryPreviewFeedbackText = ref("");
const act5RetryPreviewFeedbackText = ref("");
const summerSequenceIntroStep = ref(0);
const autumnSequenceIntroStep = ref(0);
const springSequenceIntroStep = ref(0);
const winterSequenceIntroStep = ref(0);
const sequenceEvaluationHandledKey = ref("");
const autumnSequenceEvaluationHandledKey = ref("");
const springSequenceEvaluationHandledKey = ref("");
const winterSequenceEvaluationHandledKey = ref("");
let summerSequenceIntroTimers: Array<ReturnType<typeof setTimeout>> = [];
let autumnSequenceIntroTimers: Array<ReturnType<typeof setTimeout>> = [];
let springSequenceIntroTimers: Array<ReturnType<typeof setTimeout>> = [];
let winterSequenceIntroTimers: Array<ReturnType<typeof setTimeout>> = [];
let summerFeedbackInterludeTimer: ReturnType<typeof setInterval> | null = null;
let autumnFeedbackInterludeTimer: ReturnType<typeof setInterval> | null = null;
let springFeedbackInterludeTimer: ReturnType<typeof setInterval> | null = null;
let winterFeedbackInterludeTimer: ReturnType<typeof setInterval> | null = null;
let act5FlowAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
const processedSkeletonBeatCounts: Record<ClimateSeason, number> = {
  summer: 0,
  autumn: 0,
  winter: 0,
  spring: 0,
};
const activeAct5FlowId = ref<Act5FlowId | null>(null);
const activeAct5Phase = ref<Act5Phase | "idle">("idle");
const activeAct5Targets = ref<Act5SequenceTarget[]>([]);
const activeAct5TargetIndex = ref(0);
const activeAct5PreviewTarget = ref<Act5SequenceTarget | null>(null);
const activeAct5PreviewTargetIndex = ref<number | null>(null);
const activeAct5PeriodTransition = ref<Act5PeriodTransition | null>(null);
const activeAct5SequenceStatus = ref<Act5SequenceStatus>("idle");
const activeAct5AttemptNumber = ref(0);
const handledAct5TargetEvaluationKey = ref("");
const act5FlowCompleted = ref(false);
const hasStoppedAct5CompletionAudio = ref(false);
const {
  currentBar,
  currentBeat,
  currentFrame: instructorFrame,
  currentMovementSourceAspect: instructorSourceAspect,
  currentSeason,
  countdownRemaining,
  elapsedMs,
  evaluationEnabled,
  isCountingDown,
  isCompleted,
  isTransition,
  playbackState,
  repetitionIndex,
  seasonElapsedMs,
  seasonPhase,
  showInstructorAvatar,
  totalDurationMs,
  cleanup,
  initialize,
  pause,
  play,
  currentSeasonIndex,
  queueSeasonIndexEndAction,
  queueSeasonIndexRestart,
  queueSeasonRestart,
  reset,
  startCustomCycle,
  startSingleSeason,
} = useSeasonalLearningCycle(act5IntroCycleConfig);

const act = computed(() => props.act);
const activeScene = computed(() =>
  runtimeStore.currentActId === act.value.id
    ? (runtimeStore.currentScene ?? act.value.scenes[0] ?? null)
    : (act.value.scenes[0] ?? null),
);
const isAct5FinalFlowActive = computed(() => activeAct5FlowId.value !== null);
const activeAct5Target = computed(
  () => activeAct5Targets.value[activeAct5TargetIndex.value] ?? null,
);
const activeAct5DisplayTarget = computed(
  () => activeAct5PreviewTarget.value ?? activeAct5Target.value,
);
const activeAct5MovementStep = computed(() =>
  activeAct5SequenceStatus.value === "performing"
    ? activeAct5Target.value
    : null,
);
const isSeasonPreviewBar = computed(
  () =>
    playbackState.value === "playing" &&
    seasonPhase.value === "preview" &&
    currentBar.value === 1 &&
    !getActiveInterlude(),
);
const isSeasonEvaluationEnabled = computed(
  () =>
    playbackState.value === "playing" &&
    evaluationEnabled.value &&
    !getActiveInterlude(),
);
const activeAct5ClimateStep = computed(
  () => activeAct5DisplayTarget.value?.climateData ?? null,
);
const getSeasonConfig = (seasonId: ClimateSeason) => {
  const season = act5IntroCycleConfig.seasons.find(
    (item) => item.id === seasonId,
  );

  if (!season) {
    throw new Error(`Unknown Act 5 season "${seasonId}".`);
  }

  return season;
};
const activeAct5SeasonConfig = computed(() =>
  activeAct5DisplayTarget.value
    ? getSeasonConfig(activeAct5DisplayTarget.value.season)
    : null,
);
const currentSeasonLabel = computed(() => {
  const season = activeAct5SeasonConfig.value ?? currentSeason.value;

  return season.labelKey ? t(season.labelKey) : season.label;
});
const getTimeline = (season: ClimateSeason) =>
  climateData.getSeasonTimeline(season);
const summerTimeline = computed(() => getTimeline("summer"));
const autumnTimeline = computed(() => getTimeline("autumn"));
const springTimeline = computed(() => getTimeline("spring"));
const winterTimeline = computed(() => getTimeline("winter"));
const getStepAt = (
  timeline: ClimateMovementFlowStep[],
  index: number,
): ClimateMovementFlowStep | null => timeline[index] ?? null;
const currentSummerStep = computed(() =>
  getStepAt(summerTimeline.value, currentSummerIntensityIndex.value),
);
const nextSummerStep = computed(() =>
  getStepAt(summerTimeline.value, currentSummerIntensityIndex.value + 1),
);
const currentAutumnStep = computed(() =>
  getStepAt(autumnTimeline.value, currentAutumnValueIndex.value),
);
const nextAutumnStep = computed(() =>
  getStepAt(autumnTimeline.value, currentAutumnValueIndex.value + 1),
);
const currentSpringStep = computed(() =>
  getStepAt(springTimeline.value, currentSpringValueIndex.value),
);
const nextSpringStep = computed(() =>
  getStepAt(springTimeline.value, currentSpringValueIndex.value + 1),
);
const currentWinterStep = computed(() =>
  getStepAt(winterTimeline.value, currentWinterValueIndex.value),
);
const nextWinterStep = computed(() =>
  getStepAt(winterTimeline.value, currentWinterValueIndex.value + 1),
);
const getStepMovementValue = <TValue extends string>(
  step: ClimateMovementFlowStep | null,
  fallback: TValue,
) => String(step?.movementValue ?? fallback) as TValue;
const activeAct5MovementValue = computed(() => {
  const target = activeAct5DisplayTarget.value;

  return target ? String(target.movementValue) : null;
});
const currentSummerIntensity = computed<SummerIntensity>(() =>
  activeAct5DisplayTarget.value?.season === "summer" &&
  activeAct5MovementValue.value
    ? (activeAct5MovementValue.value as SummerIntensity)
    : getStepMovementValue(currentSummerStep.value, "100"),
);
const currentAutumnValue = computed<AutumnValueClass>(() =>
  activeAct5DisplayTarget.value?.season === "autumn" &&
  activeAct5MovementValue.value
    ? (activeAct5MovementValue.value as AutumnValueClass)
    : getStepMovementValue(currentAutumnStep.value, "100"),
);
const currentSpringValue = computed<SpringValue>(() =>
  activeAct5DisplayTarget.value?.season === "spring" &&
  activeAct5MovementValue.value
    ? (activeAct5MovementValue.value as SpringValue)
    : getStepMovementValue(currentSpringStep.value, "100"),
);
const currentWinterValue = computed<WinterValue>(() =>
  activeAct5DisplayTarget.value?.season === "winter" &&
  activeAct5MovementValue.value
    ? (activeAct5MovementValue.value as WinterValue)
    : getStepMovementValue(currentWinterStep.value, "100"),
);
const activeClimateStep = computed(() => {
  if (activeAct5ClimateStep.value) return activeAct5ClimateStep.value;

  if (currentSeason.value.id === "summer") return currentSummerStep.value;
  if (currentSeason.value.id === "autumn") return currentAutumnStep.value;
  if (currentSeason.value.id === "spring") return currentSpringStep.value;
  if (currentSeason.value.id === "winter") return currentWinterStep.value;

  return null;
});
const isAct5PreparationStep = computed(
  () => isAct5FinalFlowActive.value && isSeasonPreviewBar.value,
);
const isAct5PeriodTransitionActive = computed(
  () =>
    activeAct5SequenceStatus.value === "periodTransition" &&
    activeAct5PeriodTransition.value !== null,
);
const currentSeasonTheme = computed(() => {
  if (isAct5PeriodTransitionActive.value) {
    return ACT5_PERIOD_TRANSITION_THEME;
  }

  const seasonId =
    activeAct5DisplayTarget.value?.season ?? currentSeason.value.id;

  return ACT5_SEASON_THEMES[seasonId];
});
const climateActThemeStyle = computed(() => ({
  "--act5-season-background": currentSeasonTheme.value.background,
  "--act5-season-surface": currentSeasonTheme.value.surface,
}));
const sequenceIntroKeys = [
  "story.acts.act5.movementText.timelineIntro",
  "story.acts.act5.movementText.differenceIntro",
  "story.acts.act5.movementText.referenceIntro",
];
const getSequenceIntroKey = (introStep: number) =>
  sequenceIntroKeys[introStep] ?? sequenceIntroKeys[0] ?? "";
const isDebugMode = computed(() => debugModeEnabled.value);
const isAct5AutoProgressEnabled = computed(
  () => isDebugMode.value && act5AutoProgressEnabled.value,
);
const debugSeasonConfigs = computed(() =>
  (["winter", "spring", "summer", "autumn"] as SeasonalCycleSeasonId[])
    .map((seasonId) =>
      act5IntroCycleConfig.seasons.find((season) => season.id === seasonId),
    )
    .filter((season): season is (typeof act5IntroCycleConfig.seasons)[number] =>
      Boolean(season),
    ),
);
const summerDebug = computed(() => summerRecognition.debugSnapshot.value);
const springDebug = computed(() => springRecognition.debugSnapshot.value);
const winterDebug = computed(() => winterRecognition.debugSnapshot.value);
const getVisibleAutumnDirectionForRepetition = (
  currentRepetitionIndex: number | null,
): AutumnDirection =>
  getAutumnDirectionForRepetition(currentRepetitionIndex ?? 0);
const autumnDebug = computed(() => {
  const snapshot = autumnRecognition.debugSnapshot.value;
  const metrics = snapshot.metrics as AutumnRecognitionMetrics;
  const currentRepetition =
    autumnRecognition.currentRepetitionIndex.value ??
    repetitionIndex.value ??
    0;
  const currentEvaluation = autumnRecognition.currentEvaluation.value;

  return {
    ...snapshot,
    expectedValueClass: autumnRecognition.expectedValueClass.value,
    detectedValueClass: metrics.detectedValueClass,
    expectedDirection:
      currentEvaluation?.expectedDirection ??
      getVisibleAutumnDirectionForRepetition(currentRepetition),
  };
});
const activeSeasonId = computed(
  () => activeAct5DisplayTarget.value?.season ?? currentSeason.value.id,
);
const isSummerActive = computed(() => activeSeasonId.value === "summer");
const isAutumnActive = computed(() => activeSeasonId.value === "autumn");
const isSpringActive = computed(() => activeSeasonId.value === "spring");
const isWinterActive = computed(() => activeSeasonId.value === "winter");
const formatMovementPercent = (value: string | number) =>
  String(value).replace("-", "−");
const getMovementValueLabel = (step: ClimateMovementFlowStep | null) => {
  if (!step) return undefined;

  return t("story.acts.act5.movementText.valueLabel", {
    value: formatMovementPercent(step.movementValue),
  });
};
const getMovementValueLabelFromValue = (value: string | number | null) => {
  if (value === null) return undefined;

  return t("story.acts.act5.movementText.valueLabel", {
    value: formatMovementPercent(value),
  });
};
const currentMovementValueLabel = computed(
  () =>
    getMovementValueLabelFromValue(activeAct5MovementValue.value) ??
    getMovementValueLabel(activeClimateStep.value),
);
const getPreviewBeatCueKey = () => {
  const beat = currentBeat.value ?? 1;

  if (beat >= 4) return "story.acts.act5.movementText.previewBeat4";
  if (beat === 3) return "story.acts.act5.movementText.previewBeat3";
  if (beat === 2) return "story.acts.act5.movementText.previewBeat2";

  return "story.acts.act5.movementText.previewBeat1";
};
const getCurrentMovementValue = () => {
  if (activeSeasonId.value === "summer") return currentSummerIntensity.value;
  if (activeSeasonId.value === "autumn") return currentAutumnValue.value;
  if (activeSeasonId.value === "spring") return currentSpringValue.value;
  if (activeSeasonId.value === "winter") return currentWinterValue.value;

  return "100";
};
const getFallbackFlowStepId = () =>
  `${activeSeasonId.value}-${formatMovementPercent(getCurrentMovementValue())}`;
const getActiveFlowStepId = () =>
  activeAct5MovementStep.value?.id ??
  activeClimateStep.value?.id ??
  getFallbackFlowStepId();
const getCurrentBeat = () => {
  if (activeSeasonId.value === "summer") return summerDebug.value.currentBeat;
  if (activeSeasonId.value === "autumn") return autumnDebug.value.currentBeat;
  if (activeSeasonId.value === "spring") return springDebug.value.currentBeat;
  if (activeSeasonId.value === "winter") return winterDebug.value.currentBeat;

  return 1;
};
const getSummerBeatInstructionKey = (beat: number) => {
  const config = summerIntensityGuidance[currentSummerIntensity.value];

  return (
    config.beatInstructionKeys[beat] ??
    summerBeatFallbackInstructions[beat] ??
    summerBeatFallbackInstructions[1] ??
    ""
  );
};
const getBeatInstructionKeyForSeason = (
  season: ClimateSeason,
  beat: number,
) => {
  if (season === "summer") return getSummerBeatInstructionKey(beat);
  if (season === "autumn") {
    return autumnBeatInstructions[beat] ?? autumnBeatInstructions[1] ?? "";
  }
  if (season === "spring") {
    return springBeatInstructions[beat] ?? springBeatInstructions[1] ?? "";
  }

  return winterBeatInstructions[beat] ?? winterBeatInstructions[1] ?? "";
};
const getCurrentBeatInstructionKey = () => {
  const beat = getCurrentBeat();

  return getBeatInstructionKeyForSeason(activeSeasonId.value, beat);
};
const getCurrentVisibleMeasureFeedback = () => {
  if (isSummerFeedbackVisible.value) return visibleSummerMeasureFeedback.value;
  if (isAutumnFeedbackVisible.value) return visibleAutumnMeasureFeedback.value;
  if (isSpringFeedbackVisible.value) return visibleSpringMeasureFeedback.value;
  if (isWinterFeedbackVisible.value) return visibleWinterMeasureFeedback.value;

  return null;
};
const getActiveSequenceIntroStep = () => {
  if (summerSequencePhase.value === "intro")
    return summerSequenceIntroStep.value;
  if (autumnSequencePhase.value === "intro")
    return autumnSequenceIntroStep.value;
  if (springSequencePhase.value === "intro")
    return springSequenceIntroStep.value;
  if (winterSequencePhase.value === "intro")
    return winterSequenceIntroStep.value;

  return null;
};
const getActiveCompletedMessageKey = () => {
  if (summerSequencePhase.value === "completed") {
    return "story.acts.act5.sequence.summerCompleted";
  }
  if (autumnSequencePhase.value === "completed") {
    return "story.acts.act5.sequence.autumnCompleted";
  }
  if (springSequencePhase.value === "completed") {
    return "story.acts.act5.sequence.springCompleted";
  }
  if (winterSequencePhase.value === "completed") {
    return "story.acts.act5.sequence.winterCompleted";
  }

  return null;
};
const getActiveInterlude = () => {
  if (isSummerFeedbackInterlude.value) {
    return {
      beat: summerFeedbackInterludeBeat.value,
      text: summerFeedbackInterludeText.value,
    };
  }
  if (isAutumnFeedbackInterlude.value) {
    return {
      beat: autumnFeedbackInterludeBeat.value,
      text: autumnFeedbackInterludeText.value,
    };
  }
  if (isSpringFeedbackInterlude.value) {
    return {
      beat: springFeedbackInterludeBeat.value,
      text: springFeedbackInterludeText.value,
    };
  }
  if (isWinterFeedbackInterlude.value) {
    return {
      beat: winterFeedbackInterludeBeat.value,
      text: winterFeedbackInterludeText.value,
    };
  }

  return null;
};
const getActiveRetryPreviewFeedbackText = () => {
  if (!isSeasonPreviewBar.value) return "";

  if (isAct5FinalFlowActive.value) {
    return act5RetryPreviewFeedbackText.value;
  }

  if (activeSeasonId.value === "summer") {
    return summerRetryPreviewFeedbackText.value;
  }
  if (activeSeasonId.value === "autumn") {
    return autumnRetryPreviewFeedbackText.value;
  }
  if (activeSeasonId.value === "spring") {
    return springRetryPreviewFeedbackText.value;
  }
  if (activeSeasonId.value === "winter") {
    return winterRetryPreviewFeedbackText.value;
  }

  return "";
};
type SkeletonBeatEvaluation = MovementBeatEvaluationLike<
  number,
  unknown,
  string
>;

const resetProcessedSkeletonBeatCounts = () => {
  processedSkeletonBeatCounts.summer = 0;
  processedSkeletonBeatCounts.autumn = 0;
  processedSkeletonBeatCounts.winter = 0;
  processedSkeletonBeatCounts.spring = 0;
};

const resetSkeletonBeatFeedbackState = () => {
  resetProcessedSkeletonBeatCounts();
  resetSkeletonFeedback();
};

const getSkeletonFeedbackFlowId = (season: ClimateSeason) => {
  if (activeAct5FlowId.value) return activeAct5FlowId.value;
  if (season === "summer") {
    return summerTestMode.value === "intensitySequence"
      ? climateMovementFlowRegistry.summerSequenceDebug.id
      : climateMovementFlowRegistry.summerSingleDebug.id;
  }
  if (season === "autumn") {
    return autumnTestMode.value === "valueSequence"
      ? climateMovementFlowRegistry.autumnSequenceDebug.id
      : climateMovementFlowRegistry.autumnSingleDebug.id;
  }
  if (season === "spring") {
    return springTestMode.value === "valueSequence"
      ? climateMovementFlowRegistry.springSequenceDebug.id
      : climateMovementFlowRegistry.springSingleDebug.id;
  }

  return winterTestMode.value === "valueSequence"
    ? climateMovementFlowRegistry.winterSequenceDebug.id
    : climateMovementFlowRegistry.winterSingleDebug.id;
};

const isSkeletonBeatFeedbackAllowed = (season: ClimateSeason) => {
  if (playbackState.value !== "playing") return false;
  if (getActiveInterlude()) return false;
  if (isTransition.value || repetitionIndex.value === null) return false;
  if (!isSeasonEvaluationEnabled.value) return false;

  if (isAct5FinalFlowActive.value) {
    return (
      activeAct5SequenceStatus.value === "performing" &&
      activeAct5MovementStep.value?.season === season
    );
  }

  return currentSeason.value.id === season;
};

const getActiveSkeletonEvaluation = () => {
  if (activeSeasonId.value === "summer") {
    return summerRecognition.currentEvaluation.value;
  }
  if (activeSeasonId.value === "autumn") {
    return autumnRecognition.currentEvaluation.value;
  }
  if (activeSeasonId.value === "spring") {
    return springRecognition.currentEvaluation.value;
  }
  if (activeSeasonId.value === "winter") {
    return winterRecognition.currentEvaluation.value;
  }

  return null;
};

const getBeatFeedbackResult = (
  evaluation: SkeletonBeatEvaluation,
): BeatSkeletonFeedbackResult => {
  if (evaluation.trackingUnavailable) return "notEvaluable";

  return evaluation.passed ? "passed" : "failed";
};

const createSkeletonFeedbackEvent = ({
  season,
  evaluation,
  evaluationIndex,
}: {
  season: ClimateSeason;
  evaluation: SkeletonBeatEvaluation;
  evaluationIndex: number;
}): BeatSkeletonFeedbackEvent => {
  const flowId = getSkeletonFeedbackFlowId(season);
  const flowStepId = getActiveFlowStepId();
  const measureIndex = Math.floor(evaluationIndex / 4);
  const beatIndex = Number(evaluation.beat);
  const timestamp = Math.round(evaluation.timestamp);

  return {
    evaluationId: [
      flowId,
      flowStepId,
      season,
      measureIndex,
      beatIndex,
      timestamp,
    ].join(":"),
    flowId,
    flowStepId,
    measureIndex,
    beatIndex,
    result: getBeatFeedbackResult(evaluation),
  };
};

const processSkeletonBeatEvaluations = (
  season: ClimateSeason,
  evaluations: readonly SkeletonBeatEvaluation[],
) => {
  if (evaluations.length < processedSkeletonBeatCounts[season]) {
    processedSkeletonBeatCounts[season] = 0;
  }

  if (!isSkeletonBeatFeedbackAllowed(season)) {
    processedSkeletonBeatCounts[season] = evaluations.length;
    return;
  }

  for (
    let index = processedSkeletonBeatCounts[season];
    index < evaluations.length;
    index++
  ) {
    const evaluation = evaluations[index];

    if (!evaluation) continue;

    triggerBeatSuccess(
      createSkeletonFeedbackEvent({
        season,
        evaluation,
        evaluationIndex: index,
      }),
    );
  }

  processedSkeletonBeatCounts[season] = evaluations.length;
};
const isVisibleSummerMeasureFeedbackCurrent = computed(
  () =>
    isSummerActive.value &&
    visibleSummerMeasureFeedback.value !== null &&
    visibleSummerMeasureFeedback.value.flowStepId === getActiveFlowStepId() &&
    visibleSummerMeasureFeedback.value.measureIndex === repetitionIndex.value &&
    summerRecognition.currentBeat.value === 4,
);
const isSummerFeedbackVisible = computed(
  () => isVisibleSummerMeasureFeedbackCurrent.value,
);
const isVisibleAutumnMeasureFeedbackCurrent = computed(
  () =>
    isAutumnActive.value &&
    visibleAutumnMeasureFeedback.value !== null &&
    visibleAutumnMeasureFeedback.value.flowStepId === getActiveFlowStepId() &&
    visibleAutumnMeasureFeedback.value.measureIndex === repetitionIndex.value &&
    autumnRecognition.currentBeat.value === 4,
);
const isAutumnFeedbackVisible = computed(
  () => isVisibleAutumnMeasureFeedbackCurrent.value,
);
const isVisibleSpringMeasureFeedbackCurrent = computed(
  () =>
    isSpringActive.value &&
    visibleSpringMeasureFeedback.value !== null &&
    visibleSpringMeasureFeedback.value.flowStepId === getActiveFlowStepId() &&
    visibleSpringMeasureFeedback.value.measureIndex === repetitionIndex.value &&
    springRecognition.currentBeat.value === 4,
);
const isSpringFeedbackVisible = computed(
  () => isVisibleSpringMeasureFeedbackCurrent.value,
);
const isVisibleWinterMeasureFeedbackCurrent = computed(
  () =>
    isWinterActive.value &&
    visibleWinterMeasureFeedback.value !== null &&
    visibleWinterMeasureFeedback.value.flowStepId === getActiveFlowStepId() &&
    visibleWinterMeasureFeedback.value.measureIndex === repetitionIndex.value &&
    winterRecognition.currentBeat.value === 4,
);
const isWinterFeedbackVisible = computed(
  () => isVisibleWinterMeasureFeedbackCurrent.value,
);
const getBeatProblemCue = (
  beatEvaluation: NonNullable<typeof summerRecognition.currentEvaluation.value>,
) => {
  if (beatEvaluation.trackingUnavailable) {
    return t("story.acts.act5.summerFeedback.FULL_BODY_NOT_VISIBLE");
  }

  if (beatEvaluation.feedbackCode) {
    return t(`story.acts.act5.summerFeedback.${beatEvaluation.feedbackCode}`);
  }

  const failedEssential = beatEvaluation.criteria.find(
    (criterion) =>
      criterion.importance === "essential" && criterion.status !== "passed",
  );

  if (!failedEssential) return null;

  return t(`story.acts.act5.summerCriterion.${failedEssential.id}`);
};

const getCycleProblemCue = (
  cycleEvaluation: NonNullable<
    typeof summerRecognition.currentCycleEvaluation.value
  >,
) => {
  const firstProblem = cycleEvaluation.beatEvaluations.find(
    (beatEvaluation) => !beatEvaluation.passed,
  );

  if (!firstProblem) return t("story.acts.act5.summerFeedback.TRY_AGAIN");

  const cue = getBeatProblemCue(firstProblem);

  return cue
    ? t("story.acts.act5.sequence.beatProblem", {
        beat: firstProblem.beat,
        cue,
      })
    : t("story.acts.act5.summerFeedback.TRY_AGAIN");
};

const getSummerMeasureFeedback = (
  cycleEvaluation: NonNullable<
    typeof summerRecognition.currentCycleEvaluation.value
  >,
): VisibleMeasureFeedback =>
  getVisibleMeasureFeedback(
    cycleEvaluation,
    () => getCycleProblemCue(cycleEvaluation),
    activeAct5MovementStep.value?.season === "summer"
      ? null
      : currentSummerStep.value,
    activeAct5MovementStep.value?.season === "summer"
      ? activeAct5MovementStep.value.id
      : `summer-${currentSummerIntensity.value}`,
  );

const clearVisibleSummerMeasureFeedback = () => {
  visibleSummerMeasureFeedback.value = null;
};

const getAutumnCycleProblemCue = (
  cycleEvaluation: NonNullable<
    typeof autumnRecognition.currentCycleEvaluation.value
  >,
) => {
  const firstProblem = getPrioritizedAutumnProblemEvaluation(
    cycleEvaluation.beatEvaluations,
  );

  if (!firstProblem) return getAutumnFeedbackCueText("TRY_AGAIN");

  if (
    firstProblem.feedbackCode === "START_LEFT" ||
    firstProblem.feedbackCode === "START_RIGHT" ||
    firstProblem.feedbackCode === "START_ON_LEFT" ||
    firstProblem.feedbackCode === "START_ON_RIGHT"
  ) {
    return t("story.acts.act5.sequence.beatProblem", {
      beat: firstProblem.beat,
      cue: t("story.acts.act5.autumnFeedback.directionPattern"),
    });
  }

  return firstProblem.feedbackCode
    ? t("story.acts.act5.sequence.beatProblem", {
        beat: firstProblem.beat,
        cue: getAutumnFeedbackCueText(firstProblem.feedbackCode),
      })
    : getAutumnFeedbackCueText("TRY_AGAIN");
};

const getAutumnMeasureFeedback = (
  cycleEvaluation: NonNullable<
    typeof autumnRecognition.currentCycleEvaluation.value
  >,
): VisibleMeasureFeedback =>
  getVisibleMeasureFeedback(
    cycleEvaluation,
    () => getAutumnCycleProblemCue(cycleEvaluation),
    activeAct5MovementStep.value?.season === "autumn"
      ? null
      : currentAutumnStep.value,
    activeAct5MovementStep.value?.season === "autumn"
      ? activeAct5MovementStep.value.id
      : `autumn-${currentAutumnValue.value}`,
  );

const clearVisibleAutumnMeasureFeedback = () => {
  visibleAutumnMeasureFeedback.value = null;
};

const getSpringCycleProblemCue = (
  cycleEvaluation: NonNullable<
    typeof springRecognition.currentCycleEvaluation.value
  >,
) => {
  const firstProblem = getPrioritizedSpringProblemEvaluation(
    cycleEvaluation.beatEvaluations,
  );

  if (!firstProblem) return getSpringFeedbackCueText("TRY_AGAIN");

  return firstProblem.feedbackCode
    ? t("story.acts.act5.sequence.beatProblem", {
        beat: firstProblem.beat,
        cue: getSpringFeedbackCueText(firstProblem.feedbackCode),
      })
    : getSpringFeedbackCueText("TRY_AGAIN");
};

const getSpringMeasureFeedback = (
  cycleEvaluation: NonNullable<
    typeof springRecognition.currentCycleEvaluation.value
  >,
): VisibleMeasureFeedback =>
  getVisibleMeasureFeedback(
    cycleEvaluation,
    () => getSpringCycleProblemCue(cycleEvaluation),
    activeAct5MovementStep.value?.season === "spring"
      ? null
      : currentSpringStep.value,
    activeAct5MovementStep.value?.season === "spring"
      ? activeAct5MovementStep.value.id
      : `spring-${currentSpringValue.value}`,
  );

const clearVisibleSpringMeasureFeedback = () => {
  visibleSpringMeasureFeedback.value = null;
};

const getWinterCycleProblemCue = (
  cycleEvaluation: NonNullable<
    typeof winterRecognition.currentCycleEvaluation.value
  >,
) => {
  const firstProblem = getPrioritizedWinterProblemEvaluation(
    cycleEvaluation.beatEvaluations,
  );

  if (!firstProblem) return getWinterFeedbackCueText("TRY_AGAIN");

  return firstProblem.feedbackCode
    ? t("story.acts.act5.sequence.beatProblem", {
        beat: firstProblem.beat,
        cue: getWinterFeedbackCueText(firstProblem.feedbackCode),
      })
    : getWinterFeedbackCueText("TRY_AGAIN");
};

const getWinterMeasureFeedback = (
  cycleEvaluation: NonNullable<
    typeof winterRecognition.currentCycleEvaluation.value
  >,
): VisibleMeasureFeedback =>
  getVisibleMeasureFeedback(
    cycleEvaluation,
    () => getWinterCycleProblemCue(cycleEvaluation),
    activeAct5MovementStep.value?.season === "winter"
      ? null
      : currentWinterStep.value,
    activeAct5MovementStep.value?.season === "winter"
      ? activeAct5MovementStep.value.id
      : `winter-${currentWinterValue.value}`,
  );

const clearVisibleWinterMeasureFeedback = () => {
  visibleWinterMeasureFeedback.value = null;
};

const periodLabel = computed(() => {
  if (activeAct5Phase.value === "tutorial") {
    return t("story.acts.act5.tutorial.general.title");
  }

  if (activeAct5ClimateStep.value) return activeAct5ClimateStep.value.interval;

  const scene = activeScene.value;

  return scene?.periodLabel
    ? translate(
        scene.periodLabelKey,
        scene.periodLabel,
        scene.periodLabelParams,
      )
    : t("story.acts.act5.periodPlaceholder");
});
const mirrorLandmarksHorizontally = <T extends { x: number }>(
  landmarks: T[] | null | undefined,
): T[] | null =>
  landmarks?.map((landmark) => ({
    ...landmark,
    x: 1 - landmark.x,
  })) ?? null;

const shouldMirrorAutumnInstructor = computed(
  () =>
    activeSeasonId.value === "autumn" &&
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
const playbackToggleLabel = computed(() =>
  playbackState.value === "playing" || playbackState.value === "countdown"
    ? t("story.acts.act5.controls.pause")
    : t("story.acts.act5.controls.play"),
);
const movementTextPresentation = computed<MovementTextPresentation>(() => {
  const valueLabel = currentMovementValueLabel.value;

  if (climateDataUserError.value) {
    return {
      message: climateDataUserError.value,
      tone: "error",
      phase: "error",
      messageSource: "fatalError",
      messageKey: "story.acts.act5.climateData.loadError",
    };
  }

  const interlude = getActiveInterlude();

  if (interlude) {
    if (isAct5AutoProgressEnabled.value) {
      return {
        valueLabel,
        message: t("story.acts.act5.debug.autoProgressFeedback"),
        tone: "neutral",
        phase: "measureFeedback",
        messageSource: "debug",
        messageKey: "story.acts.act5.debug.autoProgressFeedback",
      };
    }

    const messageKey =
      interlude.beat >= 4 ? "story.acts.act5.movementText.tryAgain" : undefined;

    return {
      valueLabel,
      message:
        interlude.beat >= 4
          ? t("story.acts.act5.movementText.tryAgain")
          : interlude.text,
      tone: interlude.beat >= 4 ? "instruction" : "error",
      phase: "feedbackInterlude",
      messageSource: "feedbackInterlude",
      messageKey,
    };
  }

  const retryPreviewFeedbackText = getActiveRetryPreviewFeedbackText();

  if (retryPreviewFeedbackText && isAct5AutoProgressEnabled.value) {
    return {
      valueLabel,
      message: t("story.acts.act5.debug.autoProgressFeedback"),
      secondaryMessage: t(getPreviewBeatCueKey()),
      tone: "neutral",
      phase: "measureFeedback",
      messageSource: "debug",
      messageKey: "story.acts.act5.debug.autoProgressFeedback",
    };
  }

  if (retryPreviewFeedbackText) {
    return {
      valueLabel,
      message: retryPreviewFeedbackText,
      secondaryMessage: t(getPreviewBeatCueKey()),
      tone: "error",
      phase: "feedbackInterlude",
      messageSource: "feedbackInterlude",
    };
  }

  const measureFeedback = getCurrentVisibleMeasureFeedback();

  if (measureFeedback) {
    if (
      isAct5AutoProgressEnabled.value &&
      measureFeedback.result !== "autoProgress"
    ) {
      return {
        valueLabel,
        message: t("story.acts.act5.debug.autoProgressFeedback"),
        tone: "neutral",
        phase: "measureFeedback",
        messageSource: "debug",
        messageKey: "story.acts.act5.debug.autoProgressFeedback",
      };
    }

    return {
      valueLabel,
      message: measureFeedback.text,
      tone: measureFeedback.tone,
      phase: "measureFeedback",
      messageSource: measureFeedback.messageSource,
      messageKey: measureFeedback.messageKey,
      measureId: measureFeedback.measureId,
      measureResult: measureFeedback.result,
      primaryFeedbackCode: measureFeedback.primaryFeedbackCode,
    };
  }

  if (activeAct5SequenceStatus.value === "completed") {
    const messageKey =
      activeAct5FlowId.value === "act5TutorialDebug"
        ? "story.acts.act5.tutorial.general.completed"
        : "story.acts.act5.story.completed";

    return {
      message: t(messageKey),
      tone: "success",
      phase: "completed",
      messageSource: "completed",
      messageKey,
    };
  }

  const act5Target = activeAct5DisplayTarget.value;

  if (
    act5Target?.context === "tutorial" &&
    (isCountingDown.value || isAct5PreparationStep.value)
  ) {
    const explanationKey =
      act5Target.target === "maximum"
        ? act5Target.encoding.maximumExplanationKey
        : act5Target.encoding.minimumExplanationKey;

    return {
      valueLabel,
      message: t(act5Target.encoding.tutorialExplanationKey),
      secondaryMessage: isCountingDown.value
        ? t("story.acts.act5.instructions.countdown", {
            count: countdownRemaining.value,
          })
        : t(getPreviewBeatCueKey()),
      tone: "instruction",
      phase: "tutorialPreview",
      messageSource: "tutorialPreview",
      messageKey: act5Target.encoding.tutorialExplanationKey,
      beatInstructionKey: isCountingDown.value ? undefined : explanationKey,
    };
  }

  if (
    act5Target?.context === "climateStory" &&
    activeAct5SequenceStatus.value === "storyIntro"
  ) {
    return {
      message: t("story.acts.act5.story.intro.title"),
      secondaryMessage: t("story.acts.act5.story.intro.reference"),
      tone: "neutral",
      phase: "storyIntro",
      messageSource: "storyIntro",
      messageKey: "story.acts.act5.story.intro.title",
    };
  }

  if (
    act5Target?.context === "climateStory" &&
    (isCountingDown.value || isAct5PreparationStep.value) &&
    act5Target.climateData
  ) {
    const temperature = formatClimateTemperature({
      value: act5Target.climateData.displayValue,
      type: act5Target.climateData.displayValueType,
      unit: act5Target.climateData.displayUnit,
    });

    return {
      valueLabel,
      message: t("story.acts.act5.story.preparation.title", {
        season: currentSeasonLabel.value,
        interval: act5Target.interval,
        value: formatMovementPercent(act5Target.movementValue),
      }),
      secondaryMessage: isCountingDown.value
        ? t(
            act5Target.climateData.isBaseline
              ? "story.acts.act5.story.temperatureComparison.baseline"
              : "story.acts.act5.story.temperatureComparison.change",
            {
              temperature,
            },
          )
        : t(getPreviewBeatCueKey()),
      tone: "instruction",
      phase: "seasonPreparation",
      messageSource: "seasonPreparation",
      messageKey: "story.acts.act5.story.preparation.title",
    };
  }

  const introStep = getActiveSequenceIntroStep();

  if (introStep !== null) {
    const messageKey = getSequenceIntroKey(introStep);

    return {
      valueLabel: introStep >= 2 ? valueLabel : undefined,
      message: t(messageKey),
      tone: "neutral",
      phase: "intro",
      messageSource: "sequenceIntro",
      messageKey,
    };
  }

  const completedMessageKey = getActiveCompletedMessageKey();

  if (completedMessageKey) {
    return {
      message: t(completedMessageKey),
      tone: "success",
      phase: "completed",
      messageSource: "completed",
      messageKey: completedMessageKey,
    };
  }

  if (isCompleted.value) {
    return {
      message: t("story.acts.act5.instructions.completed"),
      tone: "success",
      phase: "completed",
      messageSource: "completed",
      messageKey: "story.acts.act5.instructions.completed",
    };
  }

  if (isCountingDown.value) {
    return {
      valueLabel,
      message: t("story.acts.act5.movementText.baselinePrep"),
      secondaryMessage: t("story.acts.act5.instructions.countdown", {
        count: countdownRemaining.value,
      }),
      tone: "instruction",
      phase: "preparation",
      messageSource: "preparation",
      messageKey: "story.acts.act5.movementText.baselinePrep",
    };
  }

  if (isSeasonPreviewBar.value) {
    return {
      valueLabel,
      message: t("story.acts.act5.movementText.baselinePrep"),
      secondaryMessage: t(getPreviewBeatCueKey()),
      tone: "instruction",
      phase: "preparation",
      messageSource: "preparation",
      messageKey: "story.acts.act5.movementText.baselinePrep",
    };
  }

  if (isTransition.value) {
    return {
      valueLabel,
      message: t("story.acts.act5.movementText.nextPeriod"),
      tone: "neutral",
      phase: "transition",
      messageSource: "transition",
      messageKey: "story.acts.act5.movementText.nextPeriod",
    };
  }

  if (playbackState.value === "idle") {
    return {
      message: t("story.acts.act5.movementText.ready"),
      tone: "neutral",
      phase: "idle",
      messageSource: "idle",
      messageKey: "story.acts.act5.movementText.ready",
    };
  }
  if (playbackState.value === "paused") {
    return {
      valueLabel,
      message: t("story.acts.act5.instructions.paused"),
      tone: "neutral",
      phase: "idle",
      messageSource: "idle",
      messageKey: "story.acts.act5.instructions.paused",
    };
  }

  if (
    isSummerActive.value ||
    isAutumnActive.value ||
    isSpringActive.value ||
    isWinterActive.value
  ) {
    const beatInstructionKey = getCurrentBeatInstructionKey();

    return {
      valueLabel,
      message: t(beatInstructionKey),
      tone: "instruction",
      phase:
        activeAct5MovementStep.value?.context === "tutorial"
          ? "tutorialPerformance"
          : activeAct5MovementStep.value?.context === "climateStory"
            ? "seasonPerformance"
            : "instruction",
      messageSource: "movementGuidance",
      messageKey: beatInstructionKey,
      beatInstructionKey,
    };
  }

  return {
    valueLabel,
    message: t("story.acts.act5.instructions.repeat"),
    tone: "instruction",
    phase: "instruction",
    messageSource: "movementGuidance",
    messageKey: "story.acts.act5.instructions.repeat",
  };
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
const seasonalTemperatureChartRows = computed(
  () => climateData.dataset.value?.rows ?? [],
);
const activeAct5RequiredSuccessfulRepetitions = computed(
  () => activeAct5DisplayTarget.value?.rules.requiredSuccessfulMeasures ?? 2,
);
const toAct5ChartMeasureEvaluations = (
  evaluations: Array<{ measureIndex: number; result: MovementMeasureResult }>,
): Act5ClimateChartMeasureEvaluation[] =>
  evaluations.map((evaluation) => ({
    measureIndex: evaluation.measureIndex,
    result: evaluation.result,
  }));
const activeAct5ChartMeasureEvaluations = computed(() => {
  const target = activeAct5MovementStep.value;

  if (target?.context !== "climateStory") return [];

  if (target.season === "summer") {
    return toAct5ChartMeasureEvaluations(
      summerRecognition.cycleEvaluations.value,
    );
  }
  if (target.season === "autumn") {
    return toAct5ChartMeasureEvaluations(
      autumnRecognition.cycleEvaluations.value,
    );
  }
  if (target.season === "spring") {
    return toAct5ChartMeasureEvaluations(
      springRecognition.cycleEvaluations.value,
    );
  }
  if (target.season === "winter") {
    return toAct5ChartMeasureEvaluations(
      winterRecognition.cycleEvaluations.value,
    );
  }

  return [];
});
const clampBeat = (beat: number) => Math.min(Math.max(Math.round(beat), 1), 4);
const activeInfoBeat = computed(() => clampBeat(getCurrentBeat()));
const activeMovementPercentLabel = computed(() => {
  const value =
    activeAct5MovementValue.value ??
    activeClimateStep.value?.movementValue ??
    getCurrentMovementValue();

  return `${formatMovementPercent(value)}%`;
});
const activeClimateTemperatureLabel = computed(() => {
  const step = activeClimateStep.value;

  if (!step) return "";

  return formatClimateTemperature({
    value: step.displayValue,
    type: step.displayValueType,
    unit: step.displayUnit,
  });
});
const activeClimatePeriodLabel = computed(
  () => activeClimateStep.value?.interval ?? periodLabel.value,
);
const activeClimateBaselinePeriodLabel = computed(
  () => climateData.getSeasonBaselineStep(activeSeasonId.value)?.interval ?? "",
);
const act5InfoInstructionQueue = computed<Act5InfoInstruction[]>(() => {
  const activeBeat = activeInfoBeat.value;

  return Array.from({ length: 4 }, (_, index) => {
    const beat = ((activeBeat + index - 1) % 4) + 1;
    const instructionKey = getBeatInstructionKeyForSeason(
      activeSeasonId.value,
      beat,
    );

    return {
      beat,
      text: instructionKey ? t(instructionKey) : "",
      active: beat === activeBeat,
    };
  });
});
const act5InfoMode = computed<Act5InfoCardMode>(() => {
  if (
    act5FlowCompleted.value ||
    activeAct5SequenceStatus.value === "completed"
  ) {
    return "completed";
  }

  if (isAct5PeriodTransitionActive.value) return "periodTransition";
  const retryPreviewFeedbackText = getActiveRetryPreviewFeedbackText();
  const isLargeSeasonPreviewVisible =
    isAct5FinalFlowActive.value &&
    isSeasonPreviewBar.value &&
    seasonElapsedMs.value < ACT5_LARGE_SEASON_PREVIEW_DURATION_MS &&
    !retryPreviewFeedbackText;

  if (isLargeSeasonPreviewVisible) {
    return "seasonPreview";
  }

  return "activeMovement";
});
const formatAct5FeedbackText = (message: string) => {
  const compactMessage = message
    .replace(/^Beat\s+\d+:\s*/i, "")
    .replace(/^Try again\s*[-:]\s*/i, "")
    .replace(/^Almost there\s*[-:]\s*/i, "")
    .trim();

  if (compactMessage.length <= 44) return compactMessage;

  return compactMessage.split(/[.!?]/)[0]?.trim() || compactMessage;
};
const act5InfoFeedback = computed<Act5InfoCardModel["feedback"]>(() => {
  if (act5InfoMode.value !== "activeMovement") return undefined;

  const presentation = movementTextPresentation.value;
  const feedbackPhases: MovementTextPhase[] = [
    "feedbackInterlude",
    "measureFeedback",
    "completed",
    "error",
  ];

  if (!feedbackPhases.includes(presentation.phase)) return undefined;

  return {
    text: formatAct5FeedbackText(presentation.message),
    tone: presentation.tone,
  };
});
const act5InfoSubtitle = computed(() => {
  if (act5InfoMode.value !== "activeMovement") return "";

  const presentation = movementTextPresentation.value;

  if (presentation.secondaryMessage) return presentation.secondaryMessage;
  if (act5InfoFeedback.value) return "";
  if (presentation.phase === "movementGuidance") return "";

  return presentation.message;
});
const act5InfoCardModel = computed<Act5InfoCardModel>(() => {
  const step = activeClimateStep.value;
  const mode = act5InfoMode.value;

  return {
    mode,
    seasonLabel: currentSeasonLabel.value,
    movementPercentLabel: activeMovementPercentLabel.value,
    periodLabel: activeClimatePeriodLabel.value,
    temperature: {
      valueLabel: step?.isBaseline
        ? t("story.acts.act5.climateInfo.referencePeriod")
        : activeClimateTemperatureLabel.value,
      baselineLabel: activeClimateBaselinePeriodLabel.value,
      isBaseline: step?.isBaseline ?? false,
    },
    instructions:
      mode === "activeMovement" ? act5InfoInstructionQueue.value : [],
    feedback: act5InfoFeedback.value,
    subtitle: act5InfoSubtitle.value,
    completion: {
      title: t("story.acts.act5.story.completionTitle"),
      subtitle: t("story.acts.act5.story.completionSubtitle"),
    },
    periodTransition: activeAct5PeriodTransition.value ?? undefined,
  };
});
const clearSummerSequenceTimers = () => {
  summerSequenceIntroTimers.forEach((timer) => clearTimeout(timer));
  summerSequenceIntroTimers = [];

  if (summerFeedbackInterludeTimer) {
    clearInterval(summerFeedbackInterludeTimer);
    summerFeedbackInterludeTimer = null;
  }
};

const clearAutumnSequenceTimers = () => {
  autumnSequenceIntroTimers.forEach((timer) => clearTimeout(timer));
  autumnSequenceIntroTimers = [];

  if (autumnFeedbackInterludeTimer) {
    clearInterval(autumnFeedbackInterludeTimer);
    autumnFeedbackInterludeTimer = null;
  }
};

const clearSpringSequenceTimers = () => {
  springSequenceIntroTimers.forEach((timer) => clearTimeout(timer));
  springSequenceIntroTimers = [];

  if (springFeedbackInterludeTimer) {
    clearInterval(springFeedbackInterludeTimer);
    springFeedbackInterludeTimer = null;
  }
};

const clearWinterSequenceTimers = () => {
  winterSequenceIntroTimers.forEach((timer) => clearTimeout(timer));
  winterSequenceIntroTimers = [];

  if (winterFeedbackInterludeTimer) {
    clearInterval(winterFeedbackInterludeTimer);
    winterFeedbackInterludeTimer = null;
  }
};

const resetSummerSequenceState = () => {
  clearSummerSequenceTimers();
  clearVisibleSummerMeasureFeedback();
  summerSequencePhase.value = "idle";
  currentSummerIntensityIndex.value = 0;
  completedSummerStepIds.value = [];
  isSummerFeedbackInterlude.value = false;
  summerFeedbackInterludeBeat.value = 1;
  summerFeedbackInterludeText.value = "";
  summerRetryPreviewFeedbackText.value = "";
  summerSequenceIntroStep.value = 0;
  sequenceEvaluationHandledKey.value = "";
};

const resetAutumnSequenceState = () => {
  clearAutumnSequenceTimers();
  clearVisibleAutumnMeasureFeedback();
  autumnSequencePhase.value = "idle";
  currentAutumnValueIndex.value = 0;
  completedAutumnStepIds.value = [];
  isAutumnFeedbackInterlude.value = false;
  autumnFeedbackInterludeBeat.value = 1;
  autumnFeedbackInterludeText.value = "";
  autumnRetryPreviewFeedbackText.value = "";
  autumnSequenceIntroStep.value = 0;
  autumnSequenceEvaluationHandledKey.value = "";
};

const resetSpringSequenceState = () => {
  clearSpringSequenceTimers();
  clearVisibleSpringMeasureFeedback();
  springSequencePhase.value = "idle";
  currentSpringValueIndex.value = 0;
  completedSpringStepIds.value = [];
  isSpringFeedbackInterlude.value = false;
  springFeedbackInterludeBeat.value = 1;
  springFeedbackInterludeText.value = "";
  springRetryPreviewFeedbackText.value = "";
  springSequenceIntroStep.value = 0;
  springSequenceEvaluationHandledKey.value = "";
};

const resetWinterSequenceState = () => {
  clearWinterSequenceTimers();
  clearVisibleWinterMeasureFeedback();
  winterSequencePhase.value = "idle";
  currentWinterValueIndex.value = 0;
  completedWinterStepIds.value = [];
  isWinterFeedbackInterlude.value = false;
  winterFeedbackInterludeBeat.value = 1;
  winterFeedbackInterludeText.value = "";
  winterRetryPreviewFeedbackText.value = "";
  winterSequenceIntroStep.value = 0;
  winterSequenceEvaluationHandledKey.value = "";
};

const getInterludeFeedbackText = () => {
  const cycleEvaluations = summerRecognition.cycleEvaluations.value;

  if (
    cycleEvaluations.some((cycleEvaluation) =>
      cycleEvaluation.beatEvaluations.some(
        (beatEvaluation) => beatEvaluation.trackingUnavailable,
      ),
    )
  ) {
    return t("story.acts.act5.summerFeedback.FULL_BODY_NOT_VISIBLE");
  }

  const feedbackCounts = new Map<SummerFeedbackCode, number>();

  cycleEvaluations.forEach((cycleEvaluation) => {
    const feedbackCode = cycleEvaluation.primaryFeedbackCode;

    if (!feedbackCode || feedbackCode === "SUCCESS") return;

    feedbackCounts.set(
      feedbackCode,
      (feedbackCounts.get(feedbackCode) ?? 0) + 1,
    );
  });

  const mostFrequentFeedback = [...feedbackCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  if (mostFrequentFeedback) {
    return t(`story.acts.act5.summerFeedback.${mostFrequentFeedback}`);
  }

  return currentSummerIntensity.value === "100"
    ? t("story.acts.act5.sequence.summerInterludeDefault100")
    : t("story.acts.act5.sequence.summerInterludeDefaultScaled");
};

const getAutumnInterludeFeedbackText = () => {
  const cycleEvaluations = autumnRecognition.cycleEvaluations.value;

  if (
    cycleEvaluations.some((cycleEvaluation) =>
      cycleEvaluation.beatEvaluations.some(
        (beatEvaluation) => beatEvaluation.trackingUnavailable,
      ),
    )
  ) {
    return getAutumnFeedbackCueText("FULL_BODY_NOT_VISIBLE");
  }

  const feedbackCounts = new Map<AutumnFeedbackCode, number>();

  cycleEvaluations.forEach((cycleEvaluation) => {
    const feedbackCode = cycleEvaluation.primaryFeedbackCode;

    if (!feedbackCode || feedbackCode === "SUCCESS") return;

    feedbackCounts.set(
      feedbackCode,
      (feedbackCounts.get(feedbackCode) ?? 0) + 1,
    );
  });

  const mostFrequentFeedback = [...feedbackCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  if (
    mostFrequentFeedback === "START_LEFT" ||
    mostFrequentFeedback === "START_RIGHT" ||
    mostFrequentFeedback === "START_ON_LEFT" ||
    mostFrequentFeedback === "START_ON_RIGHT"
  ) {
    return t("story.acts.act5.autumnFeedback.directionPattern");
  }

  return mostFrequentFeedback
    ? getAutumnFeedbackCueText(mostFrequentFeedback)
    : getAutumnFeedbackCueText("TRY_AGAIN");
};

const getSpringInterludeFeedbackText = () => {
  const cycleEvaluations = springRecognition.cycleEvaluations.value;

  if (
    cycleEvaluations.some((cycleEvaluation) =>
      cycleEvaluation.beatEvaluations.some(
        (beatEvaluation) => beatEvaluation.trackingUnavailable,
      ),
    )
  ) {
    return getSpringFeedbackCueText("FULL_BODY_NOT_VISIBLE");
  }

  const feedbackCounts = new Map<SpringFeedbackCode, number>();

  cycleEvaluations.forEach((cycleEvaluation) => {
    const feedbackCode = cycleEvaluation.primaryFeedbackCode;

    if (!feedbackCode || feedbackCode === "SUCCESS") return;

    feedbackCounts.set(
      feedbackCode,
      (feedbackCounts.get(feedbackCode) ?? 0) + 1,
    );
  });

  const mostFrequentFeedback = [...feedbackCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  return mostFrequentFeedback
    ? getSpringFeedbackCueText(mostFrequentFeedback)
    : t("story.acts.act5.sequence.springInterludeDefault");
};

const getWinterInterludeFeedbackText = () => {
  const cycleEvaluations = winterRecognition.cycleEvaluations.value;

  if (
    cycleEvaluations.some((cycleEvaluation) =>
      cycleEvaluation.beatEvaluations.some(
        (beatEvaluation) => beatEvaluation.trackingUnavailable,
      ),
    )
  ) {
    return getWinterFeedbackCueText("FULL_BODY_NOT_VISIBLE");
  }

  const feedbackCounts = new Map<WinterFeedbackCode, number>();

  cycleEvaluations.forEach((cycleEvaluation) => {
    const feedbackCode = cycleEvaluation.primaryFeedbackCode;

    if (!feedbackCode || feedbackCode === "SUCCESS") return;

    feedbackCounts.set(
      feedbackCode,
      (feedbackCounts.get(feedbackCode) ?? 0) + 1,
    );
  });

  const mostFrequentFeedback = [...feedbackCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  return mostFrequentFeedback
    ? getWinterFeedbackCueText(mostFrequentFeedback)
    : t("story.acts.act5.sequence.winterInterludeDefault");
};

const stopFeedbackInterlude = () => {
  if (summerFeedbackInterludeTimer) {
    clearInterval(summerFeedbackInterludeTimer);
    summerFeedbackInterludeTimer = null;
  }

  isSummerFeedbackInterlude.value = false;
  summerFeedbackInterludeBeat.value = 1;
  summerFeedbackInterludeText.value = "";
};

const stopAutumnFeedbackInterlude = () => {
  if (autumnFeedbackInterludeTimer) {
    clearInterval(autumnFeedbackInterludeTimer);
    autumnFeedbackInterludeTimer = null;
  }

  isAutumnFeedbackInterlude.value = false;
  autumnFeedbackInterludeBeat.value = 1;
  autumnFeedbackInterludeText.value = "";
};

const stopSpringFeedbackInterlude = () => {
  if (springFeedbackInterludeTimer) {
    clearInterval(springFeedbackInterludeTimer);
    springFeedbackInterludeTimer = null;
  }

  isSpringFeedbackInterlude.value = false;
  springFeedbackInterludeBeat.value = 1;
  springFeedbackInterludeText.value = "";
};

const stopWinterFeedbackInterlude = () => {
  if (winterFeedbackInterludeTimer) {
    clearInterval(winterFeedbackInterludeTimer);
    winterFeedbackInterludeTimer = null;
  }

  isWinterFeedbackInterlude.value = false;
  winterFeedbackInterludeBeat.value = 1;
  winterFeedbackInterludeText.value = "";
};

const clearAct5FlowAdvanceTimer = () => {
  if (!act5FlowAdvanceTimer) return;

  clearTimeout(act5FlowAdvanceTimer);
  act5FlowAdvanceTimer = null;
};

const getAct5RecognitionRules = (target: Act5SequenceTarget) => ({
  measuresPerValue: Math.max(target.rules.measuresPerStep - 1, 1),
  requiredSuccessfulMeasures: target.rules.requiredSuccessfulMeasures,
});

const startAct5RecognitionForTarget = (
  target: Act5SequenceTarget,
  keepCalibration = false,
  manual = false,
) => {
  const rules = getAct5RecognitionRules(target);

  if (target.season === "summer") {
    summerRecognition.start({
      intensity: String(target.movementValue) as SummerIntensity,
      keepCalibration,
      manual,
      rules,
    });
  }
  if (target.season === "autumn") {
    autumnRecognition.start({
      valueClass: String(target.movementValue) as AutumnValueClass,
      rules,
    });
  }
  if (target.season === "spring") {
    springRecognition.start({
      value: String(target.movementValue) as SpringValue,
      rules,
    });
  }
  if (target.season === "winter") {
    winterRecognition.start({
      value: String(target.movementValue) as WinterValue,
      rules,
    });
  }
};

const buildAct5TargetsCycleConfig = (
  targets: Act5SequenceTarget[],
): SeasonalCycleConfig => ({
  ...act5IntroCycleConfig,
  seasons: targets.map((target) => getSeasonConfig(target.season)),
  seasonDurationMs:
    act5IntroCycleConfig.repetitionCount * act5IntroCycleConfig.barDurationMs,
  repetitionCount: act5IntroCycleConfig.repetitionCount,
  countdownDurationMs: act5IntroCycleConfig.countdownDurationMs,
  seasonalAudioEnabled: true,
});

const setAct5PhaseForTarget = (target: Act5SequenceTarget | null) => {
  if (!target) {
    activeAct5Phase.value = "idle";
    return;
  }

  if (target.context === "tutorial") {
    activeAct5Phase.value = "tutorial";
    return;
  }

  activeAct5Phase.value = "climateStory";
};

const clearAct5VisibleMeasureFeedback = () => {
  clearVisibleSummerMeasureFeedback();
  clearVisibleAutumnMeasureFeedback();
  clearVisibleSpringMeasureFeedback();
  clearVisibleWinterMeasureFeedback();
};

const startAct5TargetRecognition = (
  targetIndex: number,
  {
    keepCalibration = true,
    manual = false,
  }: {
    keepCalibration?: boolean;
    manual?: boolean;
  } = {},
) => {
  clearAct5FlowAdvanceTimer();

  const target = activeAct5Targets.value[targetIndex] ?? null;

  if (!target) {
    completeAct5Flow();
    return;
  }

  activeAct5TargetIndex.value = targetIndex;
  activeAct5PreviewTarget.value = null;
  activeAct5PreviewTargetIndex.value = null;
  activeAct5PeriodTransition.value = null;
  activeAct5SequenceStatus.value = "performing";
  activeAct5AttemptNumber.value++;
  handledAct5TargetEvaluationKey.value = "";
  setAct5PhaseForTarget(target);
  stopAct5FeedbackInterlude();
  clearAct5VisibleMeasureFeedback();
  resetSkeletonFeedback({ clearHandledEvents: false });
  startAct5RecognitionForTarget(target, keepCalibration, manual);
};

const stopAct5FeedbackInterlude = () => {
  stopFeedbackInterlude();
  stopAutumnFeedbackInterlude();
  stopSpringFeedbackInterlude();
  stopWinterFeedbackInterlude();
};

const stopAct5CompletionAudio = () => {
  if (hasStoppedAct5CompletionAudio.value) return;

  hasStoppedAct5CompletionAudio.value = true;
  audioStore.stopSeasonalAudio();
  audioStore.resetBaseRhythmLoop();
};

const resetAct5FlowState = () => {
  clearAct5FlowAdvanceTimer();
  activeAct5FlowId.value = null;
  activeAct5Phase.value = "idle";
  activeAct5Targets.value = [];
  activeAct5TargetIndex.value = 0;
  activeAct5PreviewTarget.value = null;
  activeAct5PreviewTargetIndex.value = null;
  activeAct5PeriodTransition.value = null;
  activeAct5SequenceStatus.value = "idle";
  activeAct5AttemptNumber.value = 0;
  handledAct5TargetEvaluationKey.value = "";
  act5FlowCompleted.value = false;
  hasStoppedAct5CompletionAudio.value = false;
  act5RetryPreviewFeedbackText.value = "";
  stopAct5FeedbackInterlude();
  resetSkeletonBeatFeedbackState();
};

const getAct5InterludeFeedbackText = (season: ClimateSeason) => {
  if (season === "summer") return getInterludeFeedbackText();
  if (season === "autumn") return getAutumnInterludeFeedbackText();
  if (season === "spring") return getSpringInterludeFeedbackText();

  return getWinterInterludeFeedbackText();
};

const isAct5PeriodTransitionBoundary = (
  target: Act5SequenceTarget | null,
  nextTarget: Act5SequenceTarget | null,
) =>
  target?.context === "climateStory" &&
  nextTarget?.context === "climateStory" &&
  target.season === "autumn" &&
  target.interval !== nextTarget.interval;

const completeAct5Flow = () => {
  clearAct5FlowAdvanceTimer();
  activeAct5PreviewTarget.value = null;
  activeAct5PreviewTargetIndex.value = null;
  activeAct5PeriodTransition.value = null;
  activeAct5SequenceStatus.value = "completed";
  activeAct5Phase.value = "completed";
  act5FlowCompleted.value = true;
  act5RetryPreviewFeedbackText.value = "";
  clearAct5VisibleMeasureFeedback();
  stopAct5FeedbackInterlude();
  stopAct5CompletionAudio();

  if (
    activeAct5FlowId.value === "act5Full" ||
    activeAct5FlowId.value === "act5Story"
  ) {
    runtimeStore.completeAct();
  }
};

const startCurrentSummerIntensityRecognition = ({
  manual = false,
  keepCalibration = true,
}: {
  manual?: boolean;
  keepCalibration?: boolean;
} = {}) => {
  stopFeedbackInterlude();
  clearVisibleSummerMeasureFeedback();
  sequenceEvaluationHandledKey.value = "";
  resetSkeletonFeedback({ clearHandledEvents: false });
  summerRecognition.start({
    manual,
    keepCalibration,
    intensity: currentSummerIntensity.value,
  });
  summerSequencePhase.value = "performing";
};

const startCurrentAutumnValueRecognition = () => {
  stopAutumnFeedbackInterlude();
  clearVisibleAutumnMeasureFeedback();
  autumnSequenceEvaluationHandledKey.value = "";
  resetSkeletonFeedback({ clearHandledEvents: false });
  autumnRecognition.start({ valueClass: currentAutumnValue.value });
  autumnSequencePhase.value = "performing";
};

const startCurrentSpringValueRecognition = () => {
  stopSpringFeedbackInterlude();
  clearVisibleSpringMeasureFeedback();
  springSequenceEvaluationHandledKey.value = "";
  resetSkeletonFeedback({ clearHandledEvents: false });
  springRecognition.start({ value: currentSpringValue.value });
  springSequencePhase.value = "performing";
};

const startCurrentWinterValueRecognition = () => {
  stopWinterFeedbackInterlude();
  clearVisibleWinterMeasureFeedback();
  winterSequenceEvaluationHandledKey.value = "";
  resetSkeletonFeedback({ clearHandledEvents: false });
  winterRecognition.start({ value: currentWinterValue.value });
  winterSequencePhase.value = "performing";
};

const markCurrentIntensityComplete = () => {
  const stepId = currentSummerStep.value?.id;

  if (!stepId || completedSummerStepIds.value.includes(stepId)) {
    return;
  }

  completedSummerStepIds.value = [...completedSummerStepIds.value, stepId];
};

const markCurrentAutumnValueComplete = () => {
  const stepId = currentAutumnStep.value?.id;

  if (!stepId || completedAutumnStepIds.value.includes(stepId)) {
    return;
  }

  completedAutumnStepIds.value = [...completedAutumnStepIds.value, stepId];
};

const markCurrentSpringValueComplete = () => {
  const stepId = currentSpringStep.value?.id;

  if (!stepId || completedSpringStepIds.value.includes(stepId)) {
    return;
  }

  completedSpringStepIds.value = [...completedSpringStepIds.value, stepId];
};

const markCurrentWinterValueComplete = () => {
  const stepId = currentWinterStep.value?.id;

  if (!stepId || completedWinterStepIds.value.includes(stepId)) {
    return;
  }

  completedWinterStepIds.value = [...completedWinterStepIds.value, stepId];
};

const handleSummerSequenceEvaluation = () => {
  const evaluation = summerRecognition.sequenceEvaluation.value;

  if (!evaluation || summerTestMode.value !== "intensitySequence") return;

  const handledKey = `${currentSummerStep.value?.id ?? "none"}-${summerRecognition.retryCount.value}-${evaluation.resultState}`;

  if (sequenceEvaluationHandledKey.value === handledKey) return;

  sequenceEvaluationHandledKey.value = handledKey;

  if (evaluation.passed) {
    markCurrentIntensityComplete();

    if (!nextSummerStep.value) {
      summerRetryPreviewFeedbackText.value = "";
      summerSequencePhase.value = "completed";
      return;
    }

    summerSequencePhase.value = "transitioningToNextIntensity";
    queueSeasonRestart("summer", false, () => {
      summerRetryPreviewFeedbackText.value = "";
      currentSummerIntensityIndex.value += 1;
      startCurrentSummerIntensityRecognition({ keepCalibration: true });
    });
    return;
  }

  summerSequencePhase.value = "evaluatingIntensity";
  const retryFeedbackText = getInterludeFeedbackText();

  queueSeasonRestart("summer", false, () => {
    summerRetryPreviewFeedbackText.value = retryFeedbackText;
    summerRecognition.markRetryConsumed();
    startCurrentSummerIntensityRecognition({ keepCalibration: true });
  });
};

const handleAutumnSequenceEvaluation = () => {
  const evaluation = autumnRecognition.sequenceEvaluation.value;

  if (!evaluation || autumnTestMode.value !== "valueSequence") return;

  const handledKey = `${currentAutumnStep.value?.id ?? "none"}-${evaluation.resultState}-${evaluation.totalScore.toFixed(1)}`;

  if (autumnSequenceEvaluationHandledKey.value === handledKey) return;

  autumnSequenceEvaluationHandledKey.value = handledKey;

  if (evaluation.passed) {
    markCurrentAutumnValueComplete();

    if (!nextAutumnStep.value) {
      autumnRetryPreviewFeedbackText.value = "";
      autumnSequencePhase.value = "completed";
      return;
    }

    autumnSequencePhase.value = "transitioningToNextIntensity";
    queueSeasonRestart("autumn", false, () => {
      autumnRetryPreviewFeedbackText.value = "";
      currentAutumnValueIndex.value += 1;
      startCurrentAutumnValueRecognition();
    });
    return;
  }

  autumnSequencePhase.value = "evaluatingIntensity";
  const retryFeedbackText = getAutumnInterludeFeedbackText();

  queueSeasonRestart("autumn", false, () => {
    autumnRetryPreviewFeedbackText.value = retryFeedbackText;
    startCurrentAutumnValueRecognition();
  });
};

const handleSpringSequenceEvaluation = () => {
  const evaluation = springRecognition.sequenceEvaluation.value;

  if (!evaluation || springTestMode.value !== "valueSequence") return;

  const handledKey = `${currentSpringStep.value?.id ?? "none"}-${evaluation.resultState}-${evaluation.totalScore.toFixed(1)}`;

  if (springSequenceEvaluationHandledKey.value === handledKey) return;

  springSequenceEvaluationHandledKey.value = handledKey;

  if (evaluation.passed) {
    markCurrentSpringValueComplete();

    if (!nextSpringStep.value) {
      springRetryPreviewFeedbackText.value = "";
      springSequencePhase.value = "completed";
      return;
    }

    springSequencePhase.value = "transitioningToNextIntensity";
    queueSeasonRestart("spring", false, () => {
      springRetryPreviewFeedbackText.value = "";
      currentSpringValueIndex.value += 1;
      startCurrentSpringValueRecognition();
    });
    return;
  }

  springSequencePhase.value = "evaluatingIntensity";
  const retryFeedbackText = getSpringInterludeFeedbackText();

  queueSeasonRestart("spring", false, () => {
    springRetryPreviewFeedbackText.value = retryFeedbackText;
    startCurrentSpringValueRecognition();
  });
};

const handleWinterSequenceEvaluation = () => {
  const evaluation = winterRecognition.sequenceEvaluation.value;

  if (!evaluation || winterTestMode.value !== "valueSequence") return;

  const handledKey = `${currentWinterStep.value?.id ?? "none"}-${evaluation.resultState}-${evaluation.totalScore.toFixed(1)}`;

  if (winterSequenceEvaluationHandledKey.value === handledKey) return;

  winterSequenceEvaluationHandledKey.value = handledKey;

  if (evaluation.passed) {
    markCurrentWinterValueComplete();

    if (!nextWinterStep.value) {
      winterRetryPreviewFeedbackText.value = "";
      winterSequencePhase.value = "completed";
      return;
    }

    winterSequencePhase.value = "transitioningToNextIntensity";
    queueSeasonRestart("winter", false, () => {
      winterRetryPreviewFeedbackText.value = "";
      currentWinterValueIndex.value += 1;
      startCurrentWinterValueRecognition();
    });
    return;
  }

  winterSequencePhase.value = "evaluatingIntensity";
  const retryFeedbackText = getWinterInterludeFeedbackText();

  queueSeasonRestart("winter", false, () => {
    winterRetryPreviewFeedbackText.value = retryFeedbackText;
    startCurrentWinterValueRecognition();
  });
};

const scheduleAct5SuccessTransition = () => {
  const nextTargetIndex = activeAct5TargetIndex.value + 1;
  const target = activeAct5Target.value;
  const nextTarget = activeAct5Targets.value[nextTargetIndex] ?? null;

  if (isAct5PeriodTransitionBoundary(target, nextTarget)) {
    queueSeasonIndexRestart(
      activeAct5TargetIndex.value,
      false,
      () => {
        activeAct5PeriodTransition.value = null;
        startAct5TargetRecognition(nextTargetIndex, {
          keepCalibration: true,
        });
      },
      {
        interludeDurationMs: act5IntroCycleConfig.barDurationMs,
        restartSeasonIndex: nextTargetIndex,
        onInterludeStart: () => {
          if (!target || !nextTarget) return;

          activeAct5SequenceStatus.value = "periodTransition";
          activeAct5PeriodTransition.value = {
            previousPeriod: target.interval ?? "",
            nextPeriod: nextTarget.interval ?? "",
          };
          activeAct5PreviewTarget.value = null;
          activeAct5PreviewTargetIndex.value = null;
          act5RetryPreviewFeedbackText.value = "";
          handledAct5TargetEvaluationKey.value = "";
          clearAct5VisibleMeasureFeedback();
          stopAct5FeedbackInterlude();
          resetSkeletonFeedback({ clearHandledEvents: false });
        },
      },
    );
    return;
  }

  if (nextTarget) {
    act5RetryPreviewFeedbackText.value = "";
    return;
  }

  queueSeasonIndexEndAction(activeAct5TargetIndex.value, () => {
    completeAct5Flow();
  });
};

const scheduleAct5Retry = (target: Act5SequenceTarget) => {
  const retryFeedbackText = getAct5InterludeFeedbackText(target.season);

  queueSeasonIndexRestart(activeAct5TargetIndex.value, false, () => {
    stopAct5FeedbackInterlude();
    act5RetryPreviewFeedbackText.value = retryFeedbackText;
    activeAct5SequenceStatus.value = "performing";
    startAct5TargetRecognition(activeAct5TargetIndex.value, {
      keepCalibration: true,
    });
  });
};

const handleAct5TargetEvaluation = ({
  target,
  passed,
  resultState,
  totalScore,
}: {
  target: Act5SequenceTarget;
  passed: boolean;
  resultState: string;
  totalScore: number;
}) => {
  if (!isAct5FinalFlowActive.value) return;
  if (activeAct5SequenceStatus.value !== "performing") return;
  if (activeAct5MovementStep.value?.id !== target.id) return;

  const handledKey = [
    target.id,
    activeAct5AttemptNumber.value,
    resultState,
    totalScore.toFixed(1),
  ].join("-");

  if (handledAct5TargetEvaluationKey.value === handledKey) return;

  handledAct5TargetEvaluationKey.value = handledKey;

  if (passed) {
    scheduleAct5SuccessTransition();
    return;
  }

  scheduleAct5Retry(target);
};

const ensureClimateDataReady = async () => {
  const loadedDataset = await climateData.loadClimateSeasonData();
  const hasValidationErrors = climateData.validationErrors.value.length > 0;

  if (!loadedDataset || hasValidationErrors) {
    climateDataUserError.value = t("story.acts.act5.climateData.loadError");
    return false;
  }

  climateDataUserError.value = "";
  return true;
};

const resetClimateDebugFlowState = () => {
  summerTestMode.value = "single100";
  autumnTestMode.value = "single100";
  springTestMode.value = "single100";
  winterTestMode.value = "single100";
  resetSummerSequenceState();
  resetAutumnSequenceState();
  resetSpringSequenceState();
  resetWinterSequenceState();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
};

const startAct5FinalFlow = async (
  flowId: Act5FlowId,
  targets: Act5SequenceTarget[],
) => {
  if (!(await ensureClimateDataReady())) return;

  if (!targets.length) {
    completeAct5Flow();
    return;
  }

  storyEngine.startAct(act.value.id);
  resetAct5FlowState();
  resetClimateDebugFlowState();
  await reset();

  activeAct5FlowId.value = flowId;
  activeAct5Targets.value = targets;
  activeAct5TargetIndex.value = 0;
  activeAct5AttemptNumber.value = 0;
  act5FlowCompleted.value = false;
  hasStoppedAct5CompletionAudio.value = false;

  startAct5TargetRecognition(0, {
    keepCalibration: false,
    manual: true,
  });
  await startCustomCycle(buildAct5TargetsCycleConfig(targets), true);
};

const startAct5FullFlow = async () => {
  if (!(await ensureClimateDataReady())) return;

  const dataset = climateData.dataset.value;

  if (!dataset) return;

  await startAct5FinalFlow(
    climateMovementFlowRegistry.act5Full.id,
    buildAct5FullFlow(dataset),
  );
};

const startAct5WithoutTutorial = async () => {
  if (!(await ensureClimateDataReady())) return;

  const dataset = climateData.dataset.value;

  if (!dataset) return;

  await startAct5FinalFlow(
    climateMovementFlowRegistry.act5Story.id,
    buildAct5ClimateStoryFlow(dataset),
  );
};

const startAct5TutorialDebug = async () => {
  await startAct5FinalFlow(
    climateMovementFlowRegistry.act5TutorialDebug.id,
    buildAct5TutorialDebugFlow(),
  );
};

const togglePlayback = async () => {
  if (
    act5FlowCompleted.value ||
    activeAct5SequenceStatus.value === "completed"
  ) {
    return;
  }

  if (
    playbackState.value === "playing" ||
    playbackState.value === "countdown"
  ) {
    pause();
    return;
  }

  await play();
};
const toggleAct5AutoProgress = () => {
  if (!isDebugMode.value) {
    act5AutoProgressEnabled.value = false;
    return;
  }

  act5AutoProgressEnabled.value = !act5AutoProgressEnabled.value;
};
const toggleDebugMode = () => {
  debugModeEnabled.value = !debugModeEnabled.value;

  if (debugModeEnabled.value) return;

  act5AutoProgressEnabled.value = false;
};
const getDebugSeasonSequenceLabel = (seasonId: SeasonalCycleSeasonId) => {
  if (seasonId === "winter") {
    return t("story.acts.act5.debug.startWinterSequence");
  }
  if (seasonId === "spring") {
    return t("story.acts.act5.debug.startSpringSequence");
  }
  if (seasonId === "summer") {
    return t("story.acts.act5.debug.startSummerSequence");
  }

  return t("story.acts.act5.debug.startAutumnSequence");
};
const startDebugSeasonSequence = (seasonId: SeasonalCycleSeasonId) => {
  if (seasonId === "winter") {
    void startWinterSequence();
    return;
  }
  if (seasonId === "spring") {
    void startSpringSequence();
    return;
  }
  if (seasonId === "summer") {
    void startSummerSequence();
    return;
  }

  void startAutumnSequence();
};
const resetCycle = async () => {
  climateDataUserError.value = "";
  resetAct5FlowState();
  summerTestMode.value = "single100";
  autumnTestMode.value = "single100";
  springTestMode.value = "single100";
  winterTestMode.value = "single100";
  resetSummerSequenceState();
  resetAutumnSequenceState();
  resetSpringSequenceState();
  resetWinterSequenceState();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
  await reset();
};

const startDebugSeason = async (seasonId: SeasonalCycleSeasonId) => {
  if (!(await ensureClimateDataReady())) return;

  resetAct5FlowState();
  summerTestMode.value = "single100";
  autumnTestMode.value = "single100";
  springTestMode.value = "single100";
  winterTestMode.value = "single100";
  resetSummerSequenceState();
  resetAutumnSequenceState();
  resetSpringSequenceState();
  resetWinterSequenceState();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();

  if (seasonId === "summer") {
    summerRecognition.start({ manual: true, intensity: "100" });
  }
  if (seasonId === "autumn") {
    autumnRecognition.start({ valueClass: "100" });
  }
  if (seasonId === "spring") {
    springRecognition.start({ value: "100" });
  }
  if (seasonId === "winter") {
    winterRecognition.start({ value: "100" });
  }

  await startSingleSeason(seasonId);
};

const startSummerSequence = async () => {
  if (!(await ensureClimateDataReady())) return;

  resetAct5FlowState();
  summerTestMode.value = "intensitySequence";
  autumnTestMode.value = "single100";
  springTestMode.value = "single100";
  winterTestMode.value = "single100";
  resetSummerSequenceState();
  resetAutumnSequenceState();
  resetSpringSequenceState();
  resetWinterSequenceState();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
  await reset();

  startCurrentSummerIntensityRecognition({
    manual: true,
    keepCalibration: false,
  });
  await startSingleSeason("summer");
};

const startAutumnSequence = async () => {
  if (!(await ensureClimateDataReady())) return;

  resetAct5FlowState();
  summerTestMode.value = "single100";
  autumnTestMode.value = "valueSequence";
  springTestMode.value = "single100";
  winterTestMode.value = "single100";
  resetSummerSequenceState();
  resetAutumnSequenceState();
  resetSpringSequenceState();
  resetWinterSequenceState();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
  await reset();

  startCurrentAutumnValueRecognition();
  await startSingleSeason("autumn");
};

const startSpringSequence = async () => {
  if (!(await ensureClimateDataReady())) return;

  resetAct5FlowState();
  summerTestMode.value = "single100";
  autumnTestMode.value = "single100";
  springTestMode.value = "valueSequence";
  winterTestMode.value = "single100";
  resetSummerSequenceState();
  resetAutumnSequenceState();
  resetSpringSequenceState();
  resetWinterSequenceState();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
  await reset();

  startCurrentSpringValueRecognition();
  await startSingleSeason("spring");
};

const startWinterSequence = async () => {
  if (!(await ensureClimateDataReady())) return;

  resetAct5FlowState();
  summerTestMode.value = "single100";
  autumnTestMode.value = "single100";
  springTestMode.value = "single100";
  winterTestMode.value = "valueSequence";
  resetSummerSequenceState();
  resetAutumnSequenceState();
  resetSpringSequenceState();
  resetWinterSequenceState();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
  await reset();

  startCurrentWinterValueRecognition();
  await startSingleSeason("winter");
};

const triggerSkeletonPulseTest = () => {
  triggerBeatSuccess({
    evaluationId: `debug-skeleton-pulse-${Math.round(performance.now())}`,
    flowId: "debug",
    flowStepId: "debug-skeleton-pulse",
    measureIndex: 0,
    beatIndex: 1,
    result: "passed",
  });
};

const continueToNextAct = async () => {
  const nextActId = runtimeStore.currentAct?.nextActId;

  storyEngine.continueFromGate();

  if (!nextActId) return;

  await navigateTo(`/story/${nextActId}`);
};

onMounted(() => {
  storyEngine.startAct(act.value.id);
  void climateData.loadClimateSeasonData().then((loadedDataset) => {
    if (!loadedDataset) {
      climateDataUserError.value = t("story.acts.act5.climateData.loadError");
    }
  });
  void initialize();
});

watch(
  isDebugMode,
  (debugEnabled) => {
    if (!debugEnabled) {
      act5AutoProgressEnabled.value = false;
    }
  },
  { immediate: true },
);

watch(
  [
    act5FlowCompleted,
    () => activeAct5SequenceStatus.value,
    () => activeAct5Phase.value,
  ],
  ([flowCompleted, sequenceStatus, phase]) => {
    if (
      flowCompleted ||
      sequenceStatus === "completed" ||
      phase === "completed"
    ) {
      stopAct5CompletionAudio();
    }
  },
);

watch(
  [
    poseLandmarks,
    playbackState,
    () => currentSeason.value.id,
    () => activeAct5DisplayTarget.value?.id,
    seasonElapsedMs,
    repetitionIndex,
    isTransition,
    isSeasonEvaluationEnabled,
    isSummerFeedbackInterlude,
    isAutumnFeedbackInterlude,
    isSpringFeedbackInterlude,
    isWinterFeedbackInterlude,
    () => activeAct5SequenceStatus.value,
    isAct5AutoProgressEnabled,
  ],
  () => {
    const recognitionSuppressed =
      activeAct5SequenceStatus.value === "feedbackInterlude" ||
      activeAct5SequenceStatus.value === "periodTransition";
    const recognitionPlaybackState = recognitionSuppressed
      ? "idle"
      : playbackState.value;
    const recognitionSeasonId = recognitionSuppressed
      ? "act5-preview"
      : (activeAct5Target.value?.season ?? currentSeason.value.id);
    const recognitionRepetitionIndex = recognitionSuppressed
      ? null
      : repetitionIndex.value;
    const recognitionIsTransition = recognitionSuppressed
      ? false
      : isTransition.value;

    summerRecognition.updateFrame({
      landmarks: poseLandmarks.value,
      playbackState: recognitionPlaybackState,
      seasonId: isSummerFeedbackInterlude.value
        ? "summer-feedback-interlude"
        : recognitionSeasonId,
      seasonElapsedMs: seasonElapsedMs.value,
      repetitionIndex: recognitionRepetitionIndex,
      isTransition: recognitionIsTransition,
      evaluationEnabled: isSeasonEvaluationEnabled.value,
      autoProgressEnabled: isAct5AutoProgressEnabled.value,
    });
    autumnRecognition.updateFrame({
      landmarks: mirrorLandmarksHorizontally(poseLandmarks.value),
      playbackState: recognitionPlaybackState,
      seasonId: isAutumnFeedbackInterlude.value
        ? "autumn-feedback-interlude"
        : recognitionSeasonId,
      seasonElapsedMs: seasonElapsedMs.value,
      repetitionIndex: recognitionRepetitionIndex,
      isTransition: recognitionIsTransition,
      evaluationEnabled: isSeasonEvaluationEnabled.value,
      autoProgressEnabled: isAct5AutoProgressEnabled.value,
    });
    springRecognition.updateFrame({
      landmarks: poseLandmarks.value,
      playbackState: recognitionPlaybackState,
      seasonId: isSpringFeedbackInterlude.value
        ? "spring-feedback-interlude"
        : recognitionSeasonId,
      seasonElapsedMs: seasonElapsedMs.value,
      repetitionIndex: recognitionRepetitionIndex,
      isTransition: recognitionIsTransition,
      evaluationEnabled: isSeasonEvaluationEnabled.value,
      autoProgressEnabled: isAct5AutoProgressEnabled.value,
    });
    winterRecognition.updateFrame({
      landmarks: poseLandmarks.value,
      playbackState: recognitionPlaybackState,
      seasonId: isWinterFeedbackInterlude.value
        ? "winter-feedback-interlude"
        : recognitionSeasonId,
      seasonElapsedMs: seasonElapsedMs.value,
      repetitionIndex: recognitionRepetitionIndex,
      isTransition: recognitionIsTransition,
      evaluationEnabled: isSeasonEvaluationEnabled.value,
      autoProgressEnabled: isAct5AutoProgressEnabled.value,
    });
  },
  { immediate: true },
);

watch(
  currentSeasonIndex,
  (nextIndex) => {
    if (!isAct5FinalFlowActive.value) return;
    if (activeAct5SequenceStatus.value !== "performing") return;
    if (nextIndex === activeAct5TargetIndex.value) return;

    const target = activeAct5Targets.value[nextIndex] ?? null;

    if (!target) return;

    startAct5TargetRecognition(nextIndex, {
      keepCalibration: true,
    });
  },
  { flush: "post" },
);

watch(
  () => summerRecognition.sequenceEvaluation.value,
  (evaluation) => {
    if (!evaluation) return;
    if (
      isAct5FinalFlowActive.value &&
      activeAct5MovementStep.value?.season === "summer"
    ) {
      handleAct5TargetEvaluation({
        target: activeAct5MovementStep.value,
        passed: evaluation.passed,
        resultState: evaluation.resultState,
        totalScore: evaluation.totalScore,
      });
      return;
    }
    if (summerTestMode.value === "intensitySequence") {
      handleSummerSequenceEvaluation();
      return;
    }
    if (!summerRecognition.canRetryAutomatically.value) return;
    if (currentSeason.value.id !== "summer") return;

    queueSeasonRestart("summer", false, () => {
      clearVisibleSummerMeasureFeedback();
      summerRecognition.markRetryConsumed();
      summerRecognition.start({ keepCalibration: true });
    });
  },
);

watch(
  () => autumnRecognition.sequenceEvaluation.value,
  (evaluation) => {
    if (!evaluation) return;
    if (
      isAct5FinalFlowActive.value &&
      activeAct5MovementStep.value?.season === "autumn"
    ) {
      handleAct5TargetEvaluation({
        target: activeAct5MovementStep.value,
        passed: evaluation.passed,
        resultState: evaluation.resultState,
        totalScore: evaluation.totalScore,
      });
      return;
    }
    if (autumnTestMode.value === "valueSequence") {
      handleAutumnSequenceEvaluation();
    }
  },
);

watch(
  () => springRecognition.sequenceEvaluation.value,
  (evaluation) => {
    if (!evaluation) return;
    if (
      isAct5FinalFlowActive.value &&
      activeAct5MovementStep.value?.season === "spring"
    ) {
      handleAct5TargetEvaluation({
        target: activeAct5MovementStep.value,
        passed: evaluation.passed,
        resultState: evaluation.resultState,
        totalScore: evaluation.totalScore,
      });
      return;
    }
    if (springTestMode.value === "valueSequence") {
      handleSpringSequenceEvaluation();
    }
  },
);

watch(
  () => winterRecognition.sequenceEvaluation.value,
  (evaluation) => {
    if (!evaluation) return;
    if (
      isAct5FinalFlowActive.value &&
      activeAct5MovementStep.value?.season === "winter"
    ) {
      handleAct5TargetEvaluation({
        target: activeAct5MovementStep.value,
        passed: evaluation.passed,
        resultState: evaluation.resultState,
        totalScore: evaluation.totalScore,
      });
      return;
    }
    if (winterTestMode.value === "valueSequence") {
      handleWinterSequenceEvaluation();
    }
  },
);

watch(
  () => summerRecognition.currentCycleEvaluation.value,
  (cycleEvaluation) => {
    if (!cycleEvaluation) {
      clearVisibleSummerMeasureFeedback();
      return;
    }

    visibleSummerMeasureFeedback.value =
      getSummerMeasureFeedback(cycleEvaluation);
  },
);

watch(
  () => autumnRecognition.currentCycleEvaluation.value,
  (cycleEvaluation) => {
    if (!cycleEvaluation) {
      clearVisibleAutumnMeasureFeedback();
      return;
    }

    visibleAutumnMeasureFeedback.value =
      getAutumnMeasureFeedback(cycleEvaluation);
  },
);

watch(
  () => springRecognition.currentCycleEvaluation.value,
  (cycleEvaluation) => {
    if (!cycleEvaluation) {
      clearVisibleSpringMeasureFeedback();
      return;
    }

    visibleSpringMeasureFeedback.value =
      getSpringMeasureFeedback(cycleEvaluation);
  },
);

watch(
  () => winterRecognition.currentCycleEvaluation.value,
  (cycleEvaluation) => {
    if (!cycleEvaluation) {
      clearVisibleWinterMeasureFeedback();
      return;
    }

    visibleWinterMeasureFeedback.value =
      getWinterMeasureFeedback(cycleEvaluation);
  },
);

watch(
  [
    () => currentSeason.value.id,
    repetitionIndex,
    () => activeClimateStep.value?.id,
  ],
  ([seasonId, currentMeasureIndex, currentFlowStepId]) => {
    const summerFeedbackMeasureIndex =
      visibleSummerMeasureFeedback.value?.measureIndex ?? null;
    const summerFeedbackFlowStepId =
      visibleSummerMeasureFeedback.value?.flowStepId ?? null;
    const feedbackMeasureIndex =
      visibleAutumnMeasureFeedback.value?.measureIndex ?? null;
    const feedbackFlowStepId =
      visibleAutumnMeasureFeedback.value?.flowStepId ?? null;
    const springFeedbackMeasureIndex =
      visibleSpringMeasureFeedback.value?.measureIndex ?? null;
    const springFeedbackFlowStepId =
      visibleSpringMeasureFeedback.value?.flowStepId ?? null;
    const winterFeedbackMeasureIndex =
      visibleWinterMeasureFeedback.value?.measureIndex ?? null;
    const winterFeedbackFlowStepId =
      visibleWinterMeasureFeedback.value?.flowStepId ?? null;

    if (
      seasonId !== "summer" ||
      summerFeedbackMeasureIndex === null ||
      summerFeedbackMeasureIndex !== currentMeasureIndex ||
      summerFeedbackFlowStepId !== currentFlowStepId
    ) {
      clearVisibleSummerMeasureFeedback();
    }

    if (
      seasonId !== "autumn" ||
      feedbackMeasureIndex === null ||
      feedbackMeasureIndex !== currentMeasureIndex ||
      feedbackFlowStepId !== currentFlowStepId
    ) {
      clearVisibleAutumnMeasureFeedback();
    }

    if (
      seasonId !== "spring" ||
      springFeedbackMeasureIndex === null ||
      springFeedbackMeasureIndex !== currentMeasureIndex ||
      springFeedbackFlowStepId !== currentFlowStepId
    ) {
      clearVisibleSpringMeasureFeedback();
    }

    if (
      seasonId !== "winter" ||
      winterFeedbackMeasureIndex === null ||
      winterFeedbackMeasureIndex !== currentMeasureIndex ||
      winterFeedbackFlowStepId !== currentFlowStepId
    ) {
      clearVisibleWinterMeasureFeedback();
    }
  },
);

watch(
  [
    () => summerRecognition.finalizedBeatEvaluations.value,
    () => autumnRecognition.finalizedBeatEvaluations.value,
    () => springRecognition.finalizedBeatEvaluations.value,
    () => winterRecognition.finalizedBeatEvaluations.value,
  ],
  ([
    summerEvaluations,
    autumnEvaluations,
    springEvaluations,
    winterEvaluations,
  ]) => {
    processSkeletonBeatEvaluations("summer", summerEvaluations);
    processSkeletonBeatEvaluations("autumn", autumnEvaluations);
    processSkeletonBeatEvaluations("spring", springEvaluations);
    processSkeletonBeatEvaluations("winter", winterEvaluations);
  },
);

watch(
  [
    poseLandmarks,
    playbackState,
    () => activeSeasonId.value,
    () => activeAct5SequenceStatus.value,
    () => activeAct5MovementStep.value?.id,
    isTransition,
    repetitionIndex,
    isSummerFeedbackInterlude,
    isAutumnFeedbackInterlude,
    isSpringFeedbackInterlude,
    isWinterFeedbackInterlude,
    () => summerRecognition.currentEvaluation.value,
    () => autumnRecognition.currentEvaluation.value,
    () => springRecognition.currentEvaluation.value,
    () => winterRecognition.currentEvaluation.value,
  ],
  () => {
    if (!isSkeletonBeatFeedbackAllowed(activeSeasonId.value)) {
      setTrackingLimited(false);
      return;
    }

    if (!poseLandmarks.value?.length) {
      setTrackingLimited(true);
      return;
    }

    setTrackingLimited(
      getActiveSkeletonEvaluation()?.trackingUnavailable === true,
    );
  },
);

onBeforeUnmount(() => {
  resetAct5FlowState();
  clearSummerSequenceTimers();
  clearAutumnSequenceTimers();
  clearSpringSequenceTimers();
  clearWinterSequenceTimers();
  summerRecognition.reset();
  autumnRecognition.reset();
  springRecognition.reset();
  winterRecognition.reset();
  resetSkeletonBeatFeedbackState();
  cleanup();
  storyEngine.stopStoryEngine();
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
