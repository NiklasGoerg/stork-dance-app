import type {
  Act4FlowId,
  Act4SequenceTarget,
  Act4TutorialTarget,
} from "~/types/act4";
import type { ClimateSeason } from "~/types/climate";
import {
  climateChangeFlow,
  getClimateChangeFlowTutorialEncodingCueId,
  getClimateChangeFlowTutorialSeasonCompletionCueId,
  getClimateChangeFlowTutorialTargetCueId,
} from "~/story/acts/climateChangeFlow";

export type Act4TutorialNarrationCueId =
  | "act4.tutorial.intro.context"
  | "act4.tutorial.intro.encoding"
  | "act4.tutorial.intro.scale"
  | "act4.tutorial.intro.range"
  | "act4.tutorial.intro.measureLength"
  | "act4.tutorial.intro.watchThenMove"
  | `act4.tutorial.${ClimateSeason}.encoding`
  | "act4.tutorial.winter.example"
  | `act4.tutorial.${ClimateSeason}.${Exclude<Act4TutorialTarget, "example">}`
  | `act4.tutorial.${ClimateSeason}.complete`
  | "act4.tutorial.complete";

export type Act4TutorialNarrationCue = {
  id: Act4TutorialNarrationCueId;
  textKey: string;
  speak: boolean;
  priority: number;
};

export type Act4TutorialNarrationResolution = {
  cues: Act4TutorialNarrationCue[];
  params: Record<string, string | number>;
};

const INTRO_CUE_IDS = climateChangeFlow.tutorialIntroCues.map(
  (cue) => cue.cueId as Act4TutorialNarrationCueId,
);

export const ACT4_TUTORIAL_NARRATION_WORDS_PER_MINUTE = 170;

const createCue = (
  id: Act4TutorialNarrationCueId,
  textKey: string,
  options: Pick<Act4TutorialNarrationCue, "speak" | "priority"> = {
    speak: true,
    priority: 50,
  },
): Act4TutorialNarrationCue => ({
  id,
  textKey,
  ...options,
});

export const act4TutorialNarrationCatalog = {
  "act4.tutorial.intro.context": createCue(
    "act4.tutorial.intro.context",
    "story.acts.act4.narration.tutorial.intro.context",
    { speak: true, priority: 50 },
  ),
  "act4.tutorial.intro.encoding": createCue(
    "act4.tutorial.intro.encoding",
    "story.acts.act4.narration.tutorial.intro.encoding",
    { speak: true, priority: 50 },
  ),
  "act4.tutorial.intro.scale": createCue(
    "act4.tutorial.intro.scale",
    "story.acts.act4.narration.tutorial.intro.scale",
    { speak: true, priority: 50 },
  ),
  "act4.tutorial.intro.range": createCue(
    "act4.tutorial.intro.range",
    "story.acts.act4.narration.tutorial.intro.range",
    { speak: true, priority: 50 },
  ),
  "act4.tutorial.intro.measureLength": createCue(
    "act4.tutorial.intro.measureLength",
    "story.acts.act4.narration.tutorial.intro.measureLength",
    { speak: true, priority: 50 },
  ),
  "act4.tutorial.intro.watchThenMove": createCue(
    "act4.tutorial.intro.watchThenMove",
    "story.acts.act4.narration.tutorial.intro.watchThenMove",
    { speak: true, priority: 50 },
  ),
  "act4.tutorial.winter.encoding": createCue(
    "act4.tutorial.winter.encoding",
    "story.acts.act4.narration.tutorial.winter.encoding",
    { speak: true, priority: 55 },
  ),
  "act4.tutorial.winter.example": createCue(
    "act4.tutorial.winter.example",
    "story.acts.act4.narration.tutorial.winter.example",
    { speak: true, priority: 60 },
  ),
  "act4.tutorial.winter.maximum": createCue(
    "act4.tutorial.winter.maximum",
    "story.acts.act4.narration.tutorial.winter.maximum",
    { speak: true, priority: 60 },
  ),
  "act4.tutorial.winter.minimum": createCue(
    "act4.tutorial.winter.minimum",
    "story.acts.act4.narration.tutorial.winter.minimum",
    { speak: true, priority: 60 },
  ),
  "act4.tutorial.winter.complete": createCue(
    "act4.tutorial.winter.complete",
    "story.acts.act4.narration.tutorial.winter.complete",
    { speak: true, priority: 65 },
  ),
  "act4.tutorial.spring.encoding": createCue(
    "act4.tutorial.spring.encoding",
    "story.acts.act4.narration.tutorial.spring.encoding",
    { speak: true, priority: 55 },
  ),
  "act4.tutorial.spring.maximum": createCue(
    "act4.tutorial.spring.maximum",
    "story.acts.act4.narration.tutorial.spring.maximum",
    { speak: true, priority: 60 },
  ),
  "act4.tutorial.spring.minimum": createCue(
    "act4.tutorial.spring.minimum",
    "story.acts.act4.narration.tutorial.spring.minimum",
    { speak: true, priority: 60 },
  ),
  "act4.tutorial.spring.complete": createCue(
    "act4.tutorial.spring.complete",
    "story.acts.act4.narration.tutorial.spring.complete",
    { speak: true, priority: 65 },
  ),
  "act4.tutorial.summer.encoding": createCue(
    "act4.tutorial.summer.encoding",
    "story.acts.act4.narration.tutorial.summer.encoding",
    { speak: true, priority: 55 },
  ),
  "act4.tutorial.summer.maximum": createCue(
    "act4.tutorial.summer.maximum",
    "story.acts.act4.narration.tutorial.summer.maximum",
    { speak: true, priority: 60 },
  ),
  "act4.tutorial.summer.minimum": createCue(
    "act4.tutorial.summer.minimum",
    "story.acts.act4.narration.tutorial.summer.minimum",
    { speak: true, priority: 60 },
  ),
  "act4.tutorial.summer.complete": createCue(
    "act4.tutorial.summer.complete",
    "story.acts.act4.narration.tutorial.summer.complete",
    { speak: true, priority: 65 },
  ),
  "act4.tutorial.autumn.encoding": createCue(
    "act4.tutorial.autumn.encoding",
    "story.acts.act4.narration.tutorial.autumn.encoding",
    { speak: true, priority: 55 },
  ),
  "act4.tutorial.autumn.maximum": createCue(
    "act4.tutorial.autumn.maximum",
    "story.acts.act4.narration.tutorial.autumn.maximum",
    { speak: true, priority: 60 },
  ),
  "act4.tutorial.autumn.minimum": createCue(
    "act4.tutorial.autumn.minimum",
    "story.acts.act4.narration.tutorial.autumn.minimum",
    { speak: true, priority: 60 },
  ),
  "act4.tutorial.autumn.complete": createCue(
    "act4.tutorial.autumn.complete",
    "story.acts.act4.narration.tutorial.autumn.complete",
    { speak: true, priority: 65 },
  ),
  "act4.tutorial.complete": createCue("act4.tutorial.complete", "", {
    speak: false,
    priority: 70,
  }),
} as const satisfies Record<
  Act4TutorialNarrationCueId,
  Act4TutorialNarrationCue
>;

export const formatSpokenPercent = (value: number) => {
  const formatted = String(value).replace(/\.0$/, "");

  return value < 0 ? `minus ${formatted.slice(1)}` : formatted;
};

export const countAct4TutorialNarrationWords = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;

export const estimateAct4TutorialSpeechDurationMs = (text: string) =>
  Math.round(
    (countAct4TutorialNarrationWords(text) * 60_000) /
      ACT4_TUTORIAL_NARRATION_WORDS_PER_MINUTE +
      150,
  );

const resolveTargetCueId = (
  target: Act4SequenceTarget,
): Act4TutorialNarrationCueId | null => {
  if (target.context !== "tutorial" || !target.target) return null;

  return getClimateChangeFlowTutorialTargetCueId(
    target.season,
    target.target,
  ) as Act4TutorialNarrationCueId;
};

const resolveEncodingCueId = (
  target: Act4SequenceTarget,
): Act4TutorialNarrationCueId | null => {
  if (
    target.context !== "tutorial" ||
    (target.target !== "example" &&
      (target.target !== "maximum" ||
        target.movementValue !== 100 ||
        target.season === "winter"))
  ) {
    return null;
  }

  return getClimateChangeFlowTutorialEncodingCueId(
    target.season,
  ) as Act4TutorialNarrationCueId;
};

const shouldPlayGlobalIntro = ({
  target,
  targetIndex,
  includeGlobalIntro,
}: {
  target: Act4SequenceTarget;
  targetIndex: number;
  includeGlobalIntro: boolean;
}) =>
  includeGlobalIntro &&
  targetIndex === 0 &&
  target.context === "tutorial" &&
  target.season === "winter" &&
  target.target === "example";

export const resolveAct4TutorialNarration = ({
  target,
  targetIndex,
  flowId,
  includeGlobalIntro = flowId === "act4Full" || flowId === "act4TutorialDebug",
}: {
  target: Act4SequenceTarget;
  targetIndex: number;
  flowId: Act4FlowId | null;
  includeGlobalIntro?: boolean;
}): Act4TutorialNarrationResolution => {
  const targetCueId = resolveTargetCueId(target);
  const encodingCueId = resolveEncodingCueId(target);
  const cueIds = [
    ...(shouldPlayGlobalIntro({ target, targetIndex, includeGlobalIntro })
      ? INTRO_CUE_IDS
      : []),
    ...(encodingCueId ? [encodingCueId] : []),
    ...(targetCueId ? [targetCueId] : []),
  ];

  return {
    cues: cueIds.map((cueId) => act4TutorialNarrationCatalog[cueId]),
    params: {
      value: formatSpokenPercent(target.movementValue),
    },
  };
};

export const resolveAct4SeasonCompletionNarration = (
  target: Act4SequenceTarget,
) => {
  if (target.context !== "tutorial" || target.target !== "minimum") {
    return null;
  }

  return act4TutorialNarrationCatalog[
    getClimateChangeFlowTutorialSeasonCompletionCueId(
      target.season,
    ) as Act4TutorialNarrationCueId
  ];
};

export const resolveAct4TutorialCompleteNarration = () =>
  act4TutorialNarrationCatalog["act4.tutorial.complete"];
