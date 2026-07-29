import type {
  ClimateMovementFlowStep,
  ClimateSeason,
  ClimateSeasonDataset,
} from "~/utils/movement/acts/climate/climateSeasonData";
import { resolveClimateMovementStep } from "~/utils/movement/acts/climate/climateSeasonData";
import { AUTUMN_MOVEMENT_REFERENCE } from "~/utils/movement/acts/climate/autumn/autumnReference";
import { SPRING_MOVEMENT_REFERENCE } from "~/utils/movement/acts/climate/spring/springReference";
import { SUMMER_MOVEMENT_REFERENCE } from "~/utils/movement/acts/climate/summer/summerReference";
import { WINTER_MOVEMENT_REFERENCE } from "~/utils/movement/acts/climate/winter/winterReference";

export type Act5Phase = "tutorial" | "climateStory" | "completed";
export type Act5FlowId = "act5Full" | "act5Story" | "act5TutorialDebug";
export type Act5FlowContext = "tutorial" | "climateStory";
export type Act5TutorialTarget = "maximum" | "minimum";
export type Act5EncodingId =
  "circleRadius" | "horizontalArcExtent" | "bodyHeight" | "verticalArcExtent";

export type MovementAttemptRules = {
  measuresPerStep: number;
  requiredSuccessfulMeasures: number;
  retryUntilSuccess: boolean;
  feedbackInterludeBeats: number;
};

export type MovementEncodingDefinition = {
  id: Act5EncodingId;
  tutorialTitleKey: string;
  tutorialExplanationKey: string;
  maximumExplanationKey: string;
  minimumExplanationKey: string;
  actionNounKey: string;
};

export type Act5SequenceTarget = {
  id: string;
  context: Act5FlowContext;
  season: ClimateSeason;
  movementValue: number;
  target?: Act5TutorialTarget;
  interval?: string;
  climateData?: ClimateMovementFlowStep;
  encoding: MovementEncodingDefinition;
  rules: MovementAttemptRules;
};

export const ACT5_SEASON_ORDER = [
  "winter",
  "spring",
  "summer",
  "autumn",
] as const satisfies readonly ClimateSeason[];

export const ACT5_TUTORIAL_RULES: MovementAttemptRules = {
  measuresPerStep: 4,
  requiredSuccessfulMeasures: 2,
  retryUntilSuccess: true,
  feedbackInterludeBeats: 4,
};

export const ACT5_STORY_RULES: MovementAttemptRules = {
  measuresPerStep: 4,
  requiredSuccessfulMeasures: 2,
  retryUntilSuccess: true,
  feedbackInterludeBeats: 4,
};

export const ACT5_SEASON_THEMES: Record<
  ClimateSeason,
  { background: string; surface: string }
> = {
  summer: {
    background: "var(--act5-season-summer-background)",
    surface: "var(--act5-season-summer-surface)",
  },
  autumn: {
    background: "var(--act5-season-autumn-background)",
    surface: "var(--act5-season-autumn-surface)",
  },
  winter: {
    background: "var(--act5-season-winter-background)",
    surface: "var(--act5-season-winter-surface)",
  },
  spring: {
    background: "var(--act5-season-spring-background)",
    surface: "var(--act5-season-spring-surface)",
  },
};

export const ACT5_PERIOD_TRANSITION_THEME = {
  background: "var(--act5-season-transition-background)",
  surface: "var(--act5-season-transition-surface)",
};

export const ACT5_SEASON_ENCODING: Record<
  ClimateSeason,
  MovementEncodingDefinition
> = {
  summer: {
    id: "circleRadius",
    tutorialTitleKey: "story.acts.act5.tutorial.summer.title",
    tutorialExplanationKey: "story.acts.act5.tutorial.summer.explanation",
    maximumExplanationKey: "story.acts.act5.tutorial.summer.maximum",
    minimumExplanationKey: "story.acts.act5.tutorial.summer.minimum",
    actionNounKey: "story.acts.act5.tutorial.summer.actionNoun",
  },
  autumn: {
    id: "horizontalArcExtent",
    tutorialTitleKey: "story.acts.act5.tutorial.autumn.title",
    tutorialExplanationKey: "story.acts.act5.tutorial.autumn.explanation",
    maximumExplanationKey: "story.acts.act5.tutorial.autumn.maximum",
    minimumExplanationKey: "story.acts.act5.tutorial.autumn.minimum",
    actionNounKey: "story.acts.act5.tutorial.autumn.actionNoun",
  },
  winter: {
    id: "bodyHeight",
    tutorialTitleKey: "story.acts.act5.tutorial.winter.title",
    tutorialExplanationKey: "story.acts.act5.tutorial.winter.explanation",
    maximumExplanationKey: "story.acts.act5.tutorial.winter.maximum",
    minimumExplanationKey: "story.acts.act5.tutorial.winter.minimum",
    actionNounKey: "story.acts.act5.tutorial.winter.actionNoun",
  },
  spring: {
    id: "verticalArcExtent",
    tutorialTitleKey: "story.acts.act5.tutorial.spring.title",
    tutorialExplanationKey: "story.acts.act5.tutorial.spring.explanation",
    maximumExplanationKey: "story.acts.act5.tutorial.spring.maximum",
    minimumExplanationKey: "story.acts.act5.tutorial.spring.minimum",
    actionNounKey: "story.acts.act5.tutorial.spring.actionNoun",
  },
};

const supportedMovementValues: Record<ClimateSeason, readonly number[]> = {
  summer: Object.keys(SUMMER_MOVEMENT_REFERENCE).map(Number),
  autumn: Object.keys(AUTUMN_MOVEMENT_REFERENCE).map(Number),
  winter: Object.keys(WINTER_MOVEMENT_REFERENCE).map(Number),
  spring: Object.keys(SPRING_MOVEMENT_REFERENCE).map(Number),
};

export const resolveMinimumMovementValue = (season: ClimateSeason) => {
  const values = supportedMovementValues[season].filter((value) => value !== 0);

  return Math.min(...values);
};

const createTargetKey = ({
  context,
  season,
  movementValue,
  interval,
}: {
  context: Act5FlowContext;
  season: ClimateSeason;
  movementValue: number;
  interval?: string;
}) => [context, interval, season, movementValue].filter(Boolean).join("-");

const createTutorialTarget = (
  season: ClimateSeason,
  movementValue: number,
  target: Act5TutorialTarget,
): Act5SequenceTarget => ({
  id: createTargetKey({
    context: "tutorial",
    season,
    movementValue,
  }),
  context: "tutorial",
  season,
  movementValue,
  target,
  encoding: ACT5_SEASON_ENCODING[season],
  rules: ACT5_TUTORIAL_RULES,
});

export const buildAct5TutorialFlow = (): Act5SequenceTarget[] => [
  createTutorialTarget("winter", 100, "maximum"),
  createTutorialTarget(
    "winter",
    resolveMinimumMovementValue("winter"),
    "minimum",
  ),
  createTutorialTarget("spring", 100, "maximum"),
  createTutorialTarget(
    "spring",
    resolveMinimumMovementValue("spring"),
    "minimum",
  ),
  createTutorialTarget("summer", 100, "maximum"),
  createTutorialTarget(
    "summer",
    resolveMinimumMovementValue("summer"),
    "minimum",
  ),
  createTutorialTarget("autumn", 100, "maximum"),
  createTutorialTarget(
    "autumn",
    resolveMinimumMovementValue("autumn"),
    "minimum",
  ),
];

export const act5MovementTutorialFlow = buildAct5TutorialFlow();

const createStoryTarget = (
  climateData: ClimateMovementFlowStep,
): Act5SequenceTarget => ({
  id: createTargetKey({
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
  encoding: ACT5_SEASON_ENCODING[climateData.season],
  rules: ACT5_STORY_RULES,
});

export const buildAct5ClimateStoryFlow = (
  dataset: ClimateSeasonDataset,
): Act5SequenceTarget[] => {
  const intervals = [...new Set(dataset.rows.map((row) => row.intervalOrder))]
    .map((intervalOrder) => ({
      intervalOrder,
      rows: dataset.rows.filter((row) => row.intervalOrder === intervalOrder),
    }))
    .sort((a, b) => a.intervalOrder - b.intervalOrder);

  return intervals.flatMap(({ rows }) =>
    ACT5_SEASON_ORDER.flatMap((season) => {
      const row = rows.find((item) => item.season === season);
      const climateData = row ? resolveClimateMovementStep(row) : null;

      return climateData ? [createStoryTarget(climateData)] : [];
    }),
  );
};

export const buildAct5FullFlow = (
  dataset: ClimateSeasonDataset,
): Act5SequenceTarget[] => [
  ...act5MovementTutorialFlow,
  ...buildAct5ClimateStoryFlow(dataset),
];

export const buildAct5TutorialDebugFlow = (): Act5SequenceTarget[] => [
  ...act5MovementTutorialFlow,
];
