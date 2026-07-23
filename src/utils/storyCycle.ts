import type { StorkStoryCycleDefinition } from "~/types/stork";
import { STORY_AUDIO_CONFIG } from "~/utils/storyAudioConfig";

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
export type PlaybackSpeedPhase = "fast" | "focus";
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

export type StoryWeightedTimelineDay = {
  date: string;
  phase: PlaybackSpeedPhase;
  playbackPhase: PlaybackPhase;
  segmentType: CycleSegmentType | "calendarFallback";
  weight: number;
  dayDurationMs: number;
  startMs: number;
  endMs: number;
};

export const STORY_CYCLE_START_MONTH = 5;
export const STORY_CYCLE_START_DAY = 1;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const STORY_CYCLE_DURATION_MS = STORY_AUDIO_CONFIG.cycleDurationMs;
export const STORY_FOCUS_DAY_WEIGHT = 1.0;
export const STORY_FAST_DAY_WEIGHT = 0.01;

export type PlaybackSpeedWindow = {
  // UTC month index, matching JavaScript Date: Jan = 0, Jun = 5.
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
};

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

// Fixed global windows are the basis before residence segments are smoothed.
export const STORY_FAST_PLAYBACK_WINDOWS: PlaybackSpeedWindow[] = [
  { startMonth: 5, startDay: 1, endMonth: 6, endDay: 31 },
  { startMonth: 10, startDay: 1, endMonth: 0, endDay: 15 },
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

const getMonthDayOrderValue = (month: number, day: number) => month * 100 + day;

const isMonthDayInPlaybackWindow = (
  month: number,
  day: number,
  window: PlaybackSpeedWindow,
) => {
  const dateValue = getMonthDayOrderValue(month, day);
  const startValue = getMonthDayOrderValue(window.startMonth, window.startDay);
  const endValue = getMonthDayOrderValue(window.endMonth, window.endDay);

  if (startValue <= endValue) {
    return dateValue >= startValue && dateValue <= endValue;
  }

  return dateValue >= startValue || dateValue <= endValue;
};

export const getGlobalPlaybackSpeedPhase = (
  date: StoryDateInput,
): PlaybackSpeedPhase => {
  const utcDate = toUtcDate(date);
  const month = utcDate.getUTCMonth();
  const day = utcDate.getUTCDate();
  const isFast = STORY_FAST_PLAYBACK_WINDOWS.some((window) =>
    isMonthDayInPlaybackWindow(month, day, window),
  );

  return isFast ? "fast" : "focus";
};

export const getBaseCalendarWeight = (date: StoryDateInput) =>
  getGlobalPlaybackSpeedPhase(date) === "focus"
    ? STORY_FOCUS_DAY_WEIGHT
    : STORY_FAST_DAY_WEIGHT;

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

const getSegmentForDate = (segments: CycleSegment[], date: StoryDateInput) => {
  const formattedDate = formatStoryDate(date);

  return (
    segments.find(
      (segment) =>
        formattedDate >= segment.startDate && formattedDate < segment.endDate,
    ) ?? null
  );
};

const buildCalendarFallbackTimeline = (year: number) => {
  const cycleStart = new Date(
    Date.UTC(year, STORY_CYCLE_START_MONTH, STORY_CYCLE_START_DAY),
  );
  const { totalDays } = getDayProgressInStoryCycle(cycleStart);

  return Array.from({ length: totalDays }, (_, index) => {
    const date = formatStoryDate(addStoryDays(cycleStart, index));
    const phase = getGlobalPlaybackSpeedPhase(date);

    return {
      date,
      phase,
      playbackPhase: phase === "focus" ? "migration" : "residence",
      segmentType: "calendarFallback",
      weight: getBaseCalendarWeight(date),
    };
  });
};

export const buildPhaseSmoothedCycleTimeline = (
  cycle: StorkStoryCycleDefinition | null | undefined,
  options: {
    year?: number;
    cycleDurationMs?: number;
  } = {},
): StoryWeightedTimelineDay[] => {
  const year = options.year ?? cycle?.targetYear ?? defaultStoryStartYear;
  const cycleDurationMs = options.cycleDurationMs ?? STORY_CYCLE_DURATION_MS;
  const cycleStart = new Date(
    Date.UTC(year, STORY_CYCLE_START_MONTH, STORY_CYCLE_START_DAY),
  );
  const { totalDays } = getDayProgressInStoryCycle(cycleStart);
  const segments = getCycleSegments(cycle, cycleStart);

  if (!segments.length) {
    return normalizeWeightedTimelineDays(
      buildCalendarFallbackTimeline(year),
      cycleDurationMs,
    );
  }

  const baseDays = Array.from({ length: totalDays }, (_, index) => {
    const date = formatStoryDate(addStoryDays(cycleStart, index));
    const segment = getSegmentForDate(segments, date);

    return {
      date,
      phase: getGlobalPlaybackSpeedPhase(date),
      playbackPhase: segment?.playbackPhase ?? "residence",
      segmentType: segment?.type ?? "calendarFallback",
      weight: getBaseCalendarWeight(date),
    };
  });
  const residenceSegmentWeights = new Map<CycleSegmentType, number>();

  for (const segment of segments) {
    if (segment.playbackPhase !== "residence") continue;

    const segmentDays = baseDays.filter(
      (day) => day.segmentType === segment.type,
    );

    if (!segmentDays.length) continue;

    const segmentBaseWeightSum = segmentDays.reduce(
      (sum, day) => sum + day.weight,
      0,
    );

    residenceSegmentWeights.set(
      segment.type,
      segmentBaseWeightSum / segmentDays.length,
    );
  }

  return normalizeWeightedTimelineDays(
    baseDays.map((day) => {
      if (day.playbackPhase === "migration") {
        return {
          ...day,
          phase: "focus",
          weight: STORY_FOCUS_DAY_WEIGHT,
        };
      }

      const smoothedResidenceWeight =
        day.segmentType === "calendarFallback"
          ? day.weight
          : (residenceSegmentWeights.get(day.segmentType) ?? day.weight);

      return {
        ...day,
        weight: smoothedResidenceWeight,
      };
    }),
    cycleDurationMs,
  );
};

const normalizeWeightedTimelineDays = (
  days: Omit<StoryWeightedTimelineDay, "dayDurationMs" | "startMs" | "endMs">[],
  cycleDurationMs: number,
): StoryWeightedTimelineDay[] => {
  const totalWeight = days.reduce((sum, day) => sum + day.weight, 0);

  if (!days.length || totalWeight <= 0) return [];

  let cursorMs = 0;

  return days.map((day, index) => {
    const startMs = cursorMs;
    const dayDurationMs =
      index === days.length - 1
        ? cycleDurationMs - startMs
        : (day.weight / totalWeight) * cycleDurationMs;
    const endMs = startMs + dayDurationMs;

    cursorMs = endMs;

    return {
      ...day,
      dayDurationMs,
      startMs,
      endMs,
    };
  });
};

const defaultStoryStartYear = 2022;

export const buildGlobalWeightedCalendarTimeline = (
  year: number,
  cycleDurationMs = STORY_CYCLE_DURATION_MS,
): StoryWeightedTimelineDay[] =>
  normalizeWeightedTimelineDays(
    buildCalendarFallbackTimeline(year),
    cycleDurationMs,
  );

export const getWeightedStoryTimelineDayAtElapsedMs = (
  timeline: StoryWeightedTimelineDay[],
  elapsedMs: number,
) => {
  const lastDay = timeline[timeline.length - 1];

  if (!timeline[0] || !lastDay) return null;

  const cycleDurationMs = lastDay.endMs;
  const normalizedElapsedMs =
    ((elapsedMs % cycleDurationMs) + cycleDurationMs) % cycleDurationMs;

  return (
    timeline.find(
      (day) =>
        normalizedElapsedMs >= day.startMs && normalizedElapsedMs < day.endMs,
    ) ?? lastDay
  );
};

export const getWeightedStoryTimelineElapsedMsForDate = (
  timeline: StoryWeightedTimelineDay[],
  date: StoryDateInput,
) => {
  const firstDay = timeline[0];

  if (!firstDay) return 0;

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
