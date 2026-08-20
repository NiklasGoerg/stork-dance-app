import type { MigrationActNarrationCueRole } from "~/types/migrationAct";
import type { StorkMigrationEvent, StorkMigrationPhase } from "~/types/stork";

export type MigrationChangeFlowCycleKey =
  "2013_2014" | "2016_2017" | "2018_2019" | "2020_2021" | "2022_2023";

export type MigrationChangeFlowCueRef = {
  cueId: string;
  role: MigrationActNarrationCueRole;
};

export type MigrationChangeFlowResidenceCue = MigrationChangeFlowCueRef & {
  phase: Extract<StorkMigrationPhase, "summer_rest" | "winter_rest">;
};

export type MigrationChangeFlowEventCue = MigrationChangeFlowCueRef & {
  eventType: StorkMigrationEvent;
};

export type MigrationChangeFlowArrivalCueGroup = {
  eventType: Extract<StorkMigrationEvent, "autumn_arrival" | "spring_arrival">;
  reflectionCues: readonly MigrationChangeFlowCueRef[];
};

export type MigrationChangeFlowCycle = {
  key: MigrationChangeFlowCycleKey;
  cycleId: string;
  targetYear: number;
  cycleIntroCue: MigrationChangeFlowCueRef;
  residenceTimingCues: readonly MigrationChangeFlowResidenceCue[];
  departureCues: readonly MigrationChangeFlowEventCue[];
  arrivalCueGroups: readonly MigrationChangeFlowArrivalCueGroup[];
  transitionCue: MigrationChangeFlowCueRef | null;
};

export type MigrationChangeFlowDefinition = {
  publicActId: "act-3";
  introCues: readonly MigrationChangeFlowCueRef[];
  cycles: readonly MigrationChangeFlowCycle[];
  completionCues: readonly MigrationChangeFlowCueRef[];
};

const storyCue = (
  cueId: string,
  role: MigrationActNarrationCueRole,
): MigrationChangeFlowCueRef => ({
  cueId,
  role,
});

const cycleCue = (
  cycleKey: MigrationChangeFlowCycleKey,
  cueKey: string,
  role: MigrationActNarrationCueRole,
) => storyCue(`act3.story.${cycleKey}.${cueKey}`, role);

const transitionCue = (cycleKey: MigrationChangeFlowCycleKey) =>
  storyCue(`act3.story.transition.${cycleKey}`, "cycleTransition");

const completionCue = (cueKey: string) =>
  storyCue(`act3.story.completed.${cueKey}`, "actCompletion");

const cycle = (
  key: MigrationChangeFlowCycleKey,
  cycleId: string,
  targetYear: number,
  options: {
    winterReflections?: number;
    breedingReflections?: number;
    transition?: boolean;
  } = {},
): MigrationChangeFlowCycle => {
  const winterReflectionCount = options.winterReflections ?? 1;
  const breedingReflectionCount = options.breedingReflections ?? 1;

  return {
    key,
    cycleId,
    targetYear,
    cycleIntroCue: cycleCue(key, "intro", "cycleIntro"),
    residenceTimingCues: [
      {
        ...cycleCue(key, "summerTiming", "summerTiming"),
        phase: "summer_rest",
      },
      {
        ...cycleCue(key, "winterTiming", "winterTiming"),
        phase: "winter_rest",
      },
    ],
    departureCues: [
      {
        ...cycleCue(key, "autumnPrepare", "autumnPrepare"),
        eventType: "autumn_departure",
      },
      {
        ...cycleCue(key, "springPrepare", "springPrepare"),
        eventType: "spring_departure",
      },
    ],
    arrivalCueGroups: [
      {
        eventType: "autumn_arrival",
        reflectionCues: Array.from(
          { length: winterReflectionCount },
          (_, index) =>
            cycleCue(key, `winterReflection${index + 1}`, "winterReflection"),
        ),
      },
      {
        eventType: "spring_arrival",
        reflectionCues: Array.from(
          { length: breedingReflectionCount },
          (_, index) =>
            cycleCue(
              key,
              `breedingReflection${index + 1}`,
              "breedingReflection",
            ),
        ),
      },
    ],
    transitionCue: options.transition ? transitionCue(key) : null,
  };
};

export const migrationChangeFlow = {
  publicActId: "act-3",
  introCues: [
    storyCue("act3.story.intro.part1", "actIntro"),
    storyCue("act3.story.intro.part2", "actIntro"),
  ],
  cycles: [
    cycle("2013_2014", "individual_3031_2013_2014", 2013),
    cycle("2016_2017", "individual_3339_2016_2017", 2016, {
      transition: true,
    }),
    cycle("2018_2019", "individual_3042_2018_2019", 2018, {
      winterReflections: 2,
      transition: true,
    }),
    cycle("2020_2021", "individual_3042_2020_2021", 2020, {
      winterReflections: 2,
      breedingReflections: 2,
      transition: true,
    }),
    cycle("2022_2023", "individual_4004_2022_2023", 2022, {
      breedingReflections: 2,
      transition: true,
    }),
  ],
  completionCues: [
    completionCue("structure"),
    completionCue("pattern"),
    completionCue("qualification"),
    completionCue("climateTransition"),
  ],
} as const satisfies MigrationChangeFlowDefinition;

export const getMigrationChangeFlowCueRefs = (
  flow: MigrationChangeFlowDefinition = migrationChangeFlow,
) => [
  ...flow.introCues,
  ...flow.cycles.flatMap((cycleRun) => [
    cycleRun.cycleIntroCue,
    ...cycleRun.residenceTimingCues,
    ...cycleRun.departureCues,
    ...cycleRun.arrivalCueGroups.flatMap((group) => group.reflectionCues),
    ...(cycleRun.transitionCue ? [cycleRun.transitionCue] : []),
  ]),
  ...flow.completionCues,
];

export const getMigrationChangeFlowCueIds = (
  flow: MigrationChangeFlowDefinition = migrationChangeFlow,
) => getMigrationChangeFlowCueRefs(flow).map((cue) => cue.cueId);

export const getMigrationChangeFlowCycleByCycleId = (
  cycleId: string,
  flow: MigrationChangeFlowDefinition = migrationChangeFlow,
) => flow.cycles.find((cycleRun) => cycleRun.cycleId === cycleId) ?? null;

export const getMigrationChangeFlowIntroCueIds = (
  flow: MigrationChangeFlowDefinition = migrationChangeFlow,
) => flow.introCues.map((cue) => cue.cueId);

export const getMigrationChangeFlowCompletionCueIds = (
  flow: MigrationChangeFlowDefinition = migrationChangeFlow,
) => flow.completionCues.map((cue) => cue.cueId);

export const getMigrationChangeFlowCycleIntroCueId = (
  cycleId: string,
  flow: MigrationChangeFlowDefinition = migrationChangeFlow,
) =>
  getMigrationChangeFlowCycleByCycleId(cycleId, flow)?.cycleIntroCue.cueId ??
  null;

export const getMigrationChangeFlowTransitionCueId = (
  cycleId: string,
  flow: MigrationChangeFlowDefinition = migrationChangeFlow,
) =>
  getMigrationChangeFlowCycleByCycleId(cycleId, flow)?.transitionCue?.cueId ??
  null;

export const getMigrationChangeFlowDepartureCueId = (
  cycleId: string,
  eventType: StorkMigrationEvent,
  flow: MigrationChangeFlowDefinition = migrationChangeFlow,
) =>
  getMigrationChangeFlowCycleByCycleId(cycleId, flow)?.departureCues.find(
    (cue) => cue.eventType === eventType,
  )?.cueId ?? null;

export const getMigrationChangeFlowArrivalCueIds = (
  cycleId: string,
  eventType: StorkMigrationEvent,
  flow: MigrationChangeFlowDefinition = migrationChangeFlow,
) =>
  getMigrationChangeFlowCycleByCycleId(cycleId, flow)
    ?.arrivalCueGroups.find((group) => group.eventType === eventType)
    ?.reflectionCues.map((cue) => cue.cueId) ?? [];
