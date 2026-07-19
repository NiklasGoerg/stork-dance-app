import type { StoryAct } from "~/story/types";

export const act3 = {
  id: "act-3",
  title: "Act 3 - Distance and Timing",
  layout: "migration-stage",
  scenes: [
    {
      id: "intro",
      title: "Comparing migration rhythms",
      narration: "Placeholder scene for Act 3.",
    },
  ],
  nextActId: "act-4",
} satisfies StoryAct;
