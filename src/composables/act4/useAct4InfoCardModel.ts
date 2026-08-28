import { computed } from "vue";
import { useStoryTranslations } from "~/composables/useStoryTranslations";
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

const formatMovementPercent = (value: string | number) =>
  String(value).replace(/\.0$/, "");

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
  const mode = computed<Act4InfoCardMode>(() => {
    if (store.isCompleted) return "completed";
    if (store.sequenceStatus === "periodTransition") return "periodTransition";
    if (store.sequenceStatus === "tutorialExplanation") {
      return "narration";
    }
    if (
      store.sequenceStatus === "storyIntro" ||
      store.sequenceStatus === "storyReferencePreview" ||
      store.sequenceStatus === "storyReferenceComplete"
    ) {
      return "narration";
    }

    return store.phase === "tutorial" ? "tutorial" : "story";
  });
  const narration = computed<Act4InfoCardModel["narration"]>(() => {
    if (mode.value !== "narration") return undefined;

    if (store.sequenceStatus === "tutorialExplanation") {
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

    return store.storyNarration.textKey
      ? {
          text: t(store.storyNarration.textKey, store.storyNarration.params),
          tone: "neutral",
        }
      : undefined;
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
    if (mode.value !== "tutorial" && mode.value !== "story") return undefined;

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
    if (
      (mode.value !== "tutorial" && mode.value !== "story") ||
      feedback.value
    ) {
      return "";
    }

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

    return "";
  });
  const displayText = computed(() => {
    if (mode.value === "completed") {
      return t("story.acts.act4.story.completionTitle");
    }

    if (mode.value === "periodTransition") return "";

    return narration.value?.text ?? feedback.value?.text ?? subtitle.value;
  });
  const displayTone = computed<Act4InfoCardModel["displayTone"]>(
    () => narration.value?.tone ?? feedback.value?.tone ?? "neutral",
  );
  const model = computed<Act4InfoCardModel>(() => ({
    mode: mode.value,
    displayText: displayText.value,
    displayTone: displayTone.value,
    seasonLabel: currentSeasonLabel.value,
    movementPercentLabel: activeMovementPercentLabel.value,
    periodLabel: periodLabel.value,
    temperature: {
      valueLabel: temperatureLabel.value,
      baselineLabel: baselinePeriodLabel.value,
      contextLabel: activeClimateStep.value?.isBaseline
        ? t("story.acts.act4.infoCard.seasonalMean")
        : "",
      isBaseline: activeClimateStep.value?.isBaseline ?? false,
    },
    narration: narration.value,
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
