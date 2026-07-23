import type { StoryAct } from "~/story/types";
import { STORY_AUDIO_CONFIG } from "~/utils/storyAudioConfig";

export const act2 = {
  id: "act-2",
  title: "Act 2 - The Migration Cycle",
  titleKey: "story.acts.act2.title",
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
      titleKey: "story.acts.act2.scenes.intro.title",
      narration:
        "Follow one stork across the yearly route between Europe and Africa.",
      narrationKey: "story.acts.act2.scenes.intro.narration",
    },
    {
      id: "cycle-repeat",
      title: "Repeating the route",
      titleKey: "story.acts.act2.scenes.cycleRepeat.title",
      narration:
        "The route repeats as the season clock and map move through the same cycle.",
      narrationKey: "story.acts.act2.scenes.cycleRepeat.narration",
    },
    {
      id: "completion",
      title: "Completing the cycle",
      titleKey: "story.acts.act2.scenes.completion.title",
      narration: "The third cycle completes Act 2.",
      narrationKey: "story.acts.act2.scenes.completion.narration",
    },
  ],
  nextActId: "act-3",
} satisfies StoryAct;
