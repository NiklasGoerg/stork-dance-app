import type {
  MigrationActCycleRun,
  MigrationActNarrationCueRole,
} from "~/types/migrationAct";
import type { StorkMigrationEvent } from "~/types/stork";
import { createMigrationActEvents } from "~/utils/migrationActs/events";
import {
  buildPreparedStoryTimeline,
  STORY_CYCLE_DURATION_MS,
} from "~/utils/storyCycle";
import {
  getMigrationStoryCyclePoints,
  migrationStoryCycleDefinitions,
} from "~/utils/migrationStoryData";

export type MigrationActStoryCycleKey =
  "2013_2014" | "2016_2017" | "2018_2019" | "2020_2021" | "2022_2023";

export type MigrationActStoryCycleCueKey =
  | "intro"
  | "summerTiming"
  | "autumnPrepare"
  | "winterReflection1"
  | "winterReflection2"
  | "winterTiming"
  | "springPrepare"
  | "breedingReflection1"
  | "breedingReflection2";

export type MigrationActStoryTransitionCueKey =
  "2016_2017" | "2018_2019" | "2020_2021" | "2022_2023";

export type MigrationActStoryCompletionCueKey =
  "structure" | "pattern" | "qualification" | "question" | "climateTransition";

export type MigrationActStoryNarrationCue = {
  id: string;
  textKey: string;
  role: MigrationActNarrationCueRole;
  speak: boolean;
  display: boolean;
  priority: number;
};

export type MigrationNarrationTimingAuditRow = {
  cycle: string;
  cycleId: string;
  migration: "Autumn" | "Spring";
  realStart: string;
  realEnd: string;
  realDurationDays: number;
  experienceStartSecond: number;
  experienceEndSecond: number;
  experienceDurationSecondsExact: number;
  experienceDurationSecondsSpoken: number;
};

export type MigrationActScheduledResidenceNarrationCue = {
  cueId: MigrationActStoryNarrationCueId;
  cycle: string;
  cycleId: string;
  phase: "summer_rest" | "winter_rest";
  triggerElapsedMs: number;
  triggerSecond: number;
  nextEventType: StorkMigrationEvent;
  nextEventSecond: number;
  nextCountdownStartSecond: number;
  quietSecondsAfterPrimaryCue: number | null;
  availableSecondsBeforeCountdown: number;
  textKey: string;
};

const cycleKeyByCycleId: Record<string, MigrationActStoryCycleKey> = {
  individual_3031_2013_2014: "2013_2014",
  individual_3339_2016_2017: "2016_2017",
  individual_3042_2018_2019: "2018_2019",
  individual_3042_2020_2021: "2020_2021",
  individual_4004_2022_2023: "2022_2023",
};

const cycleCue = (
  cycleKey: MigrationActStoryCycleKey,
  cueKey: MigrationActStoryCycleCueKey,
  role: MigrationActNarrationCueRole,
): MigrationActStoryNarrationCue => {
  const id =
    `act4.story.${cycleKey}.${cueKey}` as MigrationActStoryNarrationCueId;

  return {
    id,
    textKey: `story.acts.act4.narration.cycles.${cycleKey}.${cueKey}`,
    role,
    speak: true,
    display: true,
    priority: role === "autumnPrepare" || role === "springPrepare" ? 65 : 50,
  };
};

const completionCue = (
  cueKey: MigrationActStoryCompletionCueKey,
): MigrationActStoryNarrationCue => {
  const id =
    `act4.story.completed.${cueKey}` as MigrationActStoryNarrationCueId;

  return {
    id,
    textKey: `story.acts.act4.narration.completed.${cueKey}`,
    role: "actCompletion",
    speak: true,
    display: true,
    priority: 55,
  };
};

const transitionCue = (
  cueKey: MigrationActStoryTransitionCueKey,
): MigrationActStoryNarrationCue => {
  const id =
    `act4.story.transition.${cueKey}` as MigrationActStoryNarrationCueId;

  return {
    id,
    textKey: `story.acts.act4.narration.transitions.${cueKey}`,
    role: "cycleTransition",
    speak: true,
    display: true,
    priority: 55,
  };
};

export const migrationActStoryNarrationCatalog = {
  "act4.story.intro.part1": {
    id: "act4.story.intro.part1",
    textKey: "story.acts.act4.narration.intro.part1",
    role: "actIntro",
    speak: true,
    display: true,
    priority: 55,
  },
  "act4.story.intro.part2": {
    id: "act4.story.intro.part2",
    textKey: "story.acts.act4.narration.intro.part2",
    role: "actIntro",
    speak: true,
    display: true,
    priority: 55,
  },
  "act4.story.2013_2014.intro": cycleCue("2013_2014", "intro", "cycleIntro"),
  "act4.story.2013_2014.summerTiming": cycleCue(
    "2013_2014",
    "summerTiming",
    "summerTiming",
  ),
  "act4.story.2013_2014.autumnPrepare": cycleCue(
    "2013_2014",
    "autumnPrepare",
    "autumnPrepare",
  ),
  "act4.story.2013_2014.winterReflection1": cycleCue(
    "2013_2014",
    "winterReflection1",
    "winterReflection",
  ),
  "act4.story.2013_2014.winterTiming": cycleCue(
    "2013_2014",
    "winterTiming",
    "winterTiming",
  ),
  "act4.story.2013_2014.springPrepare": cycleCue(
    "2013_2014",
    "springPrepare",
    "springPrepare",
  ),
  "act4.story.2013_2014.breedingReflection1": cycleCue(
    "2013_2014",
    "breedingReflection1",
    "breedingReflection",
  ),
  "act4.story.2016_2017.intro": cycleCue("2016_2017", "intro", "cycleIntro"),
  "act4.story.2016_2017.summerTiming": cycleCue(
    "2016_2017",
    "summerTiming",
    "summerTiming",
  ),
  "act4.story.2016_2017.autumnPrepare": cycleCue(
    "2016_2017",
    "autumnPrepare",
    "autumnPrepare",
  ),
  "act4.story.2016_2017.winterReflection1": cycleCue(
    "2016_2017",
    "winterReflection1",
    "winterReflection",
  ),
  "act4.story.2016_2017.winterTiming": cycleCue(
    "2016_2017",
    "winterTiming",
    "winterTiming",
  ),
  "act4.story.2016_2017.springPrepare": cycleCue(
    "2016_2017",
    "springPrepare",
    "springPrepare",
  ),
  "act4.story.2016_2017.breedingReflection1": cycleCue(
    "2016_2017",
    "breedingReflection1",
    "breedingReflection",
  ),
  "act4.story.2018_2019.intro": cycleCue("2018_2019", "intro", "cycleIntro"),
  "act4.story.2018_2019.summerTiming": cycleCue(
    "2018_2019",
    "summerTiming",
    "summerTiming",
  ),
  "act4.story.2018_2019.autumnPrepare": cycleCue(
    "2018_2019",
    "autumnPrepare",
    "autumnPrepare",
  ),
  "act4.story.2018_2019.winterReflection1": cycleCue(
    "2018_2019",
    "winterReflection1",
    "winterReflection",
  ),
  "act4.story.2018_2019.winterReflection2": cycleCue(
    "2018_2019",
    "winterReflection2",
    "winterReflection",
  ),
  "act4.story.2018_2019.winterTiming": cycleCue(
    "2018_2019",
    "winterTiming",
    "winterTiming",
  ),
  "act4.story.2018_2019.springPrepare": cycleCue(
    "2018_2019",
    "springPrepare",
    "springPrepare",
  ),
  "act4.story.2018_2019.breedingReflection1": cycleCue(
    "2018_2019",
    "breedingReflection1",
    "breedingReflection",
  ),
  "act4.story.2020_2021.intro": cycleCue("2020_2021", "intro", "cycleIntro"),
  "act4.story.2020_2021.summerTiming": cycleCue(
    "2020_2021",
    "summerTiming",
    "summerTiming",
  ),
  "act4.story.2020_2021.autumnPrepare": cycleCue(
    "2020_2021",
    "autumnPrepare",
    "autumnPrepare",
  ),
  "act4.story.2020_2021.winterReflection1": cycleCue(
    "2020_2021",
    "winterReflection1",
    "winterReflection",
  ),
  "act4.story.2020_2021.winterReflection2": cycleCue(
    "2020_2021",
    "winterReflection2",
    "winterReflection",
  ),
  "act4.story.2020_2021.winterTiming": cycleCue(
    "2020_2021",
    "winterTiming",
    "winterTiming",
  ),
  "act4.story.2020_2021.springPrepare": cycleCue(
    "2020_2021",
    "springPrepare",
    "springPrepare",
  ),
  "act4.story.2020_2021.breedingReflection1": cycleCue(
    "2020_2021",
    "breedingReflection1",
    "breedingReflection",
  ),
  "act4.story.2020_2021.breedingReflection2": cycleCue(
    "2020_2021",
    "breedingReflection2",
    "breedingReflection",
  ),
  "act4.story.2022_2023.intro": cycleCue("2022_2023", "intro", "cycleIntro"),
  "act4.story.2022_2023.summerTiming": cycleCue(
    "2022_2023",
    "summerTiming",
    "summerTiming",
  ),
  "act4.story.2022_2023.autumnPrepare": cycleCue(
    "2022_2023",
    "autumnPrepare",
    "autumnPrepare",
  ),
  "act4.story.2022_2023.winterReflection1": cycleCue(
    "2022_2023",
    "winterReflection1",
    "winterReflection",
  ),
  "act4.story.2022_2023.winterTiming": cycleCue(
    "2022_2023",
    "winterTiming",
    "winterTiming",
  ),
  "act4.story.2022_2023.springPrepare": cycleCue(
    "2022_2023",
    "springPrepare",
    "springPrepare",
  ),
  "act4.story.2022_2023.breedingReflection1": cycleCue(
    "2022_2023",
    "breedingReflection1",
    "breedingReflection",
  ),
  "act4.story.2022_2023.breedingReflection2": cycleCue(
    "2022_2023",
    "breedingReflection2",
    "breedingReflection",
  ),
  "act4.story.transition.2016_2017": transitionCue("2016_2017"),
  "act4.story.transition.2018_2019": transitionCue("2018_2019"),
  "act4.story.transition.2020_2021": transitionCue("2020_2021"),
  "act4.story.transition.2022_2023": transitionCue("2022_2023"),
  "act4.story.completed.structure": completionCue("structure"),
  "act4.story.completed.pattern": completionCue("pattern"),
  "act4.story.completed.qualification": completionCue("qualification"),
  "act4.story.completed.question": completionCue("question"),
  "act4.story.completed.climateTransition": completionCue("climateTransition"),
} as const satisfies Record<string, MigrationActStoryNarrationCue>;

export type MigrationActStoryNarrationCueId =
  keyof typeof migrationActStoryNarrationCatalog;

export const migrationActStoryIntroCueIds = [
  "act4.story.intro.part1",
  "act4.story.intro.part2",
] as const satisfies readonly MigrationActStoryNarrationCueId[];

export const migrationActStoryCompletionCueIds = [
  "act4.story.completed.structure",
  "act4.story.completed.pattern",
  "act4.story.completed.qualification",
  "act4.story.completed.question",
  "act4.story.completed.climateTransition",
] as const satisfies readonly MigrationActStoryNarrationCueId[];

const getCycleKey = (cycleId: string) => cycleKeyByCycleId[cycleId] ?? null;

export const getMigrationActStoryCycleIntroCueId = (cycleId: string) => {
  const cycleKey = getCycleKey(cycleId);

  return cycleKey
    ? (`act4.story.${cycleKey}.intro` as MigrationActStoryNarrationCueId)
    : null;
};

export const getMigrationActStoryTransitionCueId = (cycleId: string) => {
  const cycleKey = getCycleKey(cycleId);
  if (!cycleKey || cycleKey === "2013_2014") return null;

  return `act4.story.transition.${cycleKey}` as MigrationActStoryNarrationCueId;
};

export const getMigrationActStoryDepartureCueId = (
  cycleId: string,
  eventType: StorkMigrationEvent,
) => {
  const cycleKey = getCycleKey(cycleId);
  if (!cycleKey) return null;
  if (eventType === "autumn_departure") {
    return `act4.story.${cycleKey}.autumnPrepare` as MigrationActStoryNarrationCueId;
  }
  if (eventType === "spring_departure") {
    return `act4.story.${cycleKey}.springPrepare` as MigrationActStoryNarrationCueId;
  }

  return null;
};

export const getMigrationActStoryArrivalCueIds = (
  cycleId: string,
  eventType: StorkMigrationEvent,
) => {
  const cycleKey = getCycleKey(cycleId);
  if (!cycleKey) return [];
  if (eventType === "autumn_arrival") {
    return [
      `act4.story.${cycleKey}.winterReflection1`,
      `act4.story.${cycleKey}.winterReflection2`,
    ].filter(
      (cueId) => cueId in migrationActStoryNarrationCatalog,
    ) as MigrationActStoryNarrationCueId[];
  }
  if (eventType === "spring_arrival") {
    return [
      `act4.story.${cycleKey}.breedingReflection1`,
      `act4.story.${cycleKey}.breedingReflection2`,
    ].filter(
      (cueId) => cueId in migrationActStoryNarrationCatalog,
    ) as MigrationActStoryNarrationCueId[];
  }

  return [];
};

export const resolveMigrationActStoryNarrationCue = (
  cueId: MigrationActStoryNarrationCueId,
) => migrationActStoryNarrationCatalog[cueId];

const getDateDistanceDays = (startDate: string, endDate: string) =>
  Math.max(
    0,
    Math.round(
      (new Date(`${endDate}T00:00:00.000Z`).getTime() -
        new Date(`${startDate}T00:00:00.000Z`).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );

const getCycleLabel = (cycleRun: MigrationActCycleRun) =>
  `${cycleRun.cycleStartYear}-${cycleRun.cycleStartYear + 1}`;

const roundSeconds = (value: number) => Math.round(value);
const barDurationMs = 4_000;

const getPreviousBarMs = (elapsedMs: number) =>
  Math.floor(elapsedMs / barDurationMs) * barDurationMs;

const getNextBarMs = (elapsedMs: number) =>
  Math.ceil(elapsedMs / barDurationMs) * barDurationMs;

const summerTimingTriggerMsByCycleKey: Record<
  MigrationActStoryCycleKey,
  number
> = {
  "2013_2014": 4_000,
  "2016_2017": 12_000,
  "2018_2019": 12_000,
  "2020_2021": 16_000,
  "2022_2023": 16_000,
};

export const estimateMigrationNarrationSpeechDurationSeconds = (
  text: string,
) => {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const commaCount = (text.match(/[,;:]/g) ?? []).length;
  const sentenceCount = (text.match(/[.!?]/g) ?? []).length || 1;

  return Math.max(
    1,
    wordCount * 0.38 + commaCount * 0.18 + sentenceCount * 0.35,
  );
};

export const buildMigrationNarrationTimingAudit = (
  cycleRuns: MigrationActCycleRun[] = migrationStoryCycleDefinitions.map(
    (cycle) => ({
      id: `audit:${cycle.label}`,
      cycleId: cycle.label,
      cycleStartYear: cycle.targetYear,
      title: cycle.label,
    }),
  ),
): MigrationNarrationTimingAuditRow[] =>
  cycleRuns.flatMap((cycleRun) => {
    const timeline = buildPreparedStoryTimeline(
      getMigrationStoryCyclePoints(cycleRun.cycleId),
      STORY_CYCLE_DURATION_MS,
    );
    const events = createMigrationActEvents(cycleRun, timeline);
    const byType = new Map(events.map((event) => [event.eventType, event]));
    const autumnDeparture = byType.get("autumn_departure")!;
    const autumnArrival = byType.get("autumn_arrival")!;
    const springDeparture = byType.get("spring_departure")!;
    const springArrival = byType.get("spring_arrival")!;

    return [
      {
        cycle: getCycleLabel(cycleRun),
        cycleId: cycleRun.cycleId,
        migration: "Autumn",
        realStart: autumnDeparture.boundaryDate,
        realEnd: autumnArrival.boundaryDate,
        realDurationDays: getDateDistanceDays(
          autumnDeparture.boundaryDate,
          autumnArrival.boundaryDate,
        ),
        experienceStartSecond: autumnDeparture.boundaryTimeMs / 1_000,
        experienceEndSecond: autumnArrival.boundaryTimeMs / 1_000,
        experienceDurationSecondsExact:
          (autumnArrival.boundaryTimeMs - autumnDeparture.boundaryTimeMs) /
          1_000,
        experienceDurationSecondsSpoken: roundSeconds(
          (autumnArrival.boundaryTimeMs - autumnDeparture.boundaryTimeMs) /
            1_000,
        ),
      },
      {
        cycle: getCycleLabel(cycleRun),
        cycleId: cycleRun.cycleId,
        migration: "Spring",
        realStart: springDeparture.boundaryDate,
        realEnd: springArrival.boundaryDate,
        realDurationDays: getDateDistanceDays(
          springDeparture.boundaryDate,
          springArrival.boundaryDate,
        ),
        experienceStartSecond: springDeparture.boundaryTimeMs / 1_000,
        experienceEndSecond: springArrival.boundaryTimeMs / 1_000,
        experienceDurationSecondsExact:
          (springArrival.boundaryTimeMs - springDeparture.boundaryTimeMs) /
          1_000,
        experienceDurationSecondsSpoken: roundSeconds(
          (springArrival.boundaryTimeMs - springDeparture.boundaryTimeMs) /
            1_000,
        ),
      },
    ];
  });

export const buildMigrationActResidenceNarrationSchedule = (
  cycleRun: MigrationActCycleRun,
): MigrationActScheduledResidenceNarrationCue[] => {
  const cycleKey = getCycleKey(cycleRun.cycleId);
  if (!cycleKey) return [];

  const timeline = buildPreparedStoryTimeline(
    getMigrationStoryCyclePoints(cycleRun.cycleId),
    STORY_CYCLE_DURATION_MS,
  );
  const events = createMigrationActEvents(cycleRun, timeline);
  const byType = new Map(events.map((event) => [event.eventType, event]));
  const autumnDeparture = byType.get("autumn_departure")!;
  const autumnArrival = byType.get("autumn_arrival")!;
  const springDeparture = byType.get("spring_departure")!;
  const summerCueId =
    `act4.story.${cycleKey}.summerTiming` as MigrationActStoryNarrationCueId;
  const winterCueId =
    `act4.story.${cycleKey}.winterTiming` as MigrationActStoryNarrationCueId;
  const winterPrimaryStartMs = autumnArrival.boundaryTimeMs + barDurationMs;
  const winterTriggerMs = getNextBarMs(
    autumnArrival.boundaryTimeMs + 3 * barDurationMs,
  );

  return [
    {
      cueId: summerCueId,
      cycle: getCycleLabel(cycleRun),
      cycleId: cycleRun.cycleId,
      phase: "summer_rest",
      triggerElapsedMs: summerTimingTriggerMsByCycleKey[cycleKey],
      triggerSecond: summerTimingTriggerMsByCycleKey[cycleKey] / 1_000,
      nextEventType: "autumn_departure",
      nextEventSecond: autumnDeparture.boundaryTimeMs / 1_000,
      nextCountdownStartSecond:
        getPreviousBarMs(autumnDeparture.boundaryTimeMs) / 1_000,
      quietSecondsAfterPrimaryCue: null,
      availableSecondsBeforeCountdown:
        (getPreviousBarMs(autumnDeparture.boundaryTimeMs) -
          summerTimingTriggerMsByCycleKey[cycleKey]) /
        1_000,
      textKey: migrationActStoryNarrationCatalog[summerCueId].textKey,
    },
    {
      cueId: winterCueId,
      cycle: getCycleLabel(cycleRun),
      cycleId: cycleRun.cycleId,
      phase: "winter_rest",
      triggerElapsedMs: winterTriggerMs,
      triggerSecond: winterTriggerMs / 1_000,
      nextEventType: "spring_departure",
      nextEventSecond: springDeparture.boundaryTimeMs / 1_000,
      nextCountdownStartSecond:
        getPreviousBarMs(springDeparture.boundaryTimeMs) / 1_000,
      quietSecondsAfterPrimaryCue:
        (winterTriggerMs - winterPrimaryStartMs) / 1_000,
      availableSecondsBeforeCountdown:
        (getPreviousBarMs(springDeparture.boundaryTimeMs) - winterTriggerMs) /
        1_000,
      textKey: migrationActStoryNarrationCatalog[winterCueId].textKey,
    },
  ];
};
