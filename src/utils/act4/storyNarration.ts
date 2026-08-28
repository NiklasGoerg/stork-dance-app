import type { Act4SequenceTarget } from "~/types/act4";
import type { ClimateSeason } from "~/types/climate";
import {
  climateChangeFlow,
  getClimateChangeFlowPeriodById,
  getClimateChangeFlowPeriodByInterval,
  getClimateChangeFlowStoryPeriodTransitionCueId,
  getClimateChangeFlowStoryTargetCueId,
  getClimateChangeFlowStoryTargetCueIds,
  type ClimateChangeFlowPeriodId,
} from "~/story/acts/climateChangeFlow";
import { formatSpokenPercent } from "~/utils/act4/tutorialNarration";

export type Act4StoryPeriodId = ClimateChangeFlowPeriodId;

export type Act4StoryTargetCueId =
  | `act4.story.reference.${ClimateSeason}`
  | `act4.story.${Exclude<Act4StoryPeriodId, "reference">}.${ClimateSeason}`;

export type Act4StoryPeriodTransitionCueId = `act4.story.transition.${Exclude<
  Act4StoryPeriodId,
  "reference" | "2020_2024"
>}`;

export type Act4StoryCompletionCueId =
  | "act4.story.completed.embodied"
  | "act4.story.completed.seasons"
  | "act4.story.completed.maximum"
  | "act4.story.completed.maximumContext"
  | "act4.story.completed.migration";

export type Act4StoryNarrationCueId =
  | "act4.story.intro.chart"
  | "act4.story.intro.reference"
  | Act4StoryTargetCueId
  | Act4StoryPeriodTransitionCueId
  | "act4.story.reference.complete"
  | "act4.story.reference.scale"
  | Act4StoryCompletionCueId;

export type Act4StoryNarrationCue = {
  id: Act4StoryNarrationCueId;
  textKey: string;
  speak: boolean;
  display: boolean;
  priority: number;
};

export type Act4StoryNarrationResolution = {
  cue: Act4StoryNarrationCue;
  params: Record<string, string | number>;
};

const createCue = (
  id: Act4StoryNarrationCueId,
  textKey: string,
  options: Pick<Act4StoryNarrationCue, "speak" | "display" | "priority"> = {
    speak: true,
    display: true,
    priority: 50,
  },
): Act4StoryNarrationCue => ({
  id,
  textKey,
  ...options,
});

export const act4StoryNarrationCatalog = {
  "act4.story.intro.chart": createCue(
    "act4.story.intro.chart",
    "story.acts.act4.narration.story.intro.chart",
  ),
  "act4.story.intro.reference": createCue(
    "act4.story.intro.reference",
    "story.acts.act4.narration.story.intro.reference",
  ),
  "act4.story.reference.winter": createCue(
    "act4.story.reference.winter",
    "story.acts.act4.narration.story.reference.winter",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.reference.spring": createCue(
    "act4.story.reference.spring",
    "story.acts.act4.narration.story.reference.spring",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.reference.summer": createCue(
    "act4.story.reference.summer",
    "story.acts.act4.narration.story.reference.summer",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.reference.autumn": createCue(
    "act4.story.reference.autumn",
    "story.acts.act4.narration.story.reference.autumn",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.reference.complete": createCue(
    "act4.story.reference.complete",
    "story.acts.act4.narration.story.referenceComplete.summary",
  ),
  "act4.story.reference.scale": createCue(
    "act4.story.reference.scale",
    "story.acts.act4.narration.story.referenceComplete.scale",
  ),
  "act4.story.2000_2004.winter": createCue(
    "act4.story.2000_2004.winter",
    "story.acts.act4.narration.story.2000_2004.winter",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2000_2004.spring": createCue(
    "act4.story.2000_2004.spring",
    "story.acts.act4.narration.story.2000_2004.spring",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2000_2004.summer": createCue(
    "act4.story.2000_2004.summer",
    "story.acts.act4.narration.story.2000_2004.summer",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2000_2004.autumn": createCue(
    "act4.story.2000_2004.autumn",
    "story.acts.act4.narration.story.2000_2004.autumn",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2005_2009.winter": createCue(
    "act4.story.2005_2009.winter",
    "story.acts.act4.narration.story.2005_2009.winter",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2005_2009.spring": createCue(
    "act4.story.2005_2009.spring",
    "story.acts.act4.narration.story.2005_2009.spring",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2005_2009.summer": createCue(
    "act4.story.2005_2009.summer",
    "story.acts.act4.narration.story.2005_2009.summer",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2005_2009.autumn": createCue(
    "act4.story.2005_2009.autumn",
    "story.acts.act4.narration.story.2005_2009.autumn",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2010_2014.winter": createCue(
    "act4.story.2010_2014.winter",
    "story.acts.act4.narration.story.2010_2014.winter",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2010_2014.spring": createCue(
    "act4.story.2010_2014.spring",
    "story.acts.act4.narration.story.2010_2014.spring",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2010_2014.summer": createCue(
    "act4.story.2010_2014.summer",
    "story.acts.act4.narration.story.2010_2014.summer",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2010_2014.autumn": createCue(
    "act4.story.2010_2014.autumn",
    "story.acts.act4.narration.story.2010_2014.autumn",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2015_2019.winter": createCue(
    "act4.story.2015_2019.winter",
    "story.acts.act4.narration.story.2015_2019.winter",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2015_2019.spring": createCue(
    "act4.story.2015_2019.spring",
    "story.acts.act4.narration.story.2015_2019.spring",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2015_2019.summer": createCue(
    "act4.story.2015_2019.summer",
    "story.acts.act4.narration.story.2015_2019.summer",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2015_2019.autumn": createCue(
    "act4.story.2015_2019.autumn",
    "story.acts.act4.narration.story.2015_2019.autumn",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2020_2024.winter": createCue(
    "act4.story.2020_2024.winter",
    "story.acts.act4.narration.story.2020_2024.winter",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2020_2024.spring": createCue(
    "act4.story.2020_2024.spring",
    "story.acts.act4.narration.story.2020_2024.spring",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2020_2024.summer": createCue(
    "act4.story.2020_2024.summer",
    "story.acts.act4.narration.story.2020_2024.summer",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.2020_2024.autumn": createCue(
    "act4.story.2020_2024.autumn",
    "story.acts.act4.narration.story.2020_2024.autumn",
    { speak: true, display: false, priority: 50 },
  ),
  "act4.story.transition.2000_2004": createCue(
    "act4.story.transition.2000_2004",
    "story.acts.act4.narration.story.transition.2000_2004",
  ),
  "act4.story.transition.2005_2009": createCue(
    "act4.story.transition.2005_2009",
    "story.acts.act4.narration.story.transition.2005_2009",
  ),
  "act4.story.transition.2010_2014": createCue(
    "act4.story.transition.2010_2014",
    "story.acts.act4.narration.story.transition.2010_2014",
  ),
  "act4.story.transition.2015_2019": createCue(
    "act4.story.transition.2015_2019",
    "story.acts.act4.narration.story.transition.2015_2019",
  ),
  "act4.story.completed.embodied": createCue(
    "act4.story.completed.embodied",
    "story.acts.act4.narration.story.completed.embodied",
  ),
  "act4.story.completed.seasons": createCue(
    "act4.story.completed.seasons",
    "story.acts.act4.narration.story.completed.seasons",
  ),
  "act4.story.completed.maximum": createCue(
    "act4.story.completed.maximum",
    "story.acts.act4.narration.story.completed.maximum",
  ),
  "act4.story.completed.maximumContext": createCue(
    "act4.story.completed.maximumContext",
    "story.acts.act4.narration.story.completed.maximumContext",
  ),
  "act4.story.completed.migration": createCue(
    "act4.story.completed.migration",
    "story.acts.act4.narration.story.completed.migration",
  ),
} as const satisfies Record<Act4StoryNarrationCueId, Act4StoryNarrationCue>;

export const act4StoryTargetCueIds = Object.keys(
  act4StoryNarrationCatalog,
).filter((cueId): cueId is Act4StoryTargetCueId =>
  getClimateChangeFlowStoryTargetCueIds().includes(cueId),
);

export const act4StoryPeriodTransitionCueIds: Act4StoryPeriodTransitionCueId[] =
  climateChangeFlow.periodTransitionCues.map(
    (cue) => cue.cueId as Act4StoryPeriodTransitionCueId,
  );

export const act4StoryCompletionCueIds: Act4StoryCompletionCueId[] = [
  ...climateChangeFlow.completionCues.map(
    (cue) => cue.cueId as Act4StoryCompletionCueId,
  ),
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

export const resolveAct4StoryPeriodTransitionCue = (
  completedPeriod: string,
): Act4StoryNarrationCue | null => {
  const period =
    getClimateChangeFlowPeriodByInterval(completedPeriod) ??
    getClimateChangeFlowPeriodById(
      completedPeriod.replace("-", "_") as Act4StoryPeriodId,
    );
  if (!period) return null;

  const cueId = getClimateChangeFlowStoryPeriodTransitionCueId(period.id);
  if (!cueId) return null;

  return (
    act4StoryNarrationCatalog[cueId as Act4StoryPeriodTransitionCueId] ?? null
  );
};

const getStoryPeriodId = (target: Act4SequenceTarget): Act4StoryPeriodId => {
  const interval = target.climateData?.interval ?? target.interval;
  const period = interval
    ? getClimateChangeFlowPeriodByInterval(interval)
    : null;

  return period?.id ?? (interval?.replace("-", "_") as Act4StoryPeriodId);
};

export const resolveAct4StoryNarrationCue = (
  target: Act4SequenceTarget,
): Act4StoryNarrationResolution | null => {
  if (target.context !== "climateStory" || !target.climateData) return null;

  const periodId = getStoryPeriodId(target);
  const cueId = getClimateChangeFlowStoryTargetCueId(
    periodId,
    target.season,
  ) as Act4StoryTargetCueId;
  const cue = act4StoryNarrationCatalog[cueId];

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
