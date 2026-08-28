import { describe, expect, it } from "vitest";
import {
  formatDelimitedPeriod,
  formatMigrationCyclePeriod,
  formatPeriodTransition,
  formatYearPeriod,
} from "~/utils/storyPeriodLabel";

describe("story period labels", () => {
  it("formats migration cycles as year ranges", () => {
    expect(formatYearPeriod(2013, 2014)).toBe("2013\u20132014");
    expect(
      formatMigrationCyclePeriod({
        id: "cycle-2013",
        cycleId: "cycle-2013",
        cycleStartYear: 2013,
        title: "2013 movement",
      }),
    ).toBe("2013\u20132014");
  });

  it("formats climate periods and transitions with display separators", () => {
    expect(formatDelimitedPeriod("1995-1999")).toBe("1995\u20131999");
    expect(
      formatPeriodTransition({
        previousPeriod: "1995-1999",
        nextPeriod: "2000-2004",
      }),
    ).toBe("1995\u20131999 \u2192 2000\u20132004");
  });
});
