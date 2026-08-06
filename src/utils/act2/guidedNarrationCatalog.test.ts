import { describe, expect, it } from "vitest";
import {
  guidedNarrationCatalog,
  guidedNarrationTimingAnalysis,
  GUIDED_NARRATION_ESTIMATED_WORDS_PER_MINUTE,
  resolveGuidedNarrationText,
} from "~/utils/act2/guidedNarrationCatalog";

const tokens = {
  breedingArea: "Germany",
  winteringArea: "Chad",
  departureMonth: "August",
  southboundRoute: "through France and Spain",
  northboundRoute: "through Spain and France",
};

describe("Guided Act 2 narration catalog", () => {
  it("keeps every cue ID stable and internally consistent", () => {
    expect(Object.keys(guidedNarrationCatalog)).toHaveLength(62);
    for (const [id, item] of Object.entries(guidedNarrationCatalog)) {
      expect(item.id).toBe(id);
      expect(item.phases.length).toBeGreaterThan(0);
      expect(item.priority).toBeGreaterThan(0);
      expect(
        resolveGuidedNarrationText(
          id as keyof typeof guidedNarrationCatalog,
          tokens,
        ),
      ).not.toMatch(/{{\w+}}/);
    }
  });

  it("uses a calm estimator and keeps active context cues within one bar", () => {
    expect(GUIDED_NARRATION_ESTIMATED_WORDS_PER_MINUTE).toBe(180);
    const overruns = guidedNarrationTimingAnalysis.filter(
      (item) =>
        item.enabled &&
        item.speak &&
        item.priority <= 50 &&
        item.estimatedDurationMs > 4_000,
    );
    expect(overruns).toEqual([]);
  });

  it("keeps ordinary continuous failures catalog-only", () => {
    const ids = [
      "act2.summer.failure.noMovement",
      "act2.summer.failure.incomplete",
      "act2.autumnMigration.failure.noMovement",
      "act2.autumnMigration.failure.incomplete",
      "act2.winter.failure.noMovement",
      "act2.winter.failure.incomplete",
      "act2.springMigration.failure.noMovement",
      "act2.springMigration.failure.incomplete",
    ] as const;
    expect(ids.map((id) => guidedNarrationCatalog[id].enabled)).toEqual(
      ids.map(() => false),
    );
  });

  it("uses safe copy when optional story data is unavailable", () => {
    const text = resolveGuidedNarrationText("act2.winter.context", {
      ...tokens,
      winteringArea: "",
    });
    expect(text).not.toContain("{{");
    expect(text).toContain("wintering area");
  });

  it("uses the required warm, story-preserving success copy", () => {
    const expected = {
      "act2.summer.success":
        "Great job. You found the summer rhythm. Keep moving as the season passes.",
      "act2.departure.success":
        "Great job. The stork is airborne, and the journey south can begin.",
      "act2.autumnMigration.success":
        "Well done. The journey has found its rhythm. Keep moving south.",
      "act2.arrival.success":
        "Great landing. The stork has safely reached Chad.",
      "act2.winter.success":
        "Well done. You found the winter rhythm. Keep moving as winter passes.",
      "act2.springDeparture.success":
        "Great job. The stork is airborne again, and the return journey has begun.",
      "act2.springMigration.success":
        "Well done. The return journey has found its rhythm. Keep moving north.",
      "act2.springArrival.success":
        "Great landing. The stork has returned to its summer breeding area.",
      "act2.completion.journeyComplete":
        "Excellent work. You completed one full annual migration cycle.",
    } as const;

    for (const [id, text] of Object.entries(expected)) {
      expect(
        resolveGuidedNarrationText(
          id as keyof typeof guidedNarrationCatalog,
          tokens,
        ),
      ).toBe(text);
    }
  });
});
