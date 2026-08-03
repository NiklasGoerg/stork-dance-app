export type StoryReferenceFastWindow = {
  id: "summer" | "winter";
  startMonthDay: string;
  endMonthDay: string;
};

export const STORY_TIMING_CONFIG = {
  cycleDurationMs: 96_000,
  referenceFastDayWeight: 0.01,
  referenceNormalDayWeight: 1.0,
  referenceFastWindows: [
    {
      id: "summer",
      startMonthDay: "06-01",
      endMonthDay: "07-31",
    },
    {
      id: "winter",
      startMonthDay: "10-15",
      endMonthDay: "01-15",
    },
  ],
} as const satisfies {
  cycleDurationMs: number;
  referenceFastDayWeight: number;
  referenceNormalDayWeight: number;
  referenceFastWindows: readonly StoryReferenceFastWindow[];
};

export type StoryTimingDateInput = Date | string;

const getMonthDay = (date: StoryTimingDateInput) => {
  if (date instanceof Date) {
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `${month}-${day}`;
  }

  const match = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(date);

  if (!match?.[1] || !match[2]) {
    throw new Error(`Invalid story timing date: ${date}`);
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const validationDate = new Date(Date.UTC(2000, month - 1, day));

  if (
    validationDate.getUTCMonth() !== month - 1 ||
    validationDate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid story timing date: ${date}`);
  }

  return `${match[1]}-${match[2]}`;
};

export const isMonthDayInStoryReferenceWindow = (
  monthDay: string,
  window: StoryReferenceFastWindow,
) => {
  if (window.startMonthDay <= window.endMonthDay) {
    return monthDay >= window.startMonthDay && monthDay <= window.endMonthDay;
  }

  return monthDay >= window.startMonthDay || monthDay <= window.endMonthDay;
};

export const getStoryReferenceFastWindow = (date: StoryTimingDateInput) => {
  const monthDay = getMonthDay(date);

  return (
    STORY_TIMING_CONFIG.referenceFastWindows.find((window) =>
      isMonthDayInStoryReferenceWindow(monthDay, window),
    ) ?? null
  );
};

export const getStoryReferenceWeight = (date: StoryTimingDateInput) =>
  getStoryReferenceFastWindow(date)
    ? STORY_TIMING_CONFIG.referenceFastDayWeight
    : STORY_TIMING_CONFIG.referenceNormalDayWeight;
