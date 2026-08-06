import { describe, expect, it } from "vitest";
import { resolveNarrationSpeechRate } from "~/composables/narration/useNarrator.client";

describe("resolveNarrationSpeechRate", () => {
  it("uses the requested Guided rate without multiplying the global setting", () => {
    expect(resolveNarrationSpeechRate(1.15, 0.95)).toBe(1.15);
  });

  it("uses the global setting when a caller does not override it", () => {
    expect(resolveNarrationSpeechRate(undefined, 0.95)).toBe(0.95);
  });
});
