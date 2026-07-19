import type { StoryAct } from "~/story/types";
import { STORY_AUDIO_CONFIG } from "~/utils/storyAudioConfig";

export const act2 = {
  id: "act-2",
  title: "Act 2 - The Migration Cycle",
  layout: "migration-stage",
  cycleId: "individual_3031_2013_2014",
  cycleStartYear: 2013,
  repeatCount: 3,
  instructorMovementId: "test-dance",
  bpm: STORY_AUDIO_CONFIG.bpm,
  scenes: [
    {
      id: "intro",
      title: "The migration cycle begins",
      narration:
        "Follow one stork across the yearly route between Europe and Africa.",
    },
    {
      id: "cycle-repeat",
      title: "Repeating the route",
      narration:
        "The route repeats as the season clock and map move through the same cycle.",
    },
    {
      id: "completion",
      title: "Completing the cycle",
      narration: "The third cycle completes Act 2.",
    },
  ],
  nextActId: "act-3",
} satisfies StoryAct;
