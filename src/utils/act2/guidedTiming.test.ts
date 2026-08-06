import { describe, expect, it } from "vitest";
import {
  resolveGuidedCountdownValue,
  resolveGuidedMovementSourceTime,
  resolveGuidedTransportPosition,
  resolveNextGuidedBarBoundary,
} from "~/utils/act2/guidedTiming";

describe("guided Act 2 transport timing", () => {
  it("derives bars and beats from one transport", () => {
    expect(resolveGuidedTransportPosition(0)).toMatchObject({
      barIndex: 0,
      beatIndex: 1,
      barLocalMs: 0,
    });
    expect(resolveGuidedTransportPosition(7_250)).toMatchObject({
      barIndex: 1,
      beatIndex: 4,
      barLocalMs: 3_250,
    });
  });

  it("resolves atomic next-bar boundaries", () => {
    expect(resolveNextGuidedBarBoundary(0)).toBe(4_000);
    expect(resolveNextGuidedBarBoundary(0, 1_000, true)).toBe(0);
    expect(resolveNextGuidedBarBoundary(4_001)).toBe(8_000);
  });

  it("maps the owner's downbeat to the movement loop start", () => {
    expect(
      resolveGuidedMovementSourceTime({
        transportMs: 8_000,
        ownerStartedAtMs: 8_000,
        prerollMs: 1_000,
      }),
    ).toBe(1_000);
  });

  it("derives 4-3-2-1 from the attempt boundary", () => {
    expect(
      [4_001, 5_001, 6_001, 7_001, 8_000].map((transportMs) =>
        resolveGuidedCountdownValue({
          transportMs,
          attemptStartsAtMs: 8_000,
        }),
      ),
    ).toEqual([4, 3, 2, 1, null]);
  });
});
