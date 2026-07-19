import type { StoryAct } from "~/story/types";

export const act4 = {
  id: "act-4",
  title: "Act 4 - Changing Cycles",
  layout: "migration-stage",
  scenes: [
    {
      id: "intro",
      title: "Feeling change across seasons",
      narration: "Placeholder scene for Act 4.",
    },
  ],
  nextActId: "act-5",
} satisfies StoryAct;
