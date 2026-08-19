import { describe, expect, it } from "vitest";
import en from "~/locales/en.json";
import {
  buildMigrationNarrationTimingAudit,
  buildMigrationActResidenceNarrationSchedule,
  getMigrationActStoryArrivalCueIds,
  getMigrationActStoryCycleIntroCueId,
  getMigrationActStoryDepartureCueId,
  getMigrationActStoryTransitionCueId,
  migrationActStoryCompletionCueIds,
  migrationActStoryIntroCueIds,
  migrationActStoryNarrationCatalog,
  type MigrationActStoryNarrationCueId,
  resolveMigrationActStoryNarrationCue,
} from "~/utils/migrationActs/storyNarration";
import { migrationStoryCycleDefinitions } from "~/utils/migrationStoryData";

const getValueAtPath = (source: unknown, path: string) =>
  path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;

    return (value as Record<string, unknown>)[key];
  }, source);

describe("migration act story narration", () => {
  it("contains authored cue keys for every curated cycle and completion", () => {
    const cueIds = Object.keys(migrationActStoryNarrationCatalog);

    expect(migrationActStoryIntroCueIds).toHaveLength(2);
    expect(migrationActStoryCompletionCueIds).toHaveLength(5);

    for (const cycle of migrationStoryCycleDefinitions) {
      expect(getMigrationActStoryCycleIntroCueId(cycle.label)).toBeTruthy();
      expect(
        getMigrationActStoryDepartureCueId(cycle.label, "autumn_departure"),
      ).toBeTruthy();
      expect(
        getMigrationActStoryDepartureCueId(cycle.label, "spring_departure"),
      ).toBeTruthy();
      expect(
        getMigrationActStoryArrivalCueIds(cycle.label, "autumn_arrival").length,
      ).toBeGreaterThan(0);
      expect(
        getMigrationActStoryArrivalCueIds(cycle.label, "spring_arrival").length,
      ).toBeGreaterThan(0);
    }

    for (const cueId of cueIds) {
      const cue = resolveMigrationActStoryNarrationCue(
        cueId as MigrationActStoryNarrationCueId,
      );

      expect(getValueAtPath(en, `${cue.textKey}.title`)).toEqual(
        expect.any(String),
      );
      expect(getValueAtPath(en, `${cue.textKey}.text`)).toEqual(
        expect.any(String),
      );
    }
  });

  it("keeps the flow-backed cue resolvers on the legacy Act 4 cue ids", () => {
    expect(migrationActStoryIntroCueIds).toEqual([
      "act3.story.intro.part1",
      "act3.story.intro.part2",
    ]);
    expect(migrationActStoryCompletionCueIds).toEqual([
      "act3.story.completed.structure",
      "act3.story.completed.pattern",
      "act3.story.completed.qualification",
      "act3.story.completed.question",
      "act3.story.completed.climateTransition",
    ]);

    expect(
      migrationStoryCycleDefinitions.map((cycle) => ({
        intro: getMigrationActStoryCycleIntroCueId(cycle.label),
        autumnDeparture: getMigrationActStoryDepartureCueId(
          cycle.label,
          "autumn_departure",
        ),
        springDeparture: getMigrationActStoryDepartureCueId(
          cycle.label,
          "spring_departure",
        ),
        autumnArrival: getMigrationActStoryArrivalCueIds(
          cycle.label,
          "autumn_arrival",
        ),
        springArrival: getMigrationActStoryArrivalCueIds(
          cycle.label,
          "spring_arrival",
        ),
        transition: getMigrationActStoryTransitionCueId(cycle.label),
      })),
    ).toEqual([
      {
        intro: "act3.story.2013_2014.intro",
        autumnDeparture: "act3.story.2013_2014.autumnPrepare",
        springDeparture: "act3.story.2013_2014.springPrepare",
        autumnArrival: ["act3.story.2013_2014.winterReflection1"],
        springArrival: ["act3.story.2013_2014.breedingReflection1"],
        transition: null,
      },
      {
        intro: "act3.story.2016_2017.intro",
        autumnDeparture: "act3.story.2016_2017.autumnPrepare",
        springDeparture: "act3.story.2016_2017.springPrepare",
        autumnArrival: ["act3.story.2016_2017.winterReflection1"],
        springArrival: ["act3.story.2016_2017.breedingReflection1"],
        transition: "act3.story.transition.2016_2017",
      },
      {
        intro: "act3.story.2018_2019.intro",
        autumnDeparture: "act3.story.2018_2019.autumnPrepare",
        springDeparture: "act3.story.2018_2019.springPrepare",
        autumnArrival: [
          "act3.story.2018_2019.winterReflection1",
          "act3.story.2018_2019.winterReflection2",
        ],
        springArrival: ["act3.story.2018_2019.breedingReflection1"],
        transition: "act3.story.transition.2018_2019",
      },
      {
        intro: "act3.story.2020_2021.intro",
        autumnDeparture: "act3.story.2020_2021.autumnPrepare",
        springDeparture: "act3.story.2020_2021.springPrepare",
        autumnArrival: [
          "act3.story.2020_2021.winterReflection1",
          "act3.story.2020_2021.winterReflection2",
        ],
        springArrival: [
          "act3.story.2020_2021.breedingReflection1",
          "act3.story.2020_2021.breedingReflection2",
        ],
        transition: "act3.story.transition.2020_2021",
      },
      {
        intro: "act3.story.2022_2023.intro",
        autumnDeparture: "act3.story.2022_2023.autumnPrepare",
        springDeparture: "act3.story.2022_2023.springPrepare",
        autumnArrival: ["act3.story.2022_2023.winterReflection1"],
        springArrival: [
          "act3.story.2022_2023.breedingReflection1",
          "act3.story.2022_2023.breedingReflection2",
        ],
        transition: "act3.story.transition.2022_2023",
      },
    ]);
  });

  it("derives pacing seconds from the runtime calendar transform", () => {
    const rows = buildMigrationNarrationTimingAudit();

    expect(
      rows.map((row) => [
        row.cycle,
        row.migration,
        row.realStart,
        row.realEnd,
        row.realDurationDays,
        Number(row.experienceStartSecond.toFixed(2)),
        Number(row.experienceEndSecond.toFixed(2)),
        Number(row.experienceDurationSecondsExact.toFixed(2)),
        row.experienceDurationSecondsSpoken,
      ]),
    ).toEqual([
      [
        "2013-2014",
        "Autumn",
        "2013-08-12",
        "2013-10-06",
        55,
        11.72,
        31.66,
        19.93,
        20,
      ],
      [
        "2013-2014",
        "Spring",
        "2014-03-15",
        "2014-05-28",
        74,
        67.73,
        94.55,
        26.82,
        27,
      ],
      [
        "2016-2017",
        "Autumn",
        "2016-08-27",
        "2016-09-15",
        19,
        17.16,
        24.05,
        6.89,
        7,
      ],
      [
        "2016-2017",
        "Spring",
        "2017-03-08",
        "2017-03-26",
        18,
        65.2,
        71.72,
        6.52,
        7,
      ],
      [
        "2018-2019",
        "Autumn",
        "2018-08-26",
        "2018-09-13",
        18,
        16.8,
        23.32,
        6.52,
        7,
      ],
      [
        "2018-2019",
        "Spring",
        "2019-03-05",
        "2019-03-13",
        8,
        64.11,
        67.01,
        2.9,
        3,
      ],
      [
        "2020-2021",
        "Autumn",
        "2020-09-06",
        "2020-09-13",
        7,
        20.78,
        23.32,
        2.54,
        3,
      ],
      [
        "2020-2021",
        "Spring",
        "2021-02-08",
        "2021-02-23",
        15,
        55.05,
        60.48,
        5.44,
        5,
      ],
      [
        "2022-2023",
        "Autumn",
        "2022-09-12",
        "2022-09-23",
        11,
        22.96,
        26.94,
        3.99,
        4,
      ],
      [
        "2022-2023",
        "Spring",
        "2023-01-19",
        "2023-02-15",
        27,
        47.8,
        57.59,
        9.78,
        10,
      ],
    ]);
  });

  it("uses runtime CSV dates in authored copy where supplied dates differ", () => {
    expect(
      getValueAtPath(
        en,
        "story.acts.act3.narration.cycles.2013_2014.breedingReflection1.text",
      ),
    ).toContain("May 27");
    expect(
      getValueAtPath(
        en,
        "story.acts.act3.narration.cycles.2016_2017.breedingReflection1.text",
      ),
    ).toContain("March 26");
    expect(
      getValueAtPath(
        en,
        "story.acts.act3.narration.cycles.2018_2019.breedingReflection1.text",
      ),
    ).toContain("March 13");
    expect(
      getValueAtPath(
        en,
        "story.acts.act3.narration.cycles.2020_2021.breedingReflection1.text",
      ),
    ).toContain("February 23");
    expect(
      getValueAtPath(
        en,
        "story.acts.act3.narration.cycles.2022_2023.breedingReflection1.text",
      ),
    ).toContain("February 15");
  });

  it("schedules one summer and one winter timing cue per cycle in safe windows", () => {
    const rows = migrationStoryCycleDefinitions.flatMap((cycle) =>
      buildMigrationActResidenceNarrationSchedule({
        id: `test:${cycle.label}`,
        cycleId: cycle.label,
        cycleStartYear: cycle.targetYear,
        title: cycle.label,
      }),
    );

    expect(
      rows.map((row) => [
        row.cycle,
        row.phase,
        row.triggerSecond,
        row.nextCountdownStartSecond,
        row.availableSecondsBeforeCountdown,
        row.quietSecondsAfterPrimaryCue === null
          ? null
          : Number(row.quietSecondsAfterPrimaryCue.toFixed(2)),
      ]),
    ).toEqual([
      ["2013-2014", "summer_rest", 4, 8, 4, null],
      ["2013-2014", "winter_rest", 44, 64, 20, 8.34],
      ["2016-2017", "summer_rest", 12, 16, 4, null],
      ["2016-2017", "winter_rest", 40, 64, 24, 11.95],
      ["2018-2019", "summer_rest", 12, 16, 4, null],
      ["2018-2019", "winter_rest", 36, 64, 28, 8.68],
      ["2020-2021", "summer_rest", 16, 20, 4, null],
      ["2020-2021", "winter_rest", 36, 52, 16, 8.68],
      ["2022-2023", "summer_rest", 16, 20, 4, null],
      ["2022-2023", "winter_rest", 40, 44, 4, 9.06],
    ]);

    for (const row of rows) {
      expect(getValueAtPath(en, `${row.textKey}.title`)).toEqual(
        expect.any(String),
      );
      expect(getValueAtPath(en, `${row.textKey}.text`)).toEqual(
        expect.any(String),
      );
    }
  });
});
