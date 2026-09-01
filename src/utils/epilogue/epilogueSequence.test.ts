import { describe, expect, it } from "vitest";
import en from "~/locales/en.json";
import {
  epilogueNarrationCueKeys,
  epilogueRouteLegend,
} from "~/utils/epilogue/epilogueSequence";
import { migrationStoryCycleDefinitions } from "~/utils/migrationStoryData";

describe("epilogue sequence", () => {
  it("uses the authored narration cues in order", () => {
    expect(epilogueNarrationCueKeys).toEqual([
      "story.acts.epilogue.narration.migrationRecap",
      "story.acts.epilogue.narration.climateContext",
      "story.acts.epilogue.narration.causalLimitation",
      "story.acts.epilogue.narration.otherInfluences",
      "story.acts.epilogue.narration.finalReflection",
    ]);
    expect(en.story.acts.epilogue.narration).toMatchObject({
      migrationRecap:
        "Across these five journeys, migration changed in timing, duration, and winter destination.",
      climateContext:
        "Over recent decades, seasonal temperatures in Germany have changed as well.",
      causalLimitation:
        "But these data cannot show that climate alone caused any one stork to change its journey.",
      otherInfluences:
        "Food provided by humans, changed habitats, age, and migration experience may also shape the journey.",
      finalReflection:
        "Climate is one part of the changing environment, not the whole explanation. What will the stork's journey look like in the future?",
    });
  });

  it("builds the five-cycle legend from the existing migration story cycles", () => {
    expect(epilogueRouteLegend.map((route) => route.id)).toEqual(
      migrationStoryCycleDefinitions.map((cycle) => cycle.label),
    );
    expect(epilogueRouteLegend.map((route) => route.label)).toEqual([
      "2013-2014",
      "2016-2017",
      "2018-2019",
      "2020-2021",
      "2022-2023",
    ]);
  });
});
