import type { StoryAct } from "~/story/types";

export const act5 = {
  id: "act-5",
  title: "Act 5 - Climate Act",
  titleKey: "story.acts.act5.title",
  layout: "climate-stage",
  scenes: [
    {
      id: "intro",
      title: "Movement Introduction",
      titleKey: "story.acts.act5.scenes.intro.title",
      narration: "Learn each seasonal movement at full intensity.",
      narrationKey: "story.acts.act5.scenes.intro.narration",
    },
  ],
  nextActId: "epilogue",
} satisfies StoryAct;
