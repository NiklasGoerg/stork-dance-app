import { describe, expect, it } from "vitest";

import temperatureSeasonsCsv from "~/assets/climate_data/temperature_seasons_data.csv?raw";
import en from "~/locales/en.json";
import { buildAct4ClimateStorySequence } from "~/utils/act4/sequence";
import {
  act4StoryCompletionCueIds,
  act4StoryNarrationCatalog,
  act4StoryPeriodTransitionCueIds,
  act4StoryTargetCueIds,
  formatSpokenClimateDifference,
  formatSpokenClimateDelta,
  resolveAct4StoryPeriodTransitionCue,
  resolveAct4StoryNarrationCue,
  type Act4StoryTargetCueId,
} from "~/utils/act4/storyNarration";
import { parseClimateSeasonDataCsv } from "~/utils/movement/acts/climate/climateSeasonData";
import type { ClimateSeasonDataset } from "~/types/climate";

const readDataset = (): ClimateSeasonDataset => {
  const result = parseClimateSeasonDataCsv(temperatureSeasonsCsv);

  expect(result.errors).toEqual([]);
  expect(result.dataset).not.toBeNull();

  return result.dataset!;
};

const getTranslation = (key: string) =>
  key.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object") return undefined;

    return (value as Record<string, unknown>)[segment];
  }, en);

const expectedReferenceValues = {
  "1995-1999:winter": { absoluteValue: 0.9, movementValue: 100 },
  "1995-1999:spring": { absoluteValue: 8.35, movementValue: 100 },
  "1995-1999:summer": { absoluteValue: 17.01, movementValue: 100 },
  "1995-1999:autumn": { absoluteValue: 8.67, movementValue: 100 },
} as const;

const expectedComparisonValues = {
  "2000-2004:winter": {
    delta: 0.55,
    normalizedDifference: 0.235,
    movementValue: 20,
  },
  "2000-2004:spring": {
    delta: 0.71,
    normalizedDifference: 0.306,
    movementValue: 30,
  },
  "2000-2004:summer": {
    delta: 0.64,
    normalizedDifference: 0.275,
    movementValue: 30,
  },
  "2000-2004:autumn": {
    delta: 0.64,
    normalizedDifference: 0.275,
    movementValue: 25,
  },
  "2005-2009:winter": {
    delta: 0.53,
    normalizedDifference: 0.228,
    movementValue: 20,
  },
  "2005-2009:spring": {
    delta: 0.74,
    normalizedDifference: 0.317,
    movementValue: 30,
  },
  "2005-2009:summer": {
    delta: 0.31,
    normalizedDifference: 0.135,
    movementValue: 10,
  },
  "2005-2009:autumn": {
    delta: 1.17,
    normalizedDifference: 0.5,
    movementValue: 50,
  },
  "2010-2014:winter": {
    delta: -0.32,
    normalizedDifference: -0.139,
    movementValue: -10,
  },
  "2010-2014:spring": {
    delta: 0.52,
    normalizedDifference: 0.225,
    movementValue: 20,
  },
  "2010-2014:summer": {
    delta: 0.29,
    normalizedDifference: 0.123,
    movementValue: 10,
  },
  "2010-2014:autumn": {
    delta: 0.91,
    normalizedDifference: 0.389,
    movementValue: 40,
  },
  "2015-2019:winter": {
    delta: 1.26,
    normalizedDifference: 0.54,
    movementValue: 50,
  },
  "2015-2019:spring": {
    delta: 0.87,
    normalizedDifference: 0.371,
    movementValue: 40,
  },
  "2015-2019:summer": {
    delta: 1.51,
    normalizedDifference: 0.646,
    movementValue: 60,
  },
  "2015-2019:autumn": {
    delta: 1.2,
    normalizedDifference: 0.516,
    movementValue: 50,
  },
  "2020-2024:winter": {
    delta: 2.33,
    normalizedDifference: 1,
    movementValue: 100,
  },
  "2020-2024:spring": {
    delta: 0.67,
    normalizedDifference: 0.288,
    movementValue: 30,
  },
  "2020-2024:summer": {
    delta: 1.45,
    normalizedDifference: 0.623,
    movementValue: 60,
  },
  "2020-2024:autumn": {
    delta: 1.96,
    normalizedDifference: 0.84,
    movementValue: 80,
  },
} as const;

const expectedComparisonCopy = {
  "act4.story.2000_2004.winter":
    "Winter is {deltaSpoken} degrees above the reference. Use {movementValue} percent.",
  "act4.story.2000_2004.spring":
    "Spring is {deltaSpoken} degrees above the reference. Use {movementValue} percent.",
  "act4.story.2000_2004.summer":
    "Summer is {deltaSpoken} degrees above the reference. Use {movementValue} percent.",
  "act4.story.2000_2004.autumn":
    "Autumn is {deltaSpoken} degrees above the reference. Use {movementValue} percent.",
  "act4.story.2005_2009.winter":
    "Winter stays close to the last period. Use {movementValue} percent.",
  "act4.story.2005_2009.spring":
    "Spring stays similar. Use {movementValue} percent.",
  "act4.story.2005_2009.summer":
    "Summer moves closer to the reference. Use {movementValue} percent.",
  "act4.story.2005_2009.autumn": "Autumn rises. Use {movementValue} percent.",
  "act4.story.2010_2014.winter":
    "Winter falls below the reference by {deltaAbsSpoken} degrees. Use minus 10 percent.",
  "act4.story.2010_2014.spring":
    "Spring stays above the reference. Use {movementValue} percent.",
  "act4.story.2010_2014.summer":
    "Summer stays close to the reference. Use {movementValue} percent.",
  "act4.story.2010_2014.autumn":
    "Autumn is above the reference. Use {movementValue} percent.",
  "act4.story.2015_2019.winter":
    "Winter rises again. Use {movementValue} percent.",
  "act4.story.2015_2019.spring":
    "Spring rises slightly. Use {movementValue} percent.",
  "act4.story.2015_2019.summer":
    "Summer is much farther from the reference. Use {movementValue} percent.",
  "act4.story.2015_2019.autumn":
    "Autumn remains high. Use {movementValue} percent.",
  "act4.story.2020_2024.winter":
    "Winter reaches the largest difference: {deltaSpoken} degrees. Use the full movement.",
  "act4.story.2020_2024.spring":
    "Spring is above the reference. Use {movementValue} percent.",
  "act4.story.2020_2024.summer":
    "Summer stays high. Use {movementValue} percent.",
  "act4.story.2020_2024.autumn":
    "Autumn rises strongly. Use {movementValue} percent.",
} as const;

describe("Act 4 story narration", () => {
  it("defines the fixed authored target cue inventory", () => {
    expect(act4StoryTargetCueIds).toHaveLength(24);
    expect(act4StoryTargetCueIds).toEqual([
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
    ] satisfies Act4StoryTargetCueId[]);
  });

  it("defines period transition and completion cue inventories", () => {
    expect(act4StoryPeriodTransitionCueIds).toEqual([
      "act4.story.transition.2000_2004",
      "act4.story.transition.2005_2009",
      "act4.story.transition.2010_2014",
      "act4.story.transition.2015_2019",
    ]);
    expect(act4StoryCompletionCueIds).toEqual([
      "act4.story.completed.embodied",
      "act4.story.completed.seasons",
      "act4.story.completed.maximum",
      "act4.story.completed.migration",
    ]);
  });

  it("points every story narration cue to an English i18n string", () => {
    Object.values(act4StoryNarrationCatalog).forEach((cue) => {
      expect(getTranslation(cue.textKey), cue.textKey).toEqual(
        expect.any(String),
      );
    });
  });

  it("marks seasonal target cues as speak-only", () => {
    act4StoryTargetCueIds.forEach((cueId) => {
      const cue = act4StoryNarrationCatalog[cueId];

      expect(cue.speak).toBe(true);
      expect(cue.display).toBe(false);
    });

    expect(act4StoryNarrationCatalog["act4.story.intro.chart"].display).toBe(
      true,
    );
    expect(
      act4StoryNarrationCatalog["act4.story.reference.complete"].display,
    ).toBe(true);
  });

  it("keeps the post-reference scale cue as a short reminder", () => {
    const scaleText =
      en.story.acts.act4.narration.story.referenceComplete.scale;

    expect(scaleText).toBe(
      "The largest difference in this story is 2.33 degrees. That becomes the full, 100 percent movement.",
    );
    expect(scaleText).not.toContain("1.17");
  });

  it("keeps comparison cues short and action-oriented", () => {
    expect(Object.keys(expectedComparisonCopy)).toHaveLength(20);

    Object.entries(expectedComparisonCopy).forEach(([cueId, expectedText]) => {
      const cue =
        act4StoryNarrationCatalog[
          cueId as keyof typeof act4StoryNarrationCatalog
        ];
      const text = getTranslation(cue.textKey);
      expect(text, cueId).toBe(expectedText);
      expect(expectedText.split(/\s+/).length, cueId).toBeLessThanOrEqual(12);
    });
  });

  it("resolves comparison period transitions without adding a final transition", () => {
    expect(resolveAct4StoryPeriodTransitionCue("1995-1999")).toBeNull();
    expect(resolveAct4StoryPeriodTransitionCue("2000-2004")?.id).toBe(
      "act4.story.transition.2000_2004",
    );
    expect(resolveAct4StoryPeriodTransitionCue("2005-2009")?.id).toBe(
      "act4.story.transition.2005_2009",
    );
    expect(resolveAct4StoryPeriodTransitionCue("2010-2014")?.id).toBe(
      "act4.story.transition.2010_2014",
    );
    expect(resolveAct4StoryPeriodTransitionCue("2015-2019")?.id).toBe(
      "act4.story.transition.2015_2019",
    );
    expect(resolveAct4StoryPeriodTransitionCue("2020-2024")).toBeNull();
  });

  it("resolves every fixed story target to one authored cue", () => {
    const targets = buildAct4ClimateStorySequence(readDataset());
    const resolutions = targets.map(resolveAct4StoryNarrationCue);

    expect(targets).toHaveLength(24);
    expect(resolutions.every(Boolean)).toBe(true);
    expect(resolutions.map((resolution) => resolution!.cue.id)).toEqual(
      act4StoryTargetCueIds,
    );
  });

  it("keeps runtime climate values aligned with the authored story data", () => {
    const targets = buildAct4ClimateStorySequence(readDataset());

    Object.entries(expectedReferenceValues).forEach(([key, expected]) => {
      const [interval, season] = key.split(":");
      const target = targets.find(
        (item) => item.interval === interval && item.season === season,
      );

      expect(target, key).toBeDefined();
      expect(target!.climateData!.absoluteValue).toBeCloseTo(
        expected.absoluteValue,
        3,
      );
      expect(target!.movementValue).toBe(expected.movementValue);
    });

    Object.entries(expectedComparisonValues).forEach(([key, expected]) => {
      const [interval, season] = key.split(":");
      const target = targets.find(
        (item) => item.interval === interval && item.season === season,
      );

      expect(target, key).toBeDefined();
      expect(target!.climateData!.displayValue).toBeCloseTo(expected.delta, 3);
      expect(target!.climateData!.normalizedValue).toBeCloseTo(
        expected.normalizedDifference,
        3,
      );
      expect(target!.movementValue).toBe(expected.movementValue);
    });
  });

  it("preserves the known semantic landmarks", () => {
    const targets = buildAct4ClimateStorySequence(readDataset());
    const winter2010 = targets.find(
      (target) => target.interval === "2010-2014" && target.season === "winter",
    );
    const winter2020 = targets.find(
      (target) => target.interval === "2020-2024" && target.season === "winter",
    );

    expect(winter2010).toBeDefined();
    expect(winter2010!.climateData!.displayValue).toBeLessThan(0);
    expect(winter2010!.movementValue).toBe(-10);
    expect(resolveAct4StoryNarrationCue(winter2010!)?.cue.id).toBe(
      "act4.story.2010_2014.winter",
    );
    expect(resolveAct4StoryNarrationCue(winter2010!)?.params.deltaAbs).toBe(
      "point three",
    );
    expect(
      resolveAct4StoryNarrationCue(winter2010!)?.params.deltaAbsSpoken,
    ).toBe("point three");
    expect(en.story.acts.act4.narration.story["2010_2014"].winter).toContain(
      "falls below the reference by {deltaAbsSpoken} degrees",
    );
    expect(
      en.story.acts.act4.narration.story["2010_2014"].winter,
    ).not.toContain("minus {deltaAbsSpoken}");
    expect(en.story.acts.act4.narration.story["2010_2014"].winter).toContain(
      "minus 10 percent",
    );

    const winter2020Resolution = resolveAct4StoryNarrationCue(winter2020!);

    expect(winter2020Resolution?.params.deltaSpoken).toBe("two point three");

    expect(winter2020).toBeDefined();
    expect(winter2020!.climateData!.displayValue).toBeCloseTo(2.33, 3);
    expect(winter2020!.climateData!.normalizedValue).toBeCloseTo(1, 3);
    expect(winter2020!.movementValue).toBe(100);
    expect(resolveAct4StoryNarrationCue(winter2020!)?.cue.id).toBe(
      "act4.story.2020_2024.winter",
    );
  });

  it("formats spoken climate differences with one decimal and no leading zero", () => {
    expect(formatSpokenClimateDifference(0.55)).toBe("point six");
    expect(formatSpokenClimateDifference(0.71)).toBe("point seven");
    expect(formatSpokenClimateDifference(0.31)).toBe("point three");
    expect(formatSpokenClimateDifference(0.91)).toBe("point nine");
    expect(formatSpokenClimateDifference(1.17)).toBe("one point two");
    expect(formatSpokenClimateDifference(1.51)).toBe("one point five");
    expect(formatSpokenClimateDifference(1.96)).toBe("two");
    expect(formatSpokenClimateDifference(2.33)).toBe("two point three");
    expect(formatSpokenClimateDifference(-0.32)).toBe("point three");
    expect(formatSpokenClimateDelta(-0.32)).toBe("point three");
  });
});
