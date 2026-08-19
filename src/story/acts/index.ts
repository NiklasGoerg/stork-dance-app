import { act2 } from "~/story/acts/act2";
import { act3 } from "~/story/acts/act3";
import { act4 } from "~/story/acts/act4";
import { epilogue } from "~/story/acts/epilogue";
import { prologue } from "~/story/acts/prologue";
import type { StoryAct, StoryActId } from "~/story/types";

export const storyActs = [
  prologue,
  act2,
  act3,
  act4,
  epilogue,
] satisfies StoryAct[];

export const storyActsById: Record<StoryActId, StoryAct> = {
  prologue,
  "act-2": act2,
  "act-3": act3,
  "act-4": act4,
  epilogue,
};

export const getStoryAct = (actId: StoryActId) => storyActsById[actId];
