import { describe, expect, it } from "vitest";
import {
  getMigrationChangeFlowCueIds,
  getMigrationChangeFlowCueRefs,
  migrationChangeFlow,
} from "~/story/acts/migrationChangeFlow";
import enMessages from "~/locales/en.json";
import { migrationActStoryNarrationCatalog } from "~/utils/migrationActs/storyNarration";
import { migrationStoryCycleDefinitions } from "~/utils/migrationStoryData";

const getMessageAtPath = (path: string) =>
  path.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    return (value as Record<string, unknown>)[segment];
  }, enMessages);

describe("migration change flow", () => {
  it("declares the five curated cycles in story order", () => {
    expect(migrationChangeFlow.publicActId).toBe("act-3");
    expect(migrationChangeFlow.cycles).toHaveLength(5);

    expect(
      migrationChangeFlow.cycles.map((cycle) => [
        cycle.key,
        cycle.cycleId,
        cycle.targetYear,
      ]),
    ).toEqual([
      ["2013_2014", "individual_3031_2013_2014", 2013],
      ["2016_2017", "individual_3339_2016_2017", 2016],
      ["2018_2019", "individual_3042_2018_2019", 2018],
      ["2020_2021", "individual_3042_2020_2021", 2020],
      ["2022_2023", "individual_4004_2022_2023", 2022],
    ]);

    expect(migrationChangeFlow.cycles.map((cycle) => cycle.cycleId)).toEqual(
      migrationStoryCycleDefinitions.map((cycle) => cycle.label),
    );
  });

  it("covers intro, residences, events, transitions, and completion cues", () => {
    expect(migrationChangeFlow.introCues.map((cue) => cue.cueId)).toEqual([
      "act3.story.intro.part1",
      "act3.story.intro.part2",
    ]);
    expect(migrationChangeFlow.completionCues.map((cue) => cue.cueId)).toEqual([
      "act3.story.completed.structure",
      "act3.story.completed.pattern",
      "act3.story.completed.qualification",
      "act3.story.completed.climateTransition",
    ]);

    for (const cycle of migrationChangeFlow.cycles) {
      expect(cycle.key).toBe(`${cycle.targetYear}_${cycle.targetYear + 1}`);
      expect(cycle.cycleIntroCue).toMatchObject({
        cueId: `act3.story.${cycle.key}.intro`,
        role: "cycleIntro",
      });
      expect(cycle.residenceTimingCues).toEqual([
        {
          phase: "summer_rest",
          cueId: `act3.story.${cycle.key}.summerTiming`,
          role: "summerTiming",
        },
        {
          phase: "winter_rest",
          cueId: `act3.story.${cycle.key}.winterTiming`,
          role: "winterTiming",
        },
      ]);
      expect(cycle.departureCues).toEqual([
        {
          eventType: "autumn_departure",
          cueId: `act3.story.${cycle.key}.autumnPrepare`,
          role: "autumnPrepare",
        },
        {
          eventType: "spring_departure",
          cueId: `act3.story.${cycle.key}.springPrepare`,
          role: "springPrepare",
        },
      ]);
      expect(cycle.arrivalCueGroups.map((group) => group.eventType)).toEqual([
        "autumn_arrival",
        "spring_arrival",
      ]);
      expect(
        cycle.arrivalCueGroups
          .find((group) => group.eventType === "autumn_arrival")
          ?.reflectionCues.every((cue) => cue.role === "winterReflection"),
      ).toBe(true);
      expect(
        cycle.arrivalCueGroups
          .find((group) => group.eventType === "spring_arrival")
          ?.reflectionCues.every((cue) => cue.role === "breedingReflection"),
      ).toBe(true);
      expect(
        cycle.arrivalCueGroups.every(
          (group) => group.reflectionCues.length > 0,
        ),
      ).toBe(true);
    }

    expect(
      migrationChangeFlow.cycles.map(
        (cycle) => cycle.transitionCue?.cueId ?? null,
      ),
    ).toEqual([
      null,
      "act3.story.transition.2016_2017",
      "act3.story.transition.2018_2019",
      "act3.story.transition.2020_2021",
      "act3.story.transition.2022_2023",
    ]);
    expect(
      migrationChangeFlow.cycles
        .slice(1)
        .every((cycle) => cycle.transitionCue?.role === "cycleTransition"),
    ).toBe(true);
  });

  it("keeps cue inventory unique and aligned with the authored catalog", () => {
    const cueRefs = getMigrationChangeFlowCueRefs();
    const cueIds = cueRefs.map((cue) => cue.cueId);
    const catalogEntries = Object.entries(migrationActStoryNarrationCatalog);
    const catalogCueIds = catalogEntries.map(([cueId]) => cueId);

    expect(new Set(cueIds).size).toBe(cueIds.length);
    expect(cueIds).toHaveLength(catalogCueIds.length);
    expect(new Set(cueIds)).toEqual(new Set(catalogCueIds));

    for (const cueRef of cueRefs) {
      const catalogCue =
        migrationActStoryNarrationCatalog[
          cueRef.cueId as keyof typeof migrationActStoryNarrationCatalog
        ];

      expect(catalogCue).toBeDefined();
      expect(catalogCue.id).toBe(cueRef.cueId);
      expect(catalogCue.role).toBe(cueRef.role);
    }
  });

  it("points every authored flow cue at reachable narration title and text keys", () => {
    for (const cue of Object.values(migrationActStoryNarrationCatalog)) {
      expect(getMessageAtPath(`${cue.textKey}.title`)).toEqual(
        expect.any(String),
      );
      expect(getMessageAtPath(`${cue.textKey}.text`)).toEqual(
        expect.any(String),
      );
    }
  });

  it("references only cue ids from the existing authored story catalog", () => {
    const cueIds = getMigrationChangeFlowCueIds();

    expect(new Set(cueIds).size).toBe(cueIds.length);
    expect(cueIds).toHaveLength(
      Object.keys(migrationActStoryNarrationCatalog).length,
    );

    for (const cueId of cueIds) {
      expect(migrationActStoryNarrationCatalog).toHaveProperty(cueId);
    }
  });

  it("keeps transition cue ids in the expected target-cycle order", () => {
    expect(
      migrationChangeFlow.cycles
        .map((cycle) => cycle.transitionCue?.cueId ?? null)
        .filter(Boolean),
    ).toEqual([
      "act3.story.transition.2016_2017",
      "act3.story.transition.2018_2019",
      "act3.story.transition.2020_2021",
      "act3.story.transition.2022_2023",
    ]);
  });
});
