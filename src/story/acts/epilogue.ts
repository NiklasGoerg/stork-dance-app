import type { StoryAct } from "~/story/types";

export const epilogue = {
  id: "epilogue",
  title: "Epilogue",
  titleKey: "story.acts.epilogue.title",
  layout: "fullscreen",
  scenes: [
    {
      id: "reflection",
      title: "Returning from the data story",
      titleKey: "story.acts.epilogue.scenes.reflection.title",
      narration: "Placeholder scene for the closing reflection.",
      narrationKey: "story.acts.epilogue.scenes.reflection.narration",
    },
  ],
} satisfies StoryAct;
