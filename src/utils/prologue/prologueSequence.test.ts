import { describe, expect, it } from "vitest";
import {
  getPrologueVisualStateForSegmentIndex,
  PROLOGUE_MIGRATION_CYCLE_ID,
  prologueNarrationSegments,
} from "~/utils/prologue/prologueSequence";

describe("prologue sequence", () => {
  it("uses the second selected migration cycle", () => {
    expect(PROLOGUE_MIGRATION_CYCLE_ID).toBe("individual_3339_2016_2017");
  });

  it("maps the six narration segments onto the cinematic states", () => {
    expect(prologueNarrationSegments).toHaveLength(6);
    expect(
      prologueNarrationSegments.map((segment) => segment.visualState),
    ).toEqual(["stork", "stork", "map", "map", "map", "map"]);
  });

  it("keeps the final visual on the map for the automatic Act II handoff", () => {
    expect(getPrologueVisualStateForSegmentIndex(0)).toBe("stork");
    expect(getPrologueVisualStateForSegmentIndex(2)).toBe("map");
    expect(getPrologueVisualStateForSegmentIndex(6)).toBe("map");
  });
});
