import type { StoryAct } from "~/story/types";

export const act5 = {
  id: "act-5",
  title: "Act 5 - Climate Act",
  layout: "climate-stage",
  scenes: [
    {
      id: "intro",
      title: "A climate pattern enters the movement",
      narration: "Placeholder scene for Act 5.",
    },
  ],
  nextActId: "epilogue",
} satisfies StoryAct;
