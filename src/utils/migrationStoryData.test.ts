import { describe, expect, it } from "vitest";
import { createMigrationActEvents } from "~/utils/migrationActs/events";
import {
  getMigrationStoryCyclePoints,
  migrationStoryCycleDefinitions,
  migrationStoryPoints,
  parseMigrationStoryCsv,
} from "~/utils/migrationStoryData";
import { buildPreparedStoryTimeline } from "~/utils/storyCycle";

describe("migration story preprocessing output", () => {
  it("contains exactly the five curated cycles", () => {
    expect(migrationStoryCycleDefinitions).toHaveLength(5);
    expect(
      new Set(migrationStoryPoints.map((point) => point.story?.cycleId)).size,
    ).toBe(5);
  });

  it("stores the corrected 2013 departure before the bird reaches Spain", () => {
    const points = getMigrationStoryCyclePoints("individual_3031_2013_2014");
    const departure = points.find(
      (point) => point.story?.event === "autumn_departure",
    );
    const firstSpanishPoint = points.find(
      (point) => point.lat < 44 && point.lng < 4.5,
    );

    expect(departure?.date).toBe("2013-08-12");
    expect(departure?.story?.phase).toBe("autumn_migration");
    expect(departure?.story?.isMigrationDay).toBe(true);
    expect((departure?.date ?? "") < (firstSpanishPoint?.date ?? "")).toBe(
      true,
    );
  });

  it.each(migrationStoryCycleDefinitions)(
    "contains one ordered event sequence for $label",
    (cycle) => {
      const points = getMigrationStoryCyclePoints(cycle.label);
      const eventPoints = points.filter((point) => point.story?.event);

      expect(eventPoints.map((point) => point.story?.event)).toEqual([
        "autumn_departure",
        "autumn_arrival",
        "spring_departure",
        "spring_arrival",
      ]);
      expect(eventPoints.map((point) => point.date)).toEqual([
        cycle.events.breedingDeparture,
        cycle.events.winterArrival,
        cycle.events.winterDeparture,
        cycle.events.nextBreedingArrival,
      ]);
      expect(
        points.every(
          (point) => point.story?.isMigrationDay !== point.story?.isRestDay,
        ),
      ).toBe(true);
    },
  );

  it.each(migrationStoryCycleDefinitions)(
    "contains one indexed row per calendar day for $label",
    (cycle) => {
      const points = getMigrationStoryCyclePoints(cycle.label);
      const cycleStart = `${cycle.targetYear}-06-01`;
      const cycleEnd = `${cycle.targetYear + 1}-05-31`;

      expect(points).toHaveLength(365);
      expect(points[0]?.date).toBe(cycleStart);
      expect(points.at(-1)?.date).toBe(cycleEnd);
      expect(
        points.every((point, index) => {
          const expectedDate = new Date(`${cycleStart}T00:00:00.000Z`);
          expectedDate.setUTCDate(expectedDate.getUTCDate() + index);
          return (
            point.story?.relativeDay === index &&
            point.date === expectedDate.toISOString().slice(0, 10)
          );
        }),
      ).toBe(true);
    },
  );

  it("exposes validated position provenance", () => {
    const expectedCounts = new Map([
      ["individual_3031_2013_2014", { observed: 342, backfilled: 23 }],
      ["individual_3339_2016_2017", { observed: 365, backfilled: 0 }],
      ["individual_3042_2018_2019", { observed: 362, backfilled: 0 }],
      ["individual_3042_2020_2021", { observed: 365, backfilled: 0 }],
      ["individual_4004_2022_2023", { observed: 365, backfilled: 0 }],
    ]);

    for (const cycle of migrationStoryCycleDefinitions) {
      const points = getMigrationStoryCyclePoints(cycle.label);
      const expected = expectedCounts.get(cycle.label)!;
      const observed = points.filter(
        (point) => point.story?.positionSource === "observed",
      );
      const backfilled = points.filter(
        (point) => point.story?.positionSource === "backfilled",
      );

      expect(observed).toHaveLength(expected.observed);
      expect(backfilled).toHaveLength(expected.backfilled);
      expect(
        observed.every(
          (point) =>
            point.story?.isPositionObserved === true &&
            point.story.sourceDateBefore === point.date &&
            point.story.sourceDateAfter === point.date &&
            point.story.gapLengthDays === 0,
        ),
      ).toBe(true);
      expect(
        points.every((point) =>
          point.story?.positionSource === "observed"
            ? true
            : point.story?.isPositionObserved === false &&
              (point.story?.gapLengthDays ?? 0) > 0,
        ),
      ).toBe(true);
    }

    expect(
      getMigrationStoryCyclePoints("individual_3042_2018_2019").filter(
        (point) => point.story?.positionSource === "forward_filled",
      ),
    ).toHaveLength(3);
    expect(
      migrationStoryPoints.filter(
        (point) => point.story?.positionSource === "interpolated",
      ),
    ).toHaveLength(0);
  });

  it("requires the position provenance columns", () => {
    const headerOnly = [
      "story-cycle-id",
      "cycle-index",
      "cycle-year",
      "tag-local-identifier",
      "date",
      "relative-day",
      "timestamp",
      "location-lat",
      "location-long",
      "phase",
      "isMigrationDay",
      "isRestDay",
      "event",
      "residence-region",
      "destination-country",
    ].join(",");

    expect(() => parseMigrationStoryCsv(headerOnly)).toThrow(
      "Migration story CSV is missing column position-source.",
    );
  });

  it("uses persisted events and phases for gestures and timeline timing", () => {
    const cycle = migrationStoryCycleDefinitions[0]!;
    const points = getMigrationStoryCyclePoints(cycle.label);
    const timeline = buildPreparedStoryTimeline(points);
    const events = createMigrationActEvents(
      {
        id: `test:${cycle.label}`,
        cycleId: cycle.label,
        cycleStartYear: cycle.targetYear,
        title: cycle.label,
      },
      timeline,
    );
    const beforeDeparture = timeline.find((day) => day.date === "2013-08-11");
    const departure = timeline.find((day) => day.date === "2013-08-12");

    expect(events.map((event) => event.boundaryDate)).toEqual([
      "2013-08-12",
      "2013-10-06",
      "2014-03-15",
      "2014-05-28",
    ]);
    expect(beforeDeparture?.phase).toBe("summer_rest");
    expect(beforeDeparture?.timingClass).toBe("rest");
    expect(departure?.phase).toBe("autumn_migration");
    expect(departure?.timingClass).toBe("migration");
  });
});
