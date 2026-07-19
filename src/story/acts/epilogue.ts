import type { StoryAct } from "~/story/types";

export const epilogue = {
  id: "epilogue",
  title: "Epilogue",
  layout: "fullscreen",
  scenes: [
    {
      id: "reflection",
      title: "Returning from the data story",
      narration: "Placeholder scene for the closing reflection.",
    },
  ],
} satisfies StoryAct;
