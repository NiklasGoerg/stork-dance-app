import type { StoryAct } from "~/story/types";

export const prologue = {
  id: "prologue",
  title: "Prologue",
  titleKey: "story.acts.prologue.title",
  layout: "fullscreen",
  scenes: [
    {
      id: "white-stork",
      title: "The white stork",
      titleKey: "story.acts.prologue.scenes.whiteStork.title",
      narration:
        "The white stork is one of Europe's most iconic and recognizable birds.",
      narrationKey: "story.acts.prologue.narration.whiteStork",
    },
    {
      id: "real-route",
      title: "A real migration route",
      titleKey: "story.acts.prologue.scenes.realRoute.title",
      narration:
        "This story follows real routes of real white storks, using GPS tracking and environmental data.",
      narrationKey: "story.acts.prologue.narration.realData",
    },
  ],
  nextActId: "act-2",
} satisfies StoryAct;
