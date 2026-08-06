import { describe, expect, it } from "vitest";
import type { MovementPlaybackTiming } from "~/types/movement";
import { resolveMovementPlaybackPosition } from "~/utils/movementPlaybackTiming";

const timing: MovementPlaybackTiming = {
  sourceFps: 30,
  prerollMs: 1_000,
  loopStartMs: 1_000,
  loopEndMs: 5_000,
  loopTransition: { cutAtMs: 4_500, resumeAtMs: 500 },
};

describe("movement playback timing", () => {
  it("keeps the initial preroll and cuts migration loops from 4500 to 500 ms", () => {
    const sourceAt = (elapsedMs: number) =>
      resolveMovementPlaybackPosition({
        elapsedMs,
        sourceDurationMs: 5_000,
        timing,
      }).sourceTimeMs;

    expect(sourceAt(0)).toBe(0);
    expect(sourceAt(1_000)).toBe(1_000);
    expect(sourceAt(2_000)).toBe(2_000);
    expect(sourceAt(3_000)).toBe(3_000);
    expect(sourceAt(4_000)).toBe(4_000);
    expect(sourceAt(4_500)).toBe(500);
    expect(sourceAt(5_000)).toBe(1_000);
  });
});
