import { describe, expect, it } from "vitest";
import { act5SeasonMovementConfig } from "~/story/act5IntroCycle";
import type { MovementRecording } from "~/types/movement";
import { migrationMovementConfig } from "~/utils/migrationActs/migrationMovementConfig";
import {
  getMigrationMovementDirection,
  resolveMigrationMovement,
} from "~/utils/migrationActs/migrationMovementSelection";
import { getMovementRecordingDurationMs } from "~/utils/movementPlaybackTiming";

const movementModules = import.meta.glob<MovementRecording>(
  "../assets/movement_library/{migration,seasons}/*.json",
  { eager: true, import: "default" },
);

const readMovement = (folder: "migration" | "seasons", movementId: string) => {
  const recording =
    movementModules[`../assets/movement_library/${folder}/${movementId}.json`];

  if (!recording) throw new Error(`Missing test movement ${movementId}.`);

  return recording;
};

describe("movement asset configuration", () => {
  it("loads every configured migration recording at 30 FPS", () => {
    const slots = [
      migrationMovementConfig.summerRest,
      migrationMovementConfig.winterRest,
      ...Object.values(migrationMovementConfig.outbound),
      ...Object.values(migrationMovementConfig.return),
    ];

    expect(slots).toHaveLength(8);
    slots.forEach((slot) => {
      const recording = readMovement("migration", slot.movementId);

      expect(recording.name).toBe(slot.movementId);
      expect(recording.fps).toBe(30);
      expect(recording.frames.length).toBeGreaterThan(100);
      expect(getMovementRecordingDurationMs(recording)).toBeGreaterThan(4_000);
      expect(
        recording.frames.every((frame) => Number.isFinite(frame.time)),
      ).toBe(true);
    });
  });

  it("maps the rest phases to their real step recordings", () => {
    expect(
      resolveMigrationMovement({
        phase: "summer_rest",
        phaseDurationMs: 20_000,
      }),
    ).toMatchObject({
      movementId: "summer-step",
      recognitionProfile: "summer_rest",
      speedClass: null,
    });
    expect(
      resolveMigrationMovement({
        phase: "winter_rest",
        phaseDurationMs: 20_000,
      }),
    ).toMatchObject({
      movementId: "winter-step",
      recognitionProfile: "winter_rest",
      speedClass: null,
    });
  });

  it("loads every Act 5 intensity without a 100-percent fallback", () => {
    const configs = Object.values(act5SeasonMovementConfig).flatMap((season) =>
      Object.values(season),
    );

    expect(configs).toHaveLength(17);
    configs.forEach((config) => {
      const movementId = config.configuredMovementId;

      expect(movementId).toBeTruthy();
      const recording = readMovement("seasons", movementId!);
      expect(recording.name).toBe(movementId);
      expect(recording.fps).toBe(30);
      expect(config.usingFallbackMovement).toBe(false);
      expect(config.movementTiming).toEqual({
        sourceFps: 30,
        prerollMs: 1_000,
        loopStartMs: 1_000,
        loopEndMs: 9_000,
      });
      expect(config.movementLoopDurationMs).toBe(8_000);
    });
  });

  it("uses the new full-length Winter recordings", () => {
    Object.values(act5SeasonMovementConfig.winter).forEach((config) => {
      const movementId = config.configuredMovementId;
      if (!movementId) throw new Error("Winter movement ID is required.");
      const recording = readMovement("seasons", movementId);

      expect(getMovementRecordingDurationMs(recording)).toBeGreaterThan(8_000);
      expect(config.movementLoopDurationMs).toBe(8_000);
    });
  });

  it.each([
    ["autumn_migration", 24_842.383, "autumn-migration-slow"],
    ["spring_migration", 33_424.297, "spring-migration-slow"],
    ["autumn_migration", 8_581.914, "autumn-migration-medium"],
    ["spring_migration", 8_130.234, "spring-migration-medium"],
    ["autumn_migration", 8_130.234, "autumn-migration-medium"],
    ["spring_migration", 3_613.437, "spring-migration-fast"],
    ["autumn_migration", 3_161.758, "autumn-migration-fast"],
    ["spring_migration", 6_775.195, "spring-migration-medium"],
    ["autumn_migration", 4_968.477, "autumn-migration-fast"],
    ["spring_migration", 12_195.351, "spring-migration-medium"],
  ] as const)(
    "maps %s at %d ms to %s",
    (phase, phaseDurationMs, expectedMovementId) => {
      expect(
        resolveMigrationMovement({
          phase,
          direction: getMigrationMovementDirection(phase),
          phaseDurationMs,
        }).movementId,
      ).toBe(expectedMovementId);
    },
  );
});
