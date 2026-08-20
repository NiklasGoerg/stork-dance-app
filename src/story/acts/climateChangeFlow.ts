import type { Act4FlowId, Act4TutorialTarget } from "~/types/act4";
import type { ClimateSeason } from "~/types/climate";

export type ClimateChangeFlowPeriodId =
  | "reference"
  | "2000_2004"
  | "2005_2009"
  | "2010_2014"
  | "2015_2019"
  | "2020_2024";

export type ClimateChangeFlowCueRef = {
  cueId: string;
};

export type ClimateChangeFlowStoryPeriod = {
  id: ClimateChangeFlowPeriodId;
  interval: string;
  reference: boolean;
};

export type ClimateChangeFlowTutorialTarget = {
  season: ClimateSeason;
  target: Act4TutorialTarget;
};

export type ClimateChangeFlowDefinition = {
  publicActId: "act-4";
  flows: {
    full: Act4FlowId;
    storyOnly: Act4FlowId;
    tutorialDebug: Act4FlowId;
  };
  seasonOrder: readonly ClimateSeason[];
  tutorialIntroCues: readonly ClimateChangeFlowCueRef[];
  tutorialTargets: readonly ClimateChangeFlowTutorialTarget[];
  storyIntroCues: readonly ClimateChangeFlowCueRef[];
  storyPeriods: readonly ClimateChangeFlowStoryPeriod[];
  referenceCompletionCues: readonly ClimateChangeFlowCueRef[];
  periodTransitionCues: readonly ClimateChangeFlowCueRef[];
  completionCues: readonly ClimateChangeFlowCueRef[];
};

const cue = (cueId: string): ClimateChangeFlowCueRef => ({ cueId });

export const climateChangeFlow = {
  publicActId: "act-4",
  flows: {
    full: "act4Full",
    storyOnly: "act4Story",
    tutorialDebug: "act4TutorialDebug",
  },
  seasonOrder: ["winter", "spring", "summer", "autumn"],
  tutorialIntroCues: [
    cue("act4.tutorial.intro.context"),
    cue("act4.tutorial.intro.encoding"),
    cue("act4.tutorial.intro.scale"),
    cue("act4.tutorial.intro.range"),
    cue("act4.tutorial.intro.measureLength"),
    cue("act4.tutorial.intro.watchThenMove"),
  ],
  tutorialTargets: [
    { season: "winter", target: "example" },
    { season: "winter", target: "maximum" },
    { season: "winter", target: "minimum" },
    { season: "spring", target: "maximum" },
    { season: "spring", target: "minimum" },
    { season: "summer", target: "maximum" },
    { season: "summer", target: "minimum" },
    { season: "autumn", target: "maximum" },
    { season: "autumn", target: "minimum" },
  ],
  storyIntroCues: [
    cue("act4.story.intro.chart"),
    cue("act4.story.intro.reference"),
  ],
  storyPeriods: [
    { id: "reference", interval: "1995-1999", reference: true },
    { id: "2000_2004", interval: "2000-2004", reference: false },
    { id: "2005_2009", interval: "2005-2009", reference: false },
    { id: "2010_2014", interval: "2010-2014", reference: false },
    { id: "2015_2019", interval: "2015-2019", reference: false },
    { id: "2020_2024", interval: "2020-2024", reference: false },
  ],
  referenceCompletionCues: [
    cue("act4.story.reference.complete"),
    cue("act4.story.reference.scale"),
  ],
  periodTransitionCues: [
    cue("act4.story.transition.2000_2004"),
    cue("act4.story.transition.2005_2009"),
    cue("act4.story.transition.2010_2014"),
    cue("act4.story.transition.2015_2019"),
  ],
  completionCues: [
    cue("act4.story.completed.embodied"),
    cue("act4.story.completed.seasons"),
    cue("act4.story.completed.maximum"),
    cue("act4.story.completed.migration"),
  ],
} as const satisfies ClimateChangeFlowDefinition;

export const getClimateChangeFlowPeriodByInterval = (
  interval: string,
  flow: ClimateChangeFlowDefinition = climateChangeFlow,
) => flow.storyPeriods.find((period) => period.interval === interval) ?? null;

export const getClimateChangeFlowPeriodById = (
  periodId: ClimateChangeFlowPeriodId,
  flow: ClimateChangeFlowDefinition = climateChangeFlow,
) => flow.storyPeriods.find((period) => period.id === periodId) ?? null;

export const getClimateChangeFlowStoryTargetCueId = (
  periodId: ClimateChangeFlowPeriodId,
  season: ClimateSeason,
) =>
  periodId === "reference"
    ? `act4.story.reference.${season}`
    : `act4.story.${periodId}.${season}`;

export const getClimateChangeFlowStoryTargetCueIds = (
  flow: ClimateChangeFlowDefinition = climateChangeFlow,
) =>
  flow.storyPeriods.flatMap((period) =>
    flow.seasonOrder.map((season) =>
      getClimateChangeFlowStoryTargetCueId(period.id, season),
    ),
  );

export const getClimateChangeFlowStoryPeriodTransitionCueId = (
  completedPeriodId: ClimateChangeFlowPeriodId,
) => {
  if (completedPeriodId === "reference" || completedPeriodId === "2020_2024") {
    return null;
  }

  return `act4.story.transition.${completedPeriodId}`;
};

export const getClimateChangeFlowTutorialTargetCueId = (
  season: ClimateSeason,
  target: Act4TutorialTarget,
) => `act4.tutorial.${season}.${target}`;

export const getClimateChangeFlowTutorialEncodingCueId = (
  season: ClimateSeason,
) => `act4.tutorial.${season}.encoding`;

export const getClimateChangeFlowTutorialSeasonCompletionCueId = (
  season: ClimateSeason,
) => `act4.tutorial.${season}.complete`;

export const getClimateChangeFlowStoryCueIds = (
  flow: ClimateChangeFlowDefinition = climateChangeFlow,
) => [
  ...flow.storyIntroCues.map((item) => item.cueId),
  ...getClimateChangeFlowStoryTargetCueIds(flow),
  ...flow.referenceCompletionCues.map((item) => item.cueId),
  ...flow.periodTransitionCues.map((item) => item.cueId),
  ...flow.completionCues.map((item) => item.cueId),
];

export const getClimateChangeFlowTutorialCueIds = (
  flow: ClimateChangeFlowDefinition = climateChangeFlow,
) => [
  ...flow.tutorialIntroCues.map((item) => item.cueId),
  ...flow.tutorialTargets.flatMap(({ season, target }) => [
    ...(target === "example" || (target === "maximum" && season !== "winter")
      ? [getClimateChangeFlowTutorialEncodingCueId(season)]
      : []),
    getClimateChangeFlowTutorialTargetCueId(season, target),
    ...(target === "minimum"
      ? [getClimateChangeFlowTutorialSeasonCompletionCueId(season)]
      : []),
  ]),
  "act4.tutorial.complete",
];
