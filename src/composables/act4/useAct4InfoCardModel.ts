import { computed } from "vue";
import { useAct4Store } from "~/store/act4";
import { act4IntroCycleConfig } from "~/story/act4IntroCycle";
import type { Act4Recognition } from "~/composables/act4/useAct4Recognition";
import type { Act4InfoCardMode, Act4InfoCardModel } from "~/types/act4";
import type { ClimateMovementFlowStep, ClimateSeason } from "~/types/climate";
import { getAct4FeedbackTextKey } from "~/utils/act4/feedback/catalog";
import { formatClimateTemperature } from "~/utils/movement/acts/climate/climateSeasonData";
import type {
  SeasonalCyclePlaybackState,
  SeasonalCycleSeasonConfig,
} from "~/utils/seasonalCycle";

type Act4CyclePresentationState = {
  currentSeason: { value: SeasonalCycleSeasonConfig };
  currentBeat: { value: number | null };
  countdownRemaining: { value: number };
  playbackState: { value: SeasonalCyclePlaybackState };
  repetitionIndex: { value: number | null };
  seasonElapsedMs: { value: number };
  seasonPhase: { value: "preview" | "performance" | "transition" };
  isCountingDown: { value: boolean };
  isCompleted: { value: boolean };
  isTransition: { value: boolean };
};

const ACT4_LARGE_SEASON_PREVIEW_DURATION_MS = 3_000;

const summerBeatFallbackInstructions: Record<number, string> = {
  1: "story.acts.act4.summerInstructions.fallback.1",
  2: "story.acts.act4.summerInstructions.fallback.2",
  3: "story.acts.act4.summerInstructions.fallback.3",
  4: "story.acts.act4.summerInstructions.fallback.4",
};

const summerIntensityGuidance: Record<string, Record<number, string>> = {
  "100": {
    1: "story.acts.act4.summerInstructions.beats.1",
    2: "story.acts.act4.summerInstructions.beats.100.2",
    3: "story.acts.act4.summerInstructions.beats.100.3",
    4: "story.acts.act4.summerInstructions.beats.4",
  },
  "60": {
    1: "story.acts.act4.summerInstructions.beats.1",
    2: "story.acts.act4.summerInstructions.beats.60.2",
    3: "story.acts.act4.summerInstructions.beats.60.3",
    4: "story.acts.act4.summerInstructions.beats.4",
  },
  "30": {
    1: "story.acts.act4.summerInstructions.beats.1",
    2: "story.acts.act4.summerInstructions.beats.30.2",
    3: "story.acts.act4.summerInstructions.beats.30.3",
    4: "story.acts.act4.summerInstructions.beats.4",
  },
  "10": {
    1: "story.acts.act4.summerInstructions.beats.1",
    2: "story.acts.act4.summerInstructions.beats.10.2",
    3: "story.acts.act4.summerInstructions.beats.10.3",
    4: "story.acts.act4.summerInstructions.beats.4",
  },
};

const beatInstructions: Record<ClimateSeason, Record<number, string>> = {
  summer: summerBeatFallbackInstructions,
  autumn: {
    1: "story.acts.act4.autumnInstructions.beats.1",
    2: "story.acts.act4.autumnInstructions.beats.2",
    3: "story.acts.act4.autumnInstructions.beats.3",
    4: "story.acts.act4.autumnInstructions.beats.4",
  },
  spring: {
    1: "story.acts.act4.springInstructions.beat1",
    2: "story.acts.act4.springInstructions.beat2",
    3: "story.acts.act4.springInstructions.beat3",
    4: "story.acts.act4.springInstructions.beat4",
  },
  winter: {
    1: "story.acts.act4.winterInstructions.beat1",
    2: "story.acts.act4.winterInstructions.beat2",
    3: "story.acts.act4.winterInstructions.beat3",
    4: "story.acts.act4.winterInstructions.beat4",
  },
};

const formatMovementPercent = (value: string | number) =>
  String(value).replace(/\.0$/, "");

const clampBeat = (beat: number | null) =>
  Math.min(Math.max(Math.round(beat ?? 1), 1), 4);

export const useAct4InfoCardModel = ({
  cycle,
  recognition,
  climateDataError,
  getSeasonBaselineStep,
}: {
  cycle: Act4CyclePresentationState;
  recognition: Act4Recognition;
  climateDataError: { value: string };
  getSeasonBaselineStep: (
    season: ClimateSeason,
  ) => ClimateMovementFlowStep | null;
}) => {
  const store = useAct4Store();
  const { t } = useStoryTranslations();

  const activeSeason = computed<ClimateSeason>(
    () => store.currentSeason ?? cycle.currentSeason.value.id,
  );
  const activeClimateStep = computed(
    () => store.currentTarget?.climateData ?? null,
  );
  const activeBeat = computed(() => clampBeat(cycle.currentBeat.value));
  const activeMovementPercentLabel = computed(() => {
    const value =
      store.currentTarget?.movementValue ??
      activeClimateStep.value?.movementValue ??
      100;

    return `${formatMovementPercent(value)}%`;
  });
  const currentSeasonLabel = computed(() => {
    const season = store.currentTarget
      ? act4IntroCycleConfig.seasons.find(
          (item) => item.id === store.currentTarget?.season,
        )
      : cycle.currentSeason.value;

    if (!season) return "";

    return season.labelKey ? t(season.labelKey) : season.label;
  });
  const periodLabel = computed(() => {
    if (store.phase === "tutorial") {
      return t("story.acts.act4.tutorial.general.title");
    }

    return (
      activeClimateStep.value?.interval ??
      t("story.acts.act4.periodPlaceholder")
    );
  });
  const temperatureLabel = computed(() => {
    const step = activeClimateStep.value;

    if (!step) return "";

    return formatClimateTemperature({
      value: step.displayValue,
      type: step.displayValueType,
      unit: step.displayUnit,
    });
  });
  const baselinePeriodLabel = computed(
    () => getSeasonBaselineStep(activeSeason.value)?.interval ?? "",
  );
  const getBeatInstructionKey = (beat: number) => {
    if (activeSeason.value === "summer") {
      const value = String(store.currentTarget?.movementValue ?? "100");

      return (
        summerIntensityGuidance[value]?.[beat] ??
        beatInstructions.summer[beat] ??
        "story.acts.act4.instructions.repeat"
      );
    }

    return (
      beatInstructions[activeSeason.value][beat] ??
      "story.acts.act4.instructions.repeat"
    );
  };
  const instructions = computed(() =>
    Array.from({ length: 4 }, (_, index) => {
      const beat = ((activeBeat.value + index - 1) % 4) + 1;
      const instructionKey = getBeatInstructionKey(beat);

      return {
        beat,
        text: t(instructionKey),
        active: beat === activeBeat.value,
      };
    }),
  );
  const mode = computed<Act4InfoCardMode>(() => {
    if (store.isCompleted) return "completed";
    if (store.sequenceStatus === "periodTransition") return "periodTransition";
    if (store.sequenceStatus === "tutorialExplanation") {
      return "tutorialExplanation";
    }
    if (
      store.sequenceStatus === "storyIntro" ||
      store.sequenceStatus === "storyReferencePreview" ||
      store.sequenceStatus === "storyReferenceComplete"
    ) {
      return "storyNarration";
    }

    const isLargeSeasonPreviewVisible =
      store.isFlowActive &&
      cycle.seasonPhase.value === "preview" &&
      cycle.seasonElapsedMs.value < ACT4_LARGE_SEASON_PREVIEW_DURATION_MS &&
      !store.attempt.retryPreviewFeedbackText;

    return isLargeSeasonPreviewVisible ? "seasonPreview" : "activeMovement";
  });
  const isMeasureFeedbackVisible = computed(
    () =>
      Boolean(store.feedback.visibleMeasureResult) &&
      store.feedback.visibleMeasureIndex !== null &&
      store.feedback.visibleMeasureIndex === cycle.repetitionIndex.value &&
      cycle.currentBeat.value === 4,
  );
  const isRetryPreviewFeedbackVisible = computed(
    () =>
      Boolean(store.attempt.retryPreviewFeedbackText) &&
      cycle.repetitionIndex.value === 0 &&
      !store.isCompleted,
  );
  const feedback = computed<Act4InfoCardModel["feedback"]>(() => {
    if (mode.value === "tutorialExplanation") {
      return store.tutorialNarration.textKey
        ? {
            text: t(
              store.tutorialNarration.textKey,
              store.tutorialNarration.params,
            ),
            tone: "neutral",
          }
        : undefined;
    }

    if (mode.value === "storyNarration") {
      return store.storyNarration.textKey
        ? {
            text: t(store.storyNarration.textKey, store.storyNarration.params),
            tone: "neutral",
          }
        : undefined;
    }

    if (mode.value !== "activeMovement") return undefined;

    if (climateDataError.value) {
      return {
        text: climateDataError.value,
        tone: "error",
      };
    }

    if (
      store.debug.autoProgressEnabled &&
      isMeasureFeedbackVisible.value &&
      store.feedback.visibleMeasureResult
    ) {
      return {
        text: t("story.acts.act4.debug.autoProgressFeedback"),
        tone: "neutral",
      };
    }

    if (isRetryPreviewFeedbackVisible.value) {
      return {
        text: store.attempt.retryPreviewFeedbackText,
        tone: "error",
      };
    }

    if (isMeasureFeedbackVisible.value && store.feedback.visibleMeasureResult) {
      const result = store.feedback.visibleMeasureResult;
      const text =
        result === "success"
          ? t("story.acts.act4.movementText.bravo")
          : result === "almostCorrect"
            ? t("story.acts.act4.movementText.good")
            : t(
                getAct4FeedbackTextKey(
                  activeSeason.value,
                  store.feedback.visibleFeedbackCode,
                ),
              );

      return {
        text,
        tone:
          result === "success"
            ? "excellent"
            : result === "almostCorrect"
              ? "success"
              : result === "trackingUnavailable"
                ? "warning"
                : "error",
      };
    }

    return undefined;
  });
  const subtitle = computed(() => {
    if (mode.value !== "activeMovement" || feedback.value) return "";

    if (cycle.isCountingDown.value) {
      return t("story.acts.act4.instructions.countdown", {
        count: cycle.countdownRemaining.value,
      });
    }

    if (cycle.playbackState.value === "idle") {
      return t("story.acts.act4.movementText.ready");
    }

    if (cycle.playbackState.value === "paused") {
      return t("story.acts.act4.instructions.paused");
    }

    if (store.sequenceStatus === "retryInterlude") {
      return t("story.acts.act4.movementText.tryAgain");
    }

    if (cycle.isTransition.value) {
      return t("story.acts.act4.movementText.nextPeriod");
    }

    return t(getBeatInstructionKey(activeBeat.value));
  });
  const model = computed<Act4InfoCardModel>(() => ({
    mode: mode.value,
    seasonLabel: currentSeasonLabel.value,
    movementPercentLabel: activeMovementPercentLabel.value,
    periodLabel: periodLabel.value,
    temperature: {
      valueLabel: activeClimateStep.value?.isBaseline
        ? t("story.acts.act4.climateInfo.referencePeriod")
        : temperatureLabel.value,
      baselineLabel: baselinePeriodLabel.value,
      isBaseline: activeClimateStep.value?.isBaseline ?? false,
    },
    instructions: mode.value === "activeMovement" ? instructions.value : [],
    feedback: feedback.value,
    subtitle: subtitle.value,
    completion: {
      title: t("story.acts.act4.story.completionTitle"),
      subtitle: t("story.acts.act4.story.completionSubtitle"),
    },
    periodTransition: store.periodTransition ?? undefined,
  }));
  const chartMeasureEvaluations = computed(
    () => recognition.cycleEvaluations.value,
  );

  return {
    model,
    currentSeasonLabel,
    activeClimateStep,
    activeSeason,
    chartMeasureEvaluations,
    getFeedbackText: (
      target: { season: ClimateSeason },
      feedbackCode = recognition.feedbackCode.value,
    ) => t(getAct4FeedbackTextKey(target.season, feedbackCode)),
  };
};
