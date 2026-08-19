import type { StoryAct } from "~/story/types";

export const act4 = {
  id: "act-4",
  title: "Act 4 - Climate Act",
  titleKey: "story.acts.act4.title",
  layout: "climate-stage",
  scenes: [
    {
      id: "intro",
      title: "Movement Introduction",
      titleKey: "story.acts.act4.scenes.intro.title",
      narration: "Learn each seasonal movement at full intensity.",
      narrationKey: "story.acts.act4.scenes.intro.narration",
    },
  ],
  nextActId: "epilogue",
} satisfies StoryAct;
