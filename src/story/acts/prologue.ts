import type { StoryAct } from "~/story/types";

export const prologue = {
  id: "prologue",
  title: "Prologue",
  titleKey: "story.acts.prologue.title",
  layout: "movement-only",
  scenes: [
    {
      id: "arrival",
      title: "A body enters the data story",
      titleKey: "story.acts.prologue.scenes.arrival.title",
      narration: "Placeholder scene for introducing the embodied story.",
      narrationKey: "story.acts.prologue.scenes.arrival.narration",
    },
    {
      id: "orientation",
      title: "Learning to read movement as data",
      titleKey: "story.acts.prologue.scenes.orientation.title",
      narration: "Placeholder scene for setting up the interaction language.",
      narrationKey: "story.acts.prologue.scenes.orientation.narration",
    },
  ],
  nextActId: "act-2",
} satisfies StoryAct;
