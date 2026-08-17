import type { Act5SequenceTarget } from "~/types/act5";
import type { ClimateSeason } from "~/types/climate";
import { formatSpokenPercent } from "~/utils/act5/tutorialNarration";

export type Act5StoryPeriodId =
  | "reference"
  | "2000_2004"
  | "2005_2009"
  | "2010_2014"
  | "2015_2019"
  | "2020_2024";

export type Act5StoryTargetCueId =
  | `act5.story.reference.${ClimateSeason}`
  | `act5.story.${Exclude<Act5StoryPeriodId, "reference">}.${ClimateSeason}`;

export type Act5StoryPeriodTransitionCueId = `act5.story.transition.${Exclude<
  Act5StoryPeriodId,
  "reference" | "2020_2024"
>}`;

export type Act5StoryCompletionCueId =
  | "act5.story.completed.embodied"
  | "act5.story.completed.seasons"
  | "act5.story.completed.maximum"
  | "act5.story.completed.maximumContext"
  | "act5.story.completed.migration";

export type Act5StoryNarrationCueId =
  | "act5.story.intro.chart"
  | "act5.story.intro.reference"
  | Act5StoryTargetCueId
  | Act5StoryPeriodTransitionCueId
  | "act5.story.reference.complete"
  | "act5.story.reference.scale"
  | Act5StoryCompletionCueId;

export type Act5StoryNarrationCue = {
  id: Act5StoryNarrationCueId;
  textKey: string;
  speak: boolean;
  display: boolean;
  priority: number;
};

export type Act5StoryNarrationResolution = {
  cue: Act5StoryNarrationCue;
  params: Record<string, string | number>;
};

const createCue = (
  id: Act5StoryNarrationCueId,
  textKey: string,
  options: Pick<Act5StoryNarrationCue, "speak" | "display" | "priority"> = {
    speak: true,
    display: true,
    priority: 50,
  },
): Act5StoryNarrationCue => ({
  id,
  textKey,
  ...options,
});

export const act5StoryNarrationCatalog = {
  "act5.story.intro.chart": createCue(
    "act5.story.intro.chart",
    "story.acts.act5.narration.story.intro.chart",
  ),
  "act5.story.intro.reference": createCue(
    "act5.story.intro.reference",
    "story.acts.act5.narration.story.intro.reference",
  ),
  "act5.story.reference.winter": createCue(
    "act5.story.reference.winter",
    "story.acts.act5.narration.story.reference.winter",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.reference.spring": createCue(
    "act5.story.reference.spring",
    "story.acts.act5.narration.story.reference.spring",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.reference.summer": createCue(
    "act5.story.reference.summer",
    "story.acts.act5.narration.story.reference.summer",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.reference.autumn": createCue(
    "act5.story.reference.autumn",
    "story.acts.act5.narration.story.reference.autumn",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.reference.complete": createCue(
    "act5.story.reference.complete",
    "story.acts.act5.narration.story.referenceComplete.summary",
  ),
  "act5.story.reference.scale": createCue(
    "act5.story.reference.scale",
    "story.acts.act5.narration.story.referenceComplete.scale",
  ),
  "act5.story.2000_2004.winter": createCue(
    "act5.story.2000_2004.winter",
    "story.acts.act5.narration.story.2000_2004.winter",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2000_2004.spring": createCue(
    "act5.story.2000_2004.spring",
    "story.acts.act5.narration.story.2000_2004.spring",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2000_2004.summer": createCue(
    "act5.story.2000_2004.summer",
    "story.acts.act5.narration.story.2000_2004.summer",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2000_2004.autumn": createCue(
    "act5.story.2000_2004.autumn",
    "story.acts.act5.narration.story.2000_2004.autumn",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2005_2009.winter": createCue(
    "act5.story.2005_2009.winter",
    "story.acts.act5.narration.story.2005_2009.winter",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2005_2009.spring": createCue(
    "act5.story.2005_2009.spring",
    "story.acts.act5.narration.story.2005_2009.spring",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2005_2009.summer": createCue(
    "act5.story.2005_2009.summer",
    "story.acts.act5.narration.story.2005_2009.summer",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2005_2009.autumn": createCue(
    "act5.story.2005_2009.autumn",
    "story.acts.act5.narration.story.2005_2009.autumn",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2010_2014.winter": createCue(
    "act5.story.2010_2014.winter",
    "story.acts.act5.narration.story.2010_2014.winter",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2010_2014.spring": createCue(
    "act5.story.2010_2014.spring",
    "story.acts.act5.narration.story.2010_2014.spring",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2010_2014.summer": createCue(
    "act5.story.2010_2014.summer",
    "story.acts.act5.narration.story.2010_2014.summer",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2010_2014.autumn": createCue(
    "act5.story.2010_2014.autumn",
    "story.acts.act5.narration.story.2010_2014.autumn",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2015_2019.winter": createCue(
    "act5.story.2015_2019.winter",
    "story.acts.act5.narration.story.2015_2019.winter",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2015_2019.spring": createCue(
    "act5.story.2015_2019.spring",
    "story.acts.act5.narration.story.2015_2019.spring",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2015_2019.summer": createCue(
    "act5.story.2015_2019.summer",
    "story.acts.act5.narration.story.2015_2019.summer",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2015_2019.autumn": createCue(
    "act5.story.2015_2019.autumn",
    "story.acts.act5.narration.story.2015_2019.autumn",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2020_2024.winter": createCue(
    "act5.story.2020_2024.winter",
    "story.acts.act5.narration.story.2020_2024.winter",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2020_2024.spring": createCue(
    "act5.story.2020_2024.spring",
    "story.acts.act5.narration.story.2020_2024.spring",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2020_2024.summer": createCue(
    "act5.story.2020_2024.summer",
    "story.acts.act5.narration.story.2020_2024.summer",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.2020_2024.autumn": createCue(
    "act5.story.2020_2024.autumn",
    "story.acts.act5.narration.story.2020_2024.autumn",
    { speak: true, display: false, priority: 50 },
  ),
  "act5.story.transition.2000_2004": createCue(
    "act5.story.transition.2000_2004",
    "story.acts.act5.narration.story.transition.2000_2004",
  ),
  "act5.story.transition.2005_2009": createCue(
    "act5.story.transition.2005_2009",
    "story.acts.act5.narration.story.transition.2005_2009",
  ),
  "act5.story.transition.2010_2014": createCue(
    "act5.story.transition.2010_2014",
    "story.acts.act5.narration.story.transition.2010_2014",
  ),
  "act5.story.transition.2015_2019": createCue(
    "act5.story.transition.2015_2019",
    "story.acts.act5.narration.story.transition.2015_2019",
  ),
  "act5.story.completed.embodied": createCue(
    "act5.story.completed.embodied",
    "story.acts.act5.narration.story.completed.embodied",
  ),
  "act5.story.completed.seasons": createCue(
    "act5.story.completed.seasons",
    "story.acts.act5.narration.story.completed.seasons",
  ),
  "act5.story.completed.maximum": createCue(
    "act5.story.completed.maximum",
    "story.acts.act5.narration.story.completed.maximum",
  ),
  "act5.story.completed.maximumContext": createCue(
    "act5.story.completed.maximumContext",
    "story.acts.act5.narration.story.completed.maximumContext",
  ),
  "act5.story.completed.migration": createCue(
    "act5.story.completed.migration",
    "story.acts.act5.narration.story.completed.migration",
  ),
} as const satisfies Record<Act5StoryNarrationCueId, Act5StoryNarrationCue>;

export const act5StoryTargetCueIds = Object.keys(
  act5StoryNarrationCatalog,
).filter((cueId): cueId is Act5StoryTargetCueId =>
  /^act5\.story\.(reference|\d{4}_\d{4})\.(winter|spring|summer|autumn)$/.test(
    cueId,
  ),
);

export const act5StoryPeriodTransitionCueIds: Act5StoryPeriodTransitionCueId[] =
  [
    "act5.story.transition.2000_2004",
    "act5.story.transition.2005_2009",
    "act5.story.transition.2010_2014",
    "act5.story.transition.2015_2019",
  ];

export const act5StoryCompletionCueIds: Act5StoryCompletionCueId[] = [
  "act5.story.completed.embodied",
  "act5.story.completed.seasons",
  "act5.story.completed.maximum",
  "act5.story.completed.maximumContext",
  "act5.story.completed.migration",
];

const spokenDigits = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
] as const;

const getSpokenDigit = (value: number) => spokenDigits[value] ?? String(value);

export const formatSpokenClimateDifference = (value: number) => {
  const rounded = Math.round(Math.abs(value) * 10) / 10;
  const whole = Math.trunc(rounded);
  const tenth = Math.round((rounded - whole) * 10);

  if (tenth === 0) {
    return getSpokenDigit(whole);
  }

  if (whole === 0) {
    return `point ${getSpokenDigit(tenth)}`;
  }

  return `${getSpokenDigit(whole)} point ${getSpokenDigit(tenth)}`;
};

export const formatSpokenClimateDelta = formatSpokenClimateDifference;

export const resolveAct5StoryPeriodTransitionCue = (
  completedPeriod: string,
): Act5StoryNarrationCue | null => {
  const periodId = completedPeriod.replace("-", "_") as Act5StoryPeriodId;

  if (periodId === "reference" || periodId === "2020_2024") return null;

  return (
    act5StoryNarrationCatalog[
      `act5.story.transition.${periodId}` as Act5StoryPeriodTransitionCueId
    ] ?? null
  );
};

const getStoryPeriodId = (target: Act5SequenceTarget): Act5StoryPeriodId => {
  const interval = target.climateData?.interval ?? target.interval;

  return interval === "1995-1999"
    ? "reference"
    : (interval?.replace("-", "_") as Act5StoryPeriodId);
};

export const resolveAct5StoryNarrationCue = (
  target: Act5SequenceTarget,
): Act5StoryNarrationResolution | null => {
  if (target.context !== "climateStory" || !target.climateData) return null;

  const periodId = getStoryPeriodId(target);
  const cueId =
    periodId === "reference"
      ? (`act5.story.reference.${target.season}` as const)
      : (`act5.story.${periodId}.${target.season}` as const);
  const cue = act5StoryNarrationCatalog[cueId];

  if (!cue) return null;

  const delta = target.climateData.displayValue;

  return {
    cue,
    params: {
      period: target.climateData.interval,
      season: target.season,
      temperature: formatSpokenClimateDelta(target.climateData.absoluteValue),
      delta: formatSpokenClimateDelta(delta),
      deltaAbs: formatSpokenClimateDelta(delta),
      deltaSpoken: formatSpokenClimateDifference(delta),
      deltaAbsSpoken: formatSpokenClimateDifference(delta),
      normalizedDifference: target.climateData.normalizedValue,
      movementValue: formatSpokenPercent(target.movementValue),
    },
  };
};
