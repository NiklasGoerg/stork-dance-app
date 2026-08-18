import { describe, expect, it } from "vitest";
import { createMigrationActEvents } from "~/utils/migrationActs/events";
import {
  getMigrationStoryCyclePoints,
  migrationStoryCycleDefinitions,
  migrationStoryPoints,
  parseMigrationStoryCsv,
} from "~/utils/migrationStoryData";
import {
  buildPreparedStoryTimeline,
  getPreparedStoryTimelineDiagnostic,
  getWeightedStoryTimelineElapsedMsForDate,
  STORY_CYCLE_DURATION_MS,
} from "~/utils/storyCycle";
import { getStoryReferenceWeight } from "~/story/storyTimingConfig";

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

  const getCanonicalElapsedMsByDate = (cycleStartDate: string) => {
    const totalWeight = Array.from({ length: 365 }, (_, index) => {
      const date = new Date(`${cycleStartDate}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + index);
      return getStoryReferenceWeight(date);
    }).reduce((sum, weight) => sum + weight, 0);
    const normalDayDurationMs = STORY_CYCLE_DURATION_MS / totalWeight;
    const result = new Map<string, number>();
    let cursorMs = 0;

    for (let index = 0; index < 365; index++) {
      const date = new Date(`${cycleStartDate}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + index);
      result.set(date.toISOString().slice(0, 10), cursorMs);
      cursorMs += normalDayDurationMs * getStoryReferenceWeight(date);
    }

    return result;
  };

  it("anchors each residence to the canonical weighted map and paces its days uniformly", () => {
    for (const cycle of migrationStoryCycleDefinitions) {
      const points = getMigrationStoryCyclePoints(cycle.label);
      const timeline = buildPreparedStoryTimeline(points);
      const canonicalElapsedMsByDate = getCanonicalElapsedMsByDate(
        `${cycle.targetYear}-06-01`,
      );

      expect(timeline[0]?.startMs).toBe(0);
      expect(timeline.at(-1)?.endMs).toBe(STORY_CYCLE_DURATION_MS);

      let index = 0;
      while (index < timeline.length) {
        const firstDay = timeline[index]!;
        let endIndex = index;
        while (
          timeline[endIndex + 1]?.phase === firstDay.phase &&
          timeline[endIndex + 1]?.isRestDay === firstDay.isRestDay
        ) {
          endIndex++;
        }

        const lastDay = timeline[endIndex]!;
        expect(firstDay.startMs).toBeCloseTo(
          canonicalElapsedMsByDate.get(firstDay.date)!,
          8,
        );
        expect(lastDay.endMs).toBeCloseTo(lastDay.canonicalEndMs, 8);

        if (firstDay.isRestDay) {
          const residence = timeline.slice(index, endIndex + 1);
          const deltas = residence.map((day) => day.dayDurationMs);
          for (const delta of deltas) {
            expect(delta).toBeCloseTo(deltas[0]!, 8);
          }
        }

        index = endIndex + 1;
      }
    }
  });

  it("reports residence timing diagnostics with anchored uniform day durations", () => {
    for (const cycle of migrationStoryCycleDefinitions) {
      const points = getMigrationStoryCyclePoints(cycle.label);
      const timeline = buildPreparedStoryTimeline(points);
      const diagnostic = getPreparedStoryTimelineDiagnostic(points, timeline);

      expect(diagnostic.cycleDurationMs).toBe(STORY_CYCLE_DURATION_MS);
      for (const phase of diagnostic.phases.filter(
        (item) => item.uniformSecondsPerDay !== null,
      )) {
        expect(phase.cycleId).toBe(cycle.label);
        expect(phase.anchoredDurationSeconds).toBeGreaterThan(0);
        expect(phase.uniformSecondsPerDay).toBeCloseTo(
          phase.anchoredDurationSeconds / phase.dayCount,
          8,
        );
      }
    }
  });

  it.each(["2013-11-10", "2014-01-10", "2014-02-10"])(
    "keeps winter residence interval %s to next day uniform",
    (date) => {
      const cycle = migrationStoryCycleDefinitions[0]!;
      const timeline = buildPreparedStoryTimeline(
        getMigrationStoryCyclePoints(cycle.label),
      );
      const day = timeline.find((item) => item.date === date)!;
      const nextDay = timeline[day.relativeDay + 1]!;
      const referenceWinterDay = timeline.find(
        (item) => item.date === "2013-11-10",
      )!;

      expect(day.phase).toBe("winter_rest");
      expect(nextDay.phase).toBe("winter_rest");
      expect(nextDay.startMs - day.startMs).toBeCloseTo(
        referenceWinterDay.dayDurationMs,
        8,
      );
    },
  );

  it("keeps the July to August compression boundary continuous", () => {
    const cycle = migrationStoryCycleDefinitions[0]!;
    const timeline = buildPreparedStoryTimeline(
      getMigrationStoryCyclePoints(cycle.label),
    );
    const elapsed = ["07-30", "07-31", "08-01", "08-02"].map((monthDay) =>
      getWeightedStoryTimelineElapsedMsForDate(
        timeline,
        `${cycle.targetYear}-${monthDay}`,
      ),
    );
    const intervals = elapsed.slice(1).map((value, index) => {
      const previous = elapsed[index]!;

      return value - previous;
    });

    expect(elapsed).toEqual([...elapsed].sort((a, b) => a - b));
    for (const interval of intervals) {
      expect(interval).toBeGreaterThan(0);
    }
    expect(Math.max(...intervals) / Math.min(...intervals)).toBeCloseTo(1, 8);
  });
});
