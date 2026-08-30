import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAct4InfoCardModel } from "~/composables/act4/useAct4InfoCardModel";
import type { Act4Recognition } from "~/composables/act4/useAct4Recognition";
import { useAct4Store } from "~/store/act4";
import { act4IntroCycleConfig } from "~/story/act4IntroCycle";
import type { Act4SequenceTarget } from "~/types/act4";
import type { ClimateMovementFlowStep, ClimateSeason } from "~/types/climate";
import { ACT4_SEASON_ENCODING, ACT4_STORY_RULES } from "~/utils/act4/sequence";
import type { SeasonalCyclePlaybackState } from "~/utils/seasonalCycle";

const translate = (key: string, params: Record<string, string | number> = {}) =>
  Object.entries(params).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    key,
  );

vi.mock("~/composables/useStoryTranslations", () => ({
  useStoryTranslations: () => ({ t: translate }),
}));

vi.mock("#imports", () => ({
  useI18n: () => ({ t: translate }),
}));

const seasonConfig =
  act4IntroCycleConfig.seasons.find((season) => season.id === "winter") ??
  act4IntroCycleConfig.seasons[0]!;

const createClimateStep = ({
  interval,
  displayValue,
  displayValueType,
  movementValue,
  isBaseline,
}: {
  interval: string;
  displayValue: number;
  displayValueType: ClimateMovementFlowStep["displayValueType"];
  movementValue: number;
  isBaseline: boolean;
}): ClimateMovementFlowStep => ({
  id: `winter-${interval}`,
  movementDefinitionId: "winter",
  sourceRow: {
    intervalOrder: 1,
    interval,
    intervalStart: Number(interval.slice(0, 4)),
    intervalEnd: Number(interval.slice(5)),
    seasonOrder: 1,
    season: "winter",
    absoluteValue: displayValue,
    displayValue,
    displayValueType,
    displayUnit: "degC",
    normalizedValue: 0,
    movementPercent: movementValue,
    isBaseline,
  },
  season: "winter",
  intervalOrder: 1,
  interval,
  intervalStart: Number(interval.slice(0, 4)),
  intervalEnd: Number(interval.slice(5)),
  movementValue,
  resolutionReason: isBaseline ? "baseline-reference" : "movement-percent",
  absoluteValue: displayValue,
  displayValue,
  displayValueType,
  displayUnit: "degC",
  normalizedValue: 0,
  rawMovementPercent: movementValue,
  isBaseline,
});

const baselineStep = createClimateStep({
  interval: "1995-1999",
  displayValue: 0.9,
  displayValueType: "absolute_temperature",
  movementValue: 100,
  isBaseline: true,
});

const comparisonStep = createClimateStep({
  interval: "2000-2004",
  displayValue: 0.55,
  displayValueType: "difference_from_1995_1999",
  movementValue: 20,
  isBaseline: false,
});

const createTarget = (
  context: Act4SequenceTarget["context"],
  climateData?: ClimateMovementFlowStep,
): Act4SequenceTarget => ({
  id: `${context}-winter`,
  context,
  season: "winter",
  movementValue: climateData?.movementValue ?? 100,
  interval: climateData?.interval,
  climateData,
  encoding: ACT4_SEASON_ENCODING.winter,
  rules: ACT4_STORY_RULES,
});

const recognition = {
  cycleEvaluations: ref([]),
  feedbackCode: ref(null),
} as unknown as Act4Recognition;

const createModel = () =>
  useAct4InfoCardModel({
    cycle: {
      currentSeason: ref(seasonConfig),
      currentBeat: ref(4),
      countdownRemaining: ref(0),
      playbackState: ref<SeasonalCyclePlaybackState>("playing"),
      repetitionIndex: ref(0),
      seasonElapsedMs: ref(0),
      seasonPhase: ref<"preview" | "performance" | "transition">("performance"),
      isCountingDown: ref(false),
      isCompleted: ref(false),
      isTransition: ref(false),
    },
    recognition,
    climateDataError: ref(""),
    getSeasonBaselineStep: (season: ClimateSeason) =>
      season === "winter" ? baselineStep : null,
  });

describe("useAct4InfoCardModel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("maps tutorial explanation to narration mode", () => {
    const store = useAct4Store();
    store.startFlow("act4Full", [createTarget("tutorial")]);
    store.enterTutorialExplanation({
      targetIndex: 0,
      cueId: "tutorial",
      textKey: "story.acts.act4.tutorial.winter.explanation",
    });

    const { model } = createModel();

    expect(model.value.mode).toBe("narration");
    expect(model.value.narration?.text).toBe(
      "story.acts.act4.tutorial.winter.explanation",
    );
    expect("instructions" in model.value).toBe(false);
  });

  it("maps tutorial practice to tutorial mode without movement instructions", () => {
    const store = useAct4Store();
    store.startFlow("act4Full", [createTarget("tutorial")]);
    store.startTarget(0);

    const { model } = createModel();

    expect(model.value.mode).toBe("tutorial");
    expect(model.value.periodLabel).toBe(
      "story.acts.act4.tutorial.general.title",
    );
    expect(model.value.feedback).toBeUndefined();
    expect("instructions" in model.value).toBe(false);
  });

  it("maps story narration statuses to narration mode", () => {
    const store = useAct4Store();
    store.startFlow("act4Story", [createTarget("climateStory", baselineStep)]);
    store.enterStoryNarration({
      phase: "story-intro",
      status: "storyIntro",
      targetIndex: 0,
      cueId: "intro",
      textKey: "story.acts.act4.story.intro.title",
    });

    const { model } = createModel();

    expect(model.value.mode).toBe("narration");
    expect(model.value.displayText).toBe("story.acts.act4.story.intro.title");
  });

  it("keeps reference and comparison story targets in story mode", () => {
    const store = useAct4Store();
    store.startFlow("act4Story", [
      createTarget("climateStory", baselineStep),
      createTarget("climateStory", comparisonStep),
    ]);

    store.startTarget(0);
    const baselineModel = createModel().model;
    expect(baselineModel.value.mode).toBe("story");
    expect(baselineModel.value.temperature.valueLabel).toBe("0.90 °C");
    expect(baselineModel.value.temperature.contextLabel).toBe(
      "story.acts.act4.infoCard.seasonalMean",
    );

    store.startTarget(1);
    const comparisonModel = createModel().model;
    expect(comparisonModel.value.mode).toBe("story");
    expect(comparisonModel.value.periodLabel).toBe("2000-2004");
    expect(comparisonModel.value.temperature.valueLabel).toBe("+0.55 °C");
    expect(comparisonModel.value.temperature.baselineLabel).toBe("1995-1999");
  });

  it("keeps period transition and completion as dedicated modes", () => {
    const store = useAct4Store();
    store.startFlow("act4Story", [createTarget("climateStory", baselineStep)]);
    store.enterPeriodTransition({
      previousPeriod: "1995-1999",
      nextPeriod: "2000-2004",
    });

    const transitionModel = createModel().model;
    expect(transitionModel.value.mode).toBe("periodTransition");
    expect(transitionModel.value.periodTransition?.nextPeriod).toBe(
      "2000-2004",
    );

    store.completeFlow();
    const completedModel = createModel().model;
    expect(completedModel.value.mode).toBe("completed");
  });
});
