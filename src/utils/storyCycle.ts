import {
  getStoryReferenceFastWindow,
  getStoryReferenceWeight,
  STORY_TIMING_CONFIG,
} from "~/story/storyTimingConfig";
import type {
  StorkDataPoint,
  StorkMigrationEvent,
  StorkMigrationPhase,
  StorkStoryCycleDefinition,
} from "~/types/stork";

export type StorySeasonId = "summer" | "autumn" | "winter" | "spring";

export type StorySeason = {
  id: StorySeasonId;
  label: string;
  labelKey?: string;
};

export type StoryCycleProgress = {
  elapsedDays: number;
  totalDays: number;
  progress: number;
};

export type StoryBoundary = {
  startDate: string;
  endDate: string;
  startAngle: number;
  endAngle: number;
};

export type StoryMonthBoundary = StoryBoundary & {
  label: string;
  labelKey?: string;
  monthIndex: number;
  midAngle: number;
};

export type StorySeasonBoundary = StoryBoundary & {
  season: StorySeason;
};

export type StoryDateInput = Date | string;
export type CycleSegmentType =
  | "breedingResidence"
  | "autumnMigration"
  | "winterResidence"
  | "springMigration"
  | "postReturnResidence";
export type PlaybackPhase = "migration" | "residence";

export type CycleSegment = {
  type: CycleSegmentType;
  playbackPhase: PlaybackPhase;
  startDate: string;
  endDate: string;
};

export type StoryTimelineTimingClass = "migration" | "rest";

export type StoryTimelineDay = {
  date: string;
  relativeDay: number;
  phase: StorkMigrationPhase;
  isMigrationDay: boolean;
  isRestDay: boolean;
  event: StorkMigrationEvent | null;
  referenceWeight: number;
  timingClass: StoryTimelineTimingClass;
  dayDurationMs: number;
  startMs: number;
  endMs: number;
};

/** @deprecated Use StoryTimelineDay. */
export type StoryWeightedTimelineDay = StoryTimelineDay;

export const STORY_CYCLE_START_MONTH = 5;
export const STORY_CYCLE_START_DAY = 1;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const STORY_CYCLE_DURATION_MS = STORY_TIMING_CONFIG.cycleDurationMs;

const storyMonths = [
  { label: "Jun", labelKey: "seasonClock.months.jun", monthIndex: 5 },
  { label: "Jul", labelKey: "seasonClock.months.jul", monthIndex: 6 },
  { label: "Aug", labelKey: "seasonClock.months.aug", monthIndex: 7 },
  { label: "Sep", labelKey: "seasonClock.months.sep", monthIndex: 8 },
  { label: "Oct", labelKey: "seasonClock.months.oct", monthIndex: 9 },
  { label: "Nov", labelKey: "seasonClock.months.nov", monthIndex: 10 },
  { label: "Dec", labelKey: "seasonClock.months.dec", monthIndex: 11 },
  { label: "Jan", labelKey: "seasonClock.months.jan", monthIndex: 0 },
  { label: "Feb", labelKey: "seasonClock.months.feb", monthIndex: 1 },
  { label: "Mar", labelKey: "seasonClock.months.mar", monthIndex: 2 },
  { label: "Apr", labelKey: "seasonClock.months.apr", monthIndex: 3 },
  { label: "May", labelKey: "seasonClock.months.may", monthIndex: 4 },
];

const summerSeason: StorySeason = {
  id: "summer",
  label: "Summer",
  labelKey: "seasonClock.seasons.summer",
};
const autumnSeason: StorySeason = {
  id: "autumn",
  label: "Autumn",
  labelKey: "seasonClock.seasons.autumn",
};
const winterSeason: StorySeason = {
  id: "winter",
  label: "Winter",
  labelKey: "seasonClock.seasons.winter",
};
const springSeason: StorySeason = {
  id: "spring",
  label: "Spring",
  labelKey: "seasonClock.seasons.spring",
};

const seasons: StorySeason[] = [
  summerSeason,
  autumnSeason,
  winterSeason,
  springSeason,
];

const toUtcDate = (date: StoryDateInput) => {
  if (date instanceof Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error(`Invalid story date: ${date}`);
  }

  return new Date(Date.UTC(year, month - 1, day));
};

export const formatStoryDate = (date: StoryDateInput) => {
  const utcDate = toUtcDate(date);
  const year = utcDate.getUTCFullYear();
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utcDate.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const addStoryDays = (date: StoryDateInput, days: number) => {
  const utcDate = toUtcDate(date);

  return new Date(
    Date.UTC(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth(),
      utcDate.getUTCDate() + days,
    ),
  );
};

const getElapsedDays = (startDate: StoryDateInput, endDate: StoryDateInput) =>
  Math.floor(
    (toUtcDate(endDate).getTime() - toUtcDate(startDate).getTime()) / DAY_MS,
  );

export const getStoryCycleStart = (date: StoryDateInput) => {
  const utcDate = toUtcDate(date);
  const year = utcDate.getUTCFullYear();
  const month = utcDate.getUTCMonth();
  const day = utcDate.getUTCDate();
  const startsThisYear =
    month > STORY_CYCLE_START_MONTH ||
    (month === STORY_CYCLE_START_MONTH && day >= STORY_CYCLE_START_DAY);

  return new Date(
    Date.UTC(
      startsThisYear ? year : year - 1,
      STORY_CYCLE_START_MONTH,
      STORY_CYCLE_START_DAY,
    ),
  );
};

export const getNextStoryCycleStart = (date: StoryDateInput) => {
  const cycleStart = getStoryCycleStart(date);

  return new Date(
    Date.UTC(cycleStart.getUTCFullYear() + 1, STORY_CYCLE_START_MONTH, 1),
  );
};

export const getStoryCycleEnd = (date: StoryDateInput) =>
  addStoryDays(getNextStoryCycleStart(date), -1);

export const getDayProgressInStoryCycle = (
  date: StoryDateInput,
): StoryCycleProgress => {
  const cycleStart = getStoryCycleStart(date);
  const nextCycleStart = getNextStoryCycleStart(date);
  const totalDays = getElapsedDays(cycleStart, nextCycleStart);
  const elapsedDays = Math.min(
    Math.max(getElapsedDays(cycleStart, date), 0),
    totalDays - 1,
  );

  return {
    elapsedDays,
    totalDays,
    progress: elapsedDays / totalDays,
  };
};

export const dateToAngle = (date: StoryDateInput) => {
  const { progress } = getDayProgressInStoryCycle(date);

  return -90 + progress * 360;
};

const angleForElapsedDays = (date: StoryDateInput, elapsedDays: number) => {
  const { totalDays } = getDayProgressInStoryCycle(date);

  return -90 + (elapsedDays / totalDays) * 360;
};

export const getSeasonForDate = (date: StoryDateInput): StorySeason => {
  const month = toUtcDate(date).getUTCMonth();

  if (month >= 5 && month <= 7) return summerSeason;
  if (month >= 8 && month <= 10) return autumnSeason;
  if (month === 11 || month <= 1) return winterSeason;

  return springSeason;
};

export const getMonthBoundariesForCycle = (
  date: StoryDateInput,
): StoryMonthBoundary[] => {
  const cycleStart = getStoryCycleStart(date);
  const startYear = cycleStart.getUTCFullYear();

  return storyMonths.map((month, index) => {
    const year =
      month.monthIndex >= STORY_CYCLE_START_MONTH ? startYear : startYear + 1;
    const startDate = new Date(Date.UTC(year, month.monthIndex, 1));
    const endMonth =
      storyMonths[index + 1]?.monthIndex ?? STORY_CYCLE_START_MONTH;
    const endYear =
      index === storyMonths.length - 1
        ? startYear + 1
        : endMonth >= STORY_CYCLE_START_MONTH
          ? startYear
          : startYear + 1;
    const endDate = new Date(Date.UTC(endYear, endMonth, 1));
    const startElapsedDays = getElapsedDays(cycleStart, startDate);
    const endElapsedDays = getElapsedDays(cycleStart, endDate);
    const midElapsedDays =
      startElapsedDays + (endElapsedDays - startElapsedDays) / 2;

    return {
      ...month,
      startDate: formatStoryDate(startDate),
      endDate: formatStoryDate(endDate),
      startAngle: angleForElapsedDays(date, startElapsedDays),
      endAngle: angleForElapsedDays(date, endElapsedDays),
      midAngle: angleForElapsedDays(date, midElapsedDays),
    };
  });
};

export const getSeasonBoundariesForCycle = (
  date: StoryDateInput,
): StorySeasonBoundary[] => {
  const cycleStart = getStoryCycleStart(date);
  const startYear = cycleStart.getUTCFullYear();
  const seasonStarts = [
    new Date(Date.UTC(startYear, 5, 1)),
    new Date(Date.UTC(startYear, 8, 1)),
    new Date(Date.UTC(startYear, 11, 1)),
    new Date(Date.UTC(startYear + 1, 2, 1)),
    new Date(Date.UTC(startYear + 1, 5, 1)),
  ];

  return seasons.map((season, index) => {
    const startDate = seasonStarts[index];
    const endDate = seasonStarts[index + 1];

    if (!startDate || !endDate) {
      throw new Error("Invalid story season boundary.");
    }

    const startElapsedDays = getElapsedDays(cycleStart, startDate);
    const endElapsedDays = getElapsedDays(cycleStart, endDate);

    return {
      season,
      startDate: formatStoryDate(startDate),
      endDate: formatStoryDate(endDate),
      startAngle: angleForElapsedDays(date, startElapsedDays),
      endAngle: angleForElapsedDays(date, endElapsedDays),
    };
  });
};

export const getNextStoryDate = (date: StoryDateInput) => {
  const nextDate = addStoryDays(date, 1);

  if (
    formatStoryDate(nextDate) >= formatStoryDate(getNextStoryCycleStart(date))
  ) {
    return getStoryCycleStart(date);
  }

  return nextDate;
};

const clampStoryDateToCycle = (
  date: StoryDateInput,
  cycleStartDate: string,
  nextCycleStartDate: string,
) => {
  const formattedDate = formatStoryDate(date);

  if (formattedDate < cycleStartDate) return cycleStartDate;
  if (formattedDate > nextCycleStartDate) return nextCycleStartDate;

  return formattedDate;
};

const isValidSegment = (startDate: string, endDate: string) =>
  startDate < endDate;

export const getCycleSegments = (
  cycle: StorkStoryCycleDefinition | null | undefined,
  cycleStart: StoryDateInput,
): CycleSegment[] => {
  const cycleStartDate = formatStoryDate(getStoryCycleStart(cycleStart));
  const nextCycleStartDate = formatStoryDate(
    getNextStoryCycleStart(cycleStart),
  );

  if (!cycle?.events) {
    return [];
  }

  const breedingDeparture = clampStoryDateToCycle(
    cycle.events.breedingDeparture,
    cycleStartDate,
    nextCycleStartDate,
  );
  const winterArrival = clampStoryDateToCycle(
    cycle.events.winterArrival,
    cycleStartDate,
    nextCycleStartDate,
  );
  const winterDeparture = clampStoryDateToCycle(
    cycle.events.winterDeparture,
    cycleStartDate,
    nextCycleStartDate,
  );
  const nextBreedingArrival = clampStoryDateToCycle(
    cycle.events.nextBreedingArrival,
    cycleStartDate,
    nextCycleStartDate,
  );
  const candidates: CycleSegment[] = [
    {
      type: "breedingResidence",
      playbackPhase: "residence",
      startDate: cycleStartDate,
      endDate: breedingDeparture,
    },
    {
      type: "autumnMigration",
      playbackPhase: "migration",
      startDate: breedingDeparture,
      endDate: winterArrival,
    },
    {
      type: "winterResidence",
      playbackPhase: "residence",
      startDate: winterArrival,
      endDate: winterDeparture,
    },
    {
      type: "springMigration",
      playbackPhase: "migration",
      startDate: winterDeparture,
      endDate: nextBreedingArrival,
    },
    {
      type: "postReturnResidence",
      playbackPhase: "residence",
      startDate: nextBreedingArrival,
      endDate: nextCycleStartDate,
    },
  ];

  return candidates.filter((segment) =>
    isValidSegment(segment.startDate, segment.endDate),
  );
};

export const buildPreparedStoryTimeline = (
  points: StorkDataPoint[],
  cycleDurationMs: number = STORY_CYCLE_DURATION_MS,
): StoryTimelineDay[] => {
  if (!Number.isFinite(cycleDurationMs) || cycleDurationMs <= 0) {
    throw new Error(
      `Story cycle duration must be positive: ${cycleDurationMs}`,
    );
  }

  const preparedPoints = [...points]
    .filter((point) => point.story)
    .sort(
      (first, second) =>
        (first.story?.relativeDay ?? 0) - (second.story?.relativeDay ?? 0),
    );
  const firstPoint = preparedPoints[0];
  const firstStory = firstPoint?.story;

  if (!firstPoint || !firstStory) {
    throw new Error("Prepared story timeline requires story data points.");
  }
  if (preparedPoints.length !== 365) {
    throw new Error(
      `Story cycle ${firstStory.cycleId} must contain 365 days; received ${preparedPoints.length}.`,
    );
  }
  if (
    !firstPoint.date.endsWith("-06-01") ||
    !preparedPoints[preparedPoints.length - 1]?.date.endsWith("-05-31")
  ) {
    throw new Error(
      `Story cycle ${firstStory.cycleId} must cover June 1 through May 31.`,
    );
  }

  const cycleId = firstStory.cycleId;
  const timingInputs = preparedPoints.map((point, index) => {
    const story = point.story!;
    const expectedDate = formatStoryDate(addStoryDays(firstPoint.date, index));
    const isMigrationPhase =
      story.phase === "autumn_migration" || story.phase === "spring_migration";

    if (story.cycleId !== cycleId) {
      throw new Error(
        `Prepared story timeline mixes ${cycleId} with ${story.cycleId}.`,
      );
    }
    if (story.relativeDay !== index || point.date !== expectedDate) {
      throw new Error(
        `Story cycle ${cycleId} has invalid day ${point.date}: array index ${index}, ` +
          `relative-day ${story.relativeDay}, expected date ${expectedDate}.`,
      );
    }
    if (
      story.isMigrationDay === story.isRestDay ||
      story.isMigrationDay !== isMigrationPhase
    ) {
      throw new Error(
        `Story cycle ${cycleId} has inconsistent phase flags on ${point.date}.`,
      );
    }

    const referenceWindow = getStoryReferenceFastWindow(point.date);
    if (referenceWindow && story.isMigrationDay) {
      throw new Error(
        `Story cycle ${cycleId} has migration on ${point.date} ` +
          `(phase ${story.phase}) inside reference window ${referenceWindow.id}.`,
      );
    }

    return {
      point,
      story,
      referenceWeight: getStoryReferenceWeight(point.date),
    };
  });

  const migrationDayCount = timingInputs.filter(
    ({ story }) => story.isMigrationDay,
  ).length;
  const restDayCount = timingInputs.length - migrationDayCount;
  if (restDayCount <= 0) {
    throw new Error(
      `Story cycle ${cycleId} must contain at least one rest day.`,
    );
  }

  const referenceTotalWeight = timingInputs.reduce(
    (sum, day) => sum + day.referenceWeight,
    0,
  );
  const migrationDayDurationMs = cycleDurationMs / referenceTotalWeight;
  const migrationBudgetMs = migrationDayCount * migrationDayDurationMs;
  const restBudgetMs = cycleDurationMs - migrationBudgetMs;

  if (restBudgetMs <= 0) {
    throw new Error(
      `Story cycle ${cycleId} has no positive rest budget: ${restBudgetMs} ms.`,
    );
  }

  const baseRestBudgetMs = timingInputs.reduce(
    (sum, day) =>
      day.story.isRestDay
        ? sum + migrationDayDurationMs * day.referenceWeight
        : sum,
    0,
  );
  const budgetToleranceMs = Math.max(1e-7, cycleDurationMs * 1e-10);
  if (Math.abs(restBudgetMs - baseRestBudgetMs) > budgetToleranceMs) {
    throw new Error(
      `Story cycle ${cycleId} has inconsistent rest budgets: remaining=${restBudgetMs} ms, ` +
        `reference=${baseRestBudgetMs} ms.`,
    );
  }

  const restDayDurationMs = restBudgetMs / restDayCount;
  let cursorMs = 0;

  return timingInputs.map(({ point, story, referenceWeight }, index) => {
    const startMs = cursorMs;
    const plannedDayDurationMs = story.isMigrationDay
      ? migrationDayDurationMs
      : restDayDurationMs;
    const endMs =
      index === timingInputs.length - 1
        ? cycleDurationMs
        : startMs + plannedDayDurationMs;
    const dayDurationMs = endMs - startMs;

    cursorMs = endMs;

    return {
      date: point.date,
      relativeDay: story.relativeDay,
      phase: story.phase,
      isMigrationDay: story.isMigrationDay,
      isRestDay: story.isRestDay,
      event: story.event,
      referenceWeight,
      timingClass: story.isMigrationDay ? "migration" : "rest",
      dayDurationMs,
      startMs,
      endMs,
    };
  });
};

export type StoryTimelinePhaseDiagnostic = {
  phase: StorkMigrationPhase;
  startDate: string;
  endDate: string;
  dayCount: number;
  plannedDurationMs: number;
};

export type StoryTimelineDiagnostic = {
  cycleId: string;
  cycleDurationMs: number;
  migrationDayCount: number;
  restDayCount: number;
  referenceFastDayCount: number;
  referenceNormalDayCount: number;
  referenceTotalWeight: number;
  migrationDayDurationMs: number;
  referenceFastDayDurationMs: number;
  restDayDurationMs: number;
  migrationBudgetMs: number;
  restBudgetMs: number;
  firstTimelineDate: string;
  lastTimelineDate: string;
  phases: StoryTimelinePhaseDiagnostic[];
};

export const getPreparedStoryTimelineDiagnostic = (
  points: StorkDataPoint[],
  timeline: StoryTimelineDay[],
): StoryTimelineDiagnostic => {
  const firstDay = timeline[0];
  const lastDay = timeline[timeline.length - 1];
  const cycleId = points.find((point) => point.story)?.story?.cycleId;

  if (!firstDay || !lastDay || !cycleId) {
    throw new Error("Cannot diagnose an empty prepared story timeline.");
  }

  const migrationDays = timeline.filter((day) => day.isMigrationDay);
  const restDays = timeline.filter((day) => day.isRestDay);
  const referenceFastDayCount = timeline.filter(
    (day) => day.referenceWeight === STORY_TIMING_CONFIG.referenceFastDayWeight,
  ).length;
  const phases: StoryTimelinePhaseDiagnostic[] = [];

  for (const day of timeline) {
    const current = phases[phases.length - 1];
    if (current?.phase === day.phase) {
      current.endDate = day.date;
      current.dayCount++;
      current.plannedDurationMs += day.dayDurationMs;
    } else {
      phases.push({
        phase: day.phase,
        startDate: day.date,
        endDate: day.date,
        dayCount: 1,
        plannedDurationMs: day.dayDurationMs,
      });
    }
  }

  return {
    cycleId,
    cycleDurationMs: lastDay.endMs,
    migrationDayCount: migrationDays.length,
    restDayCount: restDays.length,
    referenceFastDayCount,
    referenceNormalDayCount: timeline.length - referenceFastDayCount,
    referenceTotalWeight: timeline.reduce(
      (sum, day) => sum + day.referenceWeight,
      0,
    ),
    migrationDayDurationMs: migrationDays[0]?.dayDurationMs ?? 0,
    referenceFastDayDurationMs:
      (migrationDays[0]?.dayDurationMs ?? 0) *
      STORY_TIMING_CONFIG.referenceFastDayWeight,
    restDayDurationMs: restDays[0]?.dayDurationMs ?? 0,
    migrationBudgetMs: migrationDays.reduce(
      (sum, day) => sum + day.dayDurationMs,
      0,
    ),
    restBudgetMs: restDays.reduce((sum, day) => sum + day.dayDurationMs, 0),
    firstTimelineDate: firstDay.date,
    lastTimelineDate: lastDay.date,
    phases,
  };
};

export const getWeightedStoryTimelineDayAtElapsedMs = (
  timeline: StoryTimelineDay[],
  elapsedMs: number,
) => {
  const lastDay = timeline[timeline.length - 1];

  if (!timeline[0] || !lastDay) return null;

  const cycleDurationMs = lastDay.endMs;
  const normalizedElapsedMs =
    ((elapsedMs % cycleDurationMs) + cycleDurationMs) % cycleDurationMs;

  let low = 0;
  let high = timeline.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const day = timeline[middle];

    if (!day) break;
    if (normalizedElapsedMs < day.startMs) {
      high = middle - 1;
      continue;
    }
    if (normalizedElapsedMs >= day.endMs) {
      low = middle + 1;
      continue;
    }

    return day;
  }

  return lastDay;
};

export const getWeightedStoryTimelineElapsedMsForDate = (
  timeline: StoryTimelineDay[],
  date: StoryDateInput,
) => {
  const firstDay = timeline[0];

  if (!firstDay) return 0;

  const exactDay = timeline.find((day) => day.date === formatStoryDate(date));

  if (exactDay) return exactDay.startMs;

  const { elapsedDays } = getDayProgressInStoryCycle(date);
  const timelineDate = formatStoryDate(
    addStoryDays(firstDay.date, elapsedDays),
  );

  return timeline.find((day) => day.date === timelineDate)?.startMs ?? 0;
};

export const getStoryDateFromCycleOffset = (
  cycleStart: StoryDateInput,
  elapsedDays: number,
) => addStoryDays(getStoryCycleStart(cycleStart), elapsedDays);

export const getStoryDayDistance = (
  firstDate: StoryDateInput,
  secondDate: StoryDateInput,
) =>
  Math.abs(
    getDayProgressInStoryCycle(firstDate).elapsedDays -
      getDayProgressInStoryCycle(secondDate).elapsedDays,
  );
