import type { StoryAct } from "~/story/types";

export const prologue = {
  id: "prologue",
  title: "Prologue",
  layout: "movement-only",
  scenes: [
    {
      id: "arrival",
      title: "A body enters the data story",
      narration: "Placeholder scene for introducing the embodied story.",
    },
    {
      id: "orientation",
      title: "Learning to read movement as data",
      narration: "Placeholder scene for setting up the interaction language.",
    },
  ],
  nextActId: "act-2",
} satisfies StoryAct;
