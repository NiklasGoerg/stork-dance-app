import { describe, expect, it } from "vitest";
import { migrationStoryCycleDefinitions } from "~/utils/migrationStoryData";
import { resolveGuidedNarrationTokens } from "~/utils/act2/guidedNarrationTokens";

describe("resolveGuidedNarrationTokens", () => {
  it("derives only reliable cycle values", () => {
    const tokens = resolveGuidedNarrationTokens(
      migrationStoryCycleDefinitions[0],
    );
    expect(tokens.breedingArea).toContain("Germany");
    expect(tokens.departureMonth).toMatch(/^[A-Z][a-z]+$/);
    expect(tokens.southboundRoute).toContain("Europe");
  });

  it("leaves unreliable optional values empty for catalog fallbacks", () => {
    const tokens = resolveGuidedNarrationTokens(undefined);
    expect(tokens.winteringArea).toBe("");
    expect(tokens.departureMonth).toBe("");
  });
});
