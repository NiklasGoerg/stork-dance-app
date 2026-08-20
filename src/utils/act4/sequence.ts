import type {
  ClimateMovementFlowStep,
  ClimateSeason,
  ClimateSeasonDataset,
} from "~/types/climate";
import { resolveClimateMovementStep } from "~/utils/movement/acts/climate/climateSeasonData";
import { AUTUMN_MOVEMENT_REFERENCE } from "~/utils/movement/acts/climate/autumn/autumnReference";
import { SPRING_MOVEMENT_REFERENCE } from "~/utils/movement/acts/climate/spring/springReference";
import { SUMMER_MOVEMENT_REFERENCE } from "~/utils/movement/acts/climate/summer/summerReference";
import { WINTER_MOVEMENT_REFERENCE } from "~/utils/movement/acts/climate/winter/winterReference";
import { climateChangeFlow } from "~/story/acts/climateChangeFlow";
import type {
  Act4SequenceTarget,
  Act4TutorialTarget,
  MovementAttemptRules,
  MovementEncodingDefinition,
} from "~/types/act4";

export const ACT4_SEASON_ORDER = climateChangeFlow.seasonOrder;

export const ACT4_TUTORIAL_RULES: MovementAttemptRules = {
  measuresPerStep: 4,
  requiredSuccessfulMeasures: 2,
  retryUntilSuccess: true,
  feedbackInterludeBeats: 4,
};

export const ACT4_STORY_RULES: MovementAttemptRules = {
  measuresPerStep: 4,
  requiredSuccessfulMeasures: 2,
  retryUntilSuccess: true,
  feedbackInterludeBeats: 4,
};

export const ACT4_SEASON_THEMES: Record<
  ClimateSeason,
  { background: string; surface: string }
> = {
  summer: {
    background: "var(--act4-season-summer-background)",
    surface: "var(--act4-season-summer-surface)",
  },
  autumn: {
    background: "var(--act4-season-autumn-background)",
    surface: "var(--act4-season-autumn-surface)",
  },
  winter: {
    background: "var(--act4-season-winter-background)",
    surface: "var(--act4-season-winter-surface)",
  },
  spring: {
    background: "var(--act4-season-spring-background)",
    surface: "var(--act4-season-spring-surface)",
  },
};

export const ACT4_PERIOD_TRANSITION_THEME = {
  background: "var(--act4-season-transition-background)",
  surface: "var(--act4-season-transition-surface)",
};

export const ACT4_SEASON_ENCODING: Record<
  ClimateSeason,
  MovementEncodingDefinition
> = {
  summer: {
    id: "circleRadius",
    tutorialTitleKey: "story.acts.act4.tutorial.summer.title",
    tutorialExplanationKey: "story.acts.act4.tutorial.summer.explanation",
    maximumExplanationKey: "story.acts.act4.tutorial.summer.maximum",
    minimumExplanationKey: "story.acts.act4.tutorial.summer.minimum",
    actionNounKey: "story.acts.act4.tutorial.summer.actionNoun",
  },
  autumn: {
    id: "horizontalArcExtent",
    tutorialTitleKey: "story.acts.act4.tutorial.autumn.title",
    tutorialExplanationKey: "story.acts.act4.tutorial.autumn.explanation",
    maximumExplanationKey: "story.acts.act4.tutorial.autumn.maximum",
    minimumExplanationKey: "story.acts.act4.tutorial.autumn.minimum",
    actionNounKey: "story.acts.act4.tutorial.autumn.actionNoun",
  },
  winter: {
    id: "bodyHeight",
    tutorialTitleKey: "story.acts.act4.tutorial.winter.title",
    tutorialExplanationKey: "story.acts.act4.tutorial.winter.explanation",
    maximumExplanationKey: "story.acts.act4.tutorial.winter.maximum",
    minimumExplanationKey: "story.acts.act4.tutorial.winter.minimum",
    actionNounKey: "story.acts.act4.tutorial.winter.actionNoun",
  },
  spring: {
    id: "verticalArcExtent",
    tutorialTitleKey: "story.acts.act4.tutorial.spring.title",
    tutorialExplanationKey: "story.acts.act4.tutorial.spring.explanation",
    maximumExplanationKey: "story.acts.act4.tutorial.spring.maximum",
    minimumExplanationKey: "story.acts.act4.tutorial.spring.minimum",
    actionNounKey: "story.acts.act4.tutorial.spring.actionNoun",
  },
};

const supportedMovementValues: Record<ClimateSeason, readonly number[]> = {
  summer: Object.keys(SUMMER_MOVEMENT_REFERENCE).map(Number),
  autumn: Object.keys(AUTUMN_MOVEMENT_REFERENCE).map(Number),
  winter: Object.keys(WINTER_MOVEMENT_REFERENCE).map(Number),
  spring: Object.keys(SPRING_MOVEMENT_REFERENCE).map(Number),
};

export const getAct4SupportedMovementValues = (season: ClimateSeason) =>
  supportedMovementValues[season];

export const resolveMinimumMovementValue = (season: ClimateSeason) => {
  const values = supportedMovementValues[season].filter((value) => value !== 0);

  return Math.min(...values);
};

export const createAct4TargetKey = ({
  context,
  season,
  movementValue,
  interval,
}: {
  context: Act4SequenceTarget["context"];
  season: ClimateSeason;
  movementValue: number;
  interval?: string;
}) => [context, interval, season, movementValue].filter(Boolean).join("-");

const createTutorialTarget = (
  season: ClimateSeason,
  movementValue: number,
  target: Act4TutorialTarget,
): Act4SequenceTarget => ({
  id: createAct4TargetKey({
    context: "tutorial",
    season,
    movementValue,
  }),
  context: "tutorial",
  season,
  movementValue,
  target,
  encoding: ACT4_SEASON_ENCODING[season],
  rules: ACT4_TUTORIAL_RULES,
});

const createStoryTarget = (
  climateData: ClimateMovementFlowStep,
): Act4SequenceTarget => ({
  id: createAct4TargetKey({
    context: "climateStory",
    interval: climateData.interval,
    season: climateData.season,
    movementValue: climateData.movementValue,
  }),
  context: "climateStory",
  season: climateData.season,
  movementValue: climateData.movementValue,
  interval: climateData.interval,
  climateData,
  encoding: ACT4_SEASON_ENCODING[climateData.season],
  rules: ACT4_STORY_RULES,
});

export const buildAct4TutorialSequence = (): Act4SequenceTarget[] =>
  climateChangeFlow.tutorialTargets.map(({ season, target }) =>
    createTutorialTarget(
      season,
      target === "example"
        ? 20
        : target === "maximum"
          ? 100
          : resolveMinimumMovementValue(season),
      target,
    ),
  );

export const buildAct4ClimateStorySequence = (
  dataset: ClimateSeasonDataset,
): Act4SequenceTarget[] => {
  const intervals = [...new Set(dataset.rows.map((row) => row.intervalOrder))]
    .map((intervalOrder) => ({
      intervalOrder,
      rows: dataset.rows.filter((row) => row.intervalOrder === intervalOrder),
    }))
    .sort((a, b) => a.intervalOrder - b.intervalOrder);

  return intervals.flatMap(({ rows }) =>
    ACT4_SEASON_ORDER.flatMap((season) => {
      const row = rows.find((item) => item.season === season);
      const climateData = row ? resolveClimateMovementStep(row) : null;

      return climateData ? [createStoryTarget(climateData)] : [];
    }),
  );
};

export const buildAct4FullSequence = (
  dataset: ClimateSeasonDataset,
): Act4SequenceTarget[] => [
  ...buildAct4TutorialSequence(),
  ...buildAct4ClimateStorySequence(dataset),
];

export const buildAct4TutorialDebugSequence = (): Act4SequenceTarget[] => [
  ...buildAct4TutorialSequence(),
];

export const buildAct4DebugSingleSeasonSequence = (
  season: ClimateSeason,
): Act4SequenceTarget[] => [createTutorialTarget(season, 100, "maximum")];

export const buildAct4DebugSeasonValueSequence = (
  season: ClimateSeason,
): Act4SequenceTarget[] =>
  getAct4SupportedMovementValues(season).map((movementValue) =>
    createTutorialTarget(season, movementValue, "maximum"),
  );

export const act4MovementTutorialFlow = buildAct4TutorialSequence();
