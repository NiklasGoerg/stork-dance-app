export type StorySeasonId = "summer" | "autumn" | "winter" | "spring";

export type StorySeason = {
  id: StorySeasonId;
  label: string;
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
  monthIndex: number;
  midAngle: number;
};

export type StorySeasonBoundary = StoryBoundary & {
  season: StorySeason;
};

export type StoryDateInput = Date | string;

export const STORY_CYCLE_START_MONTH = 5;
export const STORY_CYCLE_START_DAY = 1;
export const DAY_MS = 24 * 60 * 60 * 1000;

const storyMonths = [
  { label: "Jun", monthIndex: 5 },
  { label: "Jul", monthIndex: 6 },
  { label: "Aug", monthIndex: 7 },
  { label: "Sep", monthIndex: 8 },
  { label: "Okt", monthIndex: 9 },
  { label: "Nov", monthIndex: 10 },
  { label: "Dez", monthIndex: 11 },
  { label: "Jan", monthIndex: 0 },
  { label: "Feb", monthIndex: 1 },
  { label: "M\u00e4r", monthIndex: 2 },
  { label: "Apr", monthIndex: 3 },
  { label: "Mai", monthIndex: 4 },
];

const summerSeason: StorySeason = { id: "summer", label: "Sommer" };
const autumnSeason: StorySeason = { id: "autumn", label: "Herbst" };
const winterSeason: StorySeason = { id: "winter", label: "Winter" };
const springSeason: StorySeason = { id: "spring", label: "Fr\u00fchling" };

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
