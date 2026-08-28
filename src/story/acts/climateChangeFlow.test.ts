import { describe, expect, it } from "vitest";
import temperatureSeasonsCsv from "~/assets/climate_data/temperature_seasons_data.csv?raw";
import en from "~/locales/en.json";
import {
  climateChangeFlow,
  getClimateChangeFlowStoryCueIds,
  getClimateChangeFlowStoryTargetCueIds,
  getClimateChangeFlowTutorialCueIds,
} from "~/story/acts/climateChangeFlow";
import { act4StoryNarrationCatalog } from "~/utils/act4/storyNarration";
import { act4TutorialNarrationCatalog } from "~/utils/act4/tutorialNarration";
import { parseClimateSeasonDataCsv } from "~/utils/movement/acts/climate/climateSeasonData";

const getMessageAtPath = (path: string) =>
  path.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    return (value as Record<string, unknown>)[segment];
  }, en);

describe("climate change flow", () => {
  it("declares the public Act 4 flows and deterministic order", () => {
    expect(climateChangeFlow.publicActId).toBe("act-4");
    expect(climateChangeFlow.flows).toEqual({
      full: "act4Full",
      storyOnly: "act4Story",
      tutorialDebug: "act4TutorialDebug",
    });
    expect(climateChangeFlow.seasonOrder).toEqual([
      "winter",
      "spring",
      "summer",
      "autumn",
    ]);
    expect(climateChangeFlow.tutorialTargets).toEqual([
      { season: "winter", target: "maximum" },
      { season: "winter", target: "minimum" },
      { season: "spring", target: "maximum" },
      { season: "spring", target: "minimum" },
      { season: "summer", target: "maximum" },
      { season: "summer", target: "minimum" },
      { season: "autumn", target: "maximum" },
      { season: "autumn", target: "minimum" },
    ]);
  });

  it("aligns story periods with the climate CSV movement rows", () => {
    const result = parseClimateSeasonDataCsv(temperatureSeasonsCsv);

    expect(result.errors).toEqual([]);
    expect(result.dataset).not.toBeNull();

    const movementIntervals = [
      ...new Set(
        result
          .dataset!.rows.filter((row) => row.season !== "annual_mean")
          .map((row) => row.interval),
      ),
    ];

    expect(
      climateChangeFlow.storyPeriods.map((period) => period.interval),
    ).toEqual(movementIntervals);
    expect(climateChangeFlow.storyPeriods.map((period) => period.id)).toEqual([
      "reference",
      "2000_2004",
      "2005_2009",
      "2010_2014",
      "2015_2019",
      "2020_2024",
    ]);
  });

  it("keeps story and tutorial cue inventories aligned with authored catalogs", () => {
    const storyCueIds = getClimateChangeFlowStoryCueIds();
    const tutorialCueIds = getClimateChangeFlowTutorialCueIds();

    expect(new Set(storyCueIds).size).toBe(storyCueIds.length);
    expect(new Set(tutorialCueIds).size).toBe(tutorialCueIds.length);
    expect(new Set(storyCueIds)).toEqual(
      new Set(Object.keys(act4StoryNarrationCatalog)),
    );
    expect(new Set(tutorialCueIds)).toEqual(
      new Set(Object.keys(act4TutorialNarrationCatalog)),
    );
  });

  it("declares all period-season story target cues", () => {
    expect(getClimateChangeFlowStoryTargetCueIds()).toEqual([
      "act4.story.reference.winter",
      "act4.story.reference.spring",
      "act4.story.reference.summer",
      "act4.story.reference.autumn",
      "act4.story.2000_2004.winter",
      "act4.story.2000_2004.spring",
      "act4.story.2000_2004.summer",
      "act4.story.2000_2004.autumn",
      "act4.story.2005_2009.winter",
      "act4.story.2005_2009.spring",
      "act4.story.2005_2009.summer",
      "act4.story.2005_2009.autumn",
      "act4.story.2010_2014.winter",
      "act4.story.2010_2014.spring",
      "act4.story.2010_2014.summer",
      "act4.story.2010_2014.autumn",
      "act4.story.2015_2019.winter",
      "act4.story.2015_2019.spring",
      "act4.story.2015_2019.summer",
      "act4.story.2015_2019.autumn",
      "act4.story.2020_2024.winter",
      "act4.story.2020_2024.spring",
      "act4.story.2020_2024.summer",
      "act4.story.2020_2024.autumn",
    ]);
  });

  it("points every authored flow cue at reachable narration text", () => {
    for (const cue of Object.values(act4StoryNarrationCatalog)) {
      expect(getMessageAtPath(cue.textKey)).toEqual(expect.any(String));
    }

    for (const cue of Object.values(act4TutorialNarrationCatalog)) {
      if (!cue.textKey) continue;

      expect(getMessageAtPath(cue.textKey)).toEqual(expect.any(String));
    }
  });
});
