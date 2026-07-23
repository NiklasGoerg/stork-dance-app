import type { StoryAct } from "~/story/types";

export const act5 = {
  id: "act-5",
  title: "Act 5 - Climate Act",
  titleKey: "story.acts.act5.title",
  layout: "climate-stage",
  scenes: [
    {
      id: "intro",
      title: "A climate pattern enters the movement",
      titleKey: "story.acts.act5.scenes.intro.title",
      narration: "Placeholder scene for Act 5.",
      narrationKey: "story.acts.act5.scenes.intro.narration",
    },
  ],
  nextActId: "epilogue",
} satisfies StoryAct;
