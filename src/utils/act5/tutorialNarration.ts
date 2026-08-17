import type {
  Act5FlowId,
  Act5SequenceTarget,
  Act5TutorialTarget,
} from "~/types/act5";
import type { ClimateSeason } from "~/types/climate";

export type Act5TutorialNarrationCueId =
  | "act5.tutorial.intro.context"
  | "act5.tutorial.intro.encoding"
  | "act5.tutorial.intro.scale"
  | "act5.tutorial.intro.range"
  | "act5.tutorial.intro.measureLength"
  | "act5.tutorial.intro.watchThenMove"
  | `act5.tutorial.${ClimateSeason}.encoding`
  | `act5.tutorial.${ClimateSeason}.${Act5TutorialTarget}`
  | `act5.tutorial.${ClimateSeason}.complete`
  | "act5.tutorial.complete";

export type Act5TutorialNarrationCue = {
  id: Act5TutorialNarrationCueId;
  textKey: string;
  speak: boolean;
  priority: number;
};

export type Act5TutorialNarrationResolution = {
  cues: Act5TutorialNarrationCue[];
  params: Record<string, string | number>;
};

const INTRO_CUE_IDS = [
  "act5.tutorial.intro.context",
  "act5.tutorial.intro.encoding",
  "act5.tutorial.intro.scale",
  "act5.tutorial.intro.range",
  "act5.tutorial.intro.measureLength",
  "act5.tutorial.intro.watchThenMove",
] as const satisfies readonly Act5TutorialNarrationCueId[];

export const ACT5_TUTORIAL_NARRATION_WORDS_PER_MINUTE = 170;

const createCue = (
  id: Act5TutorialNarrationCueId,
  textKey: string,
  options: Pick<Act5TutorialNarrationCue, "speak" | "priority"> = {
    speak: true,
    priority: 50,
  },
): Act5TutorialNarrationCue => ({
  id,
  textKey,
  ...options,
});

export const act5TutorialNarrationCatalog = {
  "act5.tutorial.intro.context": createCue(
    "act5.tutorial.intro.context",
    "story.acts.act5.narration.tutorial.intro.context",
    { speak: true, priority: 50 },
  ),
  "act5.tutorial.intro.encoding": createCue(
    "act5.tutorial.intro.encoding",
    "story.acts.act5.narration.tutorial.intro.encoding",
    { speak: true, priority: 50 },
  ),
  "act5.tutorial.intro.scale": createCue(
    "act5.tutorial.intro.scale",
    "story.acts.act5.narration.tutorial.intro.scale",
    { speak: true, priority: 50 },
  ),
  "act5.tutorial.intro.range": createCue(
    "act5.tutorial.intro.range",
    "story.acts.act5.narration.tutorial.intro.range",
    { speak: true, priority: 50 },
  ),
  "act5.tutorial.intro.measureLength": createCue(
    "act5.tutorial.intro.measureLength",
    "story.acts.act5.narration.tutorial.intro.measureLength",
    { speak: true, priority: 50 },
  ),
  "act5.tutorial.intro.watchThenMove": createCue(
    "act5.tutorial.intro.watchThenMove",
    "story.acts.act5.narration.tutorial.intro.watchThenMove",
    { speak: true, priority: 50 },
  ),
  "act5.tutorial.winter.encoding": createCue(
    "act5.tutorial.winter.encoding",
    "story.acts.act5.narration.tutorial.winter.encoding",
    { speak: true, priority: 55 },
  ),
  "act5.tutorial.winter.maximum": createCue(
    "act5.tutorial.winter.maximum",
    "story.acts.act5.narration.tutorial.winter.maximum",
    { speak: true, priority: 60 },
  ),
  "act5.tutorial.winter.minimum": createCue(
    "act5.tutorial.winter.minimum",
    "story.acts.act5.narration.tutorial.winter.minimum",
    { speak: true, priority: 60 },
  ),
  "act5.tutorial.winter.complete": createCue(
    "act5.tutorial.winter.complete",
    "story.acts.act5.narration.tutorial.winter.complete",
    { speak: true, priority: 65 },
  ),
  "act5.tutorial.spring.encoding": createCue(
    "act5.tutorial.spring.encoding",
    "story.acts.act5.narration.tutorial.spring.encoding",
    { speak: true, priority: 55 },
  ),
  "act5.tutorial.spring.maximum": createCue(
    "act5.tutorial.spring.maximum",
    "story.acts.act5.narration.tutorial.spring.maximum",
    { speak: true, priority: 60 },
  ),
  "act5.tutorial.spring.minimum": createCue(
    "act5.tutorial.spring.minimum",
    "story.acts.act5.narration.tutorial.spring.minimum",
    { speak: true, priority: 60 },
  ),
  "act5.tutorial.spring.complete": createCue(
    "act5.tutorial.spring.complete",
    "story.acts.act5.narration.tutorial.spring.complete",
    { speak: true, priority: 65 },
  ),
  "act5.tutorial.summer.encoding": createCue(
    "act5.tutorial.summer.encoding",
    "story.acts.act5.narration.tutorial.summer.encoding",
    { speak: true, priority: 55 },
  ),
  "act5.tutorial.summer.maximum": createCue(
    "act5.tutorial.summer.maximum",
    "story.acts.act5.narration.tutorial.summer.maximum",
    { speak: true, priority: 60 },
  ),
  "act5.tutorial.summer.minimum": createCue(
    "act5.tutorial.summer.minimum",
    "story.acts.act5.narration.tutorial.summer.minimum",
    { speak: true, priority: 60 },
  ),
  "act5.tutorial.summer.complete": createCue(
    "act5.tutorial.summer.complete",
    "story.acts.act5.narration.tutorial.summer.complete",
    { speak: true, priority: 65 },
  ),
  "act5.tutorial.autumn.encoding": createCue(
    "act5.tutorial.autumn.encoding",
    "story.acts.act5.narration.tutorial.autumn.encoding",
    { speak: true, priority: 55 },
  ),
  "act5.tutorial.autumn.maximum": createCue(
    "act5.tutorial.autumn.maximum",
    "story.acts.act5.narration.tutorial.autumn.maximum",
    { speak: true, priority: 60 },
  ),
  "act5.tutorial.autumn.minimum": createCue(
    "act5.tutorial.autumn.minimum",
    "story.acts.act5.narration.tutorial.autumn.minimum",
    { speak: true, priority: 60 },
  ),
  "act5.tutorial.autumn.complete": createCue(
    "act5.tutorial.autumn.complete",
    "story.acts.act5.narration.tutorial.autumn.complete",
    { speak: true, priority: 65 },
  ),
  "act5.tutorial.complete": createCue("act5.tutorial.complete", "", {
    speak: false,
    priority: 70,
  }),
} as const satisfies Record<
  Act5TutorialNarrationCueId,
  Act5TutorialNarrationCue
>;

export const formatSpokenPercent = (value: number) => {
  const formatted = String(value).replace(/\.0$/, "");

  return value < 0 ? `minus ${formatted.slice(1)}` : formatted;
};

export const countAct5TutorialNarrationWords = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;

export const estimateAct5TutorialSpeechDurationMs = (text: string) =>
  Math.round(
    (countAct5TutorialNarrationWords(text) * 60_000) /
      ACT5_TUTORIAL_NARRATION_WORDS_PER_MINUTE +
      150,
  );

const resolveTargetCueId = (
  target: Act5SequenceTarget,
): Act5TutorialNarrationCueId | null => {
  if (target.context !== "tutorial" || !target.target) return null;

  return `act5.tutorial.${target.season}.${target.target}`;
};

const resolveEncodingCueId = (
  target: Act5SequenceTarget,
): Act5TutorialNarrationCueId | null => {
  if (
    target.context !== "tutorial" ||
    target.target !== "maximum" ||
    target.movementValue !== 100
  ) {
    return null;
  }

  return `act5.tutorial.${target.season}.encoding`;
};

const shouldPlayGlobalIntro = ({
  target,
  targetIndex,
  includeGlobalIntro,
}: {
  target: Act5SequenceTarget;
  targetIndex: number;
  includeGlobalIntro: boolean;
}) =>
  includeGlobalIntro &&
  targetIndex === 0 &&
  target.context === "tutorial" &&
  target.season === "winter" &&
  target.target === "maximum";

export const resolveAct5TutorialNarration = ({
  target,
  targetIndex,
  flowId,
  includeGlobalIntro = flowId === "act5Full" || flowId === "act5TutorialDebug",
}: {
  target: Act5SequenceTarget;
  targetIndex: number;
  flowId: Act5FlowId | null;
  includeGlobalIntro?: boolean;
}): Act5TutorialNarrationResolution => {
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
    cues: cueIds.map((cueId) => act5TutorialNarrationCatalog[cueId]),
    params: {
      value: formatSpokenPercent(target.movementValue),
    },
  };
};

export const resolveAct5SeasonCompletionNarration = (
  target: Act5SequenceTarget,
) => {
  if (target.context !== "tutorial" || target.target !== "minimum") {
    return null;
  }

  return act5TutorialNarrationCatalog[
    `act5.tutorial.${target.season}.complete`
  ];
};

export const resolveAct5TutorialCompleteNarration = () =>
  act5TutorialNarrationCatalog["act5.tutorial.complete"];
