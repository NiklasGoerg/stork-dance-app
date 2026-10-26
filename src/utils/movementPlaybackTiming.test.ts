import { describe, expect, it } from "vitest";
import {
  ACT4_MOVEMENT_TIMING_DEFAULTS,
  act4SeasonMovementConfig,
} from "~/story/act4IntroCycle";
import type { MovementPlaybackTiming, MovementRecording } from "~/types/movement";
import { getInterpolatedMovementFrame } from "~/utils/movementFrames";
import {
  getMovementRecordingDurationMs,
  resolveMovementPlaybackPosition,
} from "~/utils/movementPlaybackTiming";

const seasonRecordings = import.meta.glob<MovementRecording>(
  "../assets/movement_library/seasons/*.json",
  { eager: true, import: "default" },
);

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

  it("maps Act 4 Count 1 to the downbeat for first and second two-bar playback", () => {
    const sourceAt = (seasonElapsedMs: number) =>
      resolveMovementPlaybackPosition({
        elapsedMs: seasonElapsedMs + ACT4_MOVEMENT_TIMING_DEFAULTS.prerollMs,
        sourceDurationMs: 9_500,
        timing: ACT4_MOVEMENT_TIMING_DEFAULTS,
      });

    const firstPlayback = sourceAt(0);
    const secondPlayback = sourceAt(8_000);

    expect(firstPlayback.sourceTimeMs).toBe(1_000);
    expect(firstPlayback.loopCount).toBe(0);
    expect(firstPlayback.isPreroll).toBe(false);
    expect(secondPlayback.sourceTimeMs).toBe(1_000);
    expect(secondPlayback.loopCount).toBe(1);
    expect(secondPlayback.isPreroll).toBe(false);
  });

  it("keeps every Act 4 variation on four-count phrase boundaries", () => {
    for (const config of Object.values(act4SeasonMovementConfig).flatMap(
      Object.values,
    )) {
      const recording =
        seasonRecordings[
          `../assets/movement_library/seasons/${config.configuredMovementId}.json`
        ];
      expect(recording).toBeDefined();
      const durationMs = getMovementRecordingDurationMs(recording!);
      const isEarlyLeadIn = config.id === "winter" || config.id === "summer";

      if (isEarlyLeadIn) {
        expect(durationMs).toBeGreaterThan(8_500);
      }

      for (const seasonElapsedMs of [0, 4_000, 8_000, 12_000]) {
        const position = resolveMovementPlaybackPosition({
          elapsedMs: seasonElapsedMs + config.movementTiming.prerollMs,
          sourceDurationMs: durationMs,
          timing: config.movementTiming,
        });

        expect(position.sourceTimeMs).toBe(
          config.movementTiming.loopStartMs + (seasonElapsedMs % 8_000),
        );
        expect(position.loopCount).toBe(Math.floor(seasonElapsedMs / 8_000));
      }

      if (isEarlyLeadIn) {
        const sourceAt = (seasonElapsedMs: number) =>
          resolveMovementPlaybackPosition({
            elapsedMs: seasonElapsedMs + config.movementTiming.prerollMs,
            sourceDurationMs: durationMs,
            timing: config.movementTiming,
          }).sourceTimeMs;

        expect(sourceAt(7_499)).toBe(8_499);
        expect(sourceAt(7_500)).toBe(500);
        expect(sourceAt(7_750)).toBe(750);
        expect(sourceAt(7_999)).toBe(999);
        expect(sourceAt(8_000)).toBe(1_000);
      } else {
        const finalFrameHold = resolveMovementPlaybackPosition({
          elapsedMs: 8_750,
          sourceDurationMs: durationMs,
          timing: config.movementTiming,
        });
        expect(finalFrameHold.sourceTimeMs).toBe(8_750);
        if (durationMs < 8_750) {
          expect(
            getInterpolatedMovementFrame(
              recording!,
              finalFrameHold.sourceTimeMs,
            )?.landmarks,
          ).toEqual(recording!.frames.at(-1)?.landmarks);
        }
      }
    }
  });
});
