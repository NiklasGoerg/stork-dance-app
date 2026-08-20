import type {
  MigrationMovementRecognitionConfig,
  MigrationMovementRecognitionProfile,
  MigrationMovementSpeed,
} from "~/types/migrationAct";
import type { MovementPlaybackTiming } from "~/types/movement";

export const MIGRATION_MOVEMENT_SPEED_THRESHOLDS_MS = {
  fastMaxMs: 6_000,
  mediumMaxMs: 15_000,
} as const;

// Provisional normalized values; calibrate against the final clips and camera tests.
export const MIGRATION_RECOGNITION_THRESHOLDS = {
  minimumLandmarkVisibility: 0.6,
  ankleMovement: 0.09,
  stanceWidthChange: 0.1,
  minimumBeatSamples: 2,
  summerStepDelta: 0.09,
  summerReturnDelta: 0.07,
  summerMaximumReturnDistance: 0.12,
  summerSupportingStanceChange: 0.05,
  winterStepOutDelta: 0.09,
  winterCloseDelta: 0.07,
  winterStanceChange: 0.06,
  migrationFootActivity: 0.09,
  migrationReturnDelta: 0.07,
  migrationMaximumReturnDistance: 0.14,
  migrationReturnWindowAfterMs: 150,
  migrationStanceChange: 0.05,
  migrationGuidedClosedStanceWidth: 1.45,
  migrationDirectionIsRequired: false,
  wingsUpTolerance: 0.12,
  wingsDownTolerance: 0.2,
  flightArmAboveHip: 0.12,
  flightArmLateralOffset: 0.18,
  verticalBounce: 0.08,
  smoothingWindowMs: 500,
  sampleIntervalMs: 80,
  debugUpdateIntervalMs: 150,
  beatDurationMs: 1_000,
  beatsPerBar: 4,
  barDurationMs: 4_000,
  twoBeatWindowMs: 2_000,
  initialBarCaptureWindowMs: 550,
  maximumWindowSamples: 64,
  minimumTorsoScale: 0.02,
  beatPulseDurationMs: 300,
  springMigrationThresholdScale: 0.9,
} as const;

export const migrationMovementRecognitionConfig = {
  summer_rest: {
    enabled: true,
    blocking: false,
    pulseDurationMs: 300,
    requiredCriteria: ["stepActivity", "stanceWidthChange"],
    optionalCriteria: [],
  },
  winter_rest: {
    enabled: true,
    blocking: false,
    pulseDurationMs: 300,
    requiredCriteria: ["stepActivity"],
    optionalCriteria: ["verticalBounce"],
  },
  migration: {
    enabled: true,
    blocking: false,
    pulseDurationMs: 300,
    requiredCriteria: ["wingBeat", "stepActivity"],
    optionalCriteria: ["directionTrend", "depthTrend", "lean"],
  },
  "migration-guided": {
    enabled: true,
    blocking: false,
    pulseDurationMs: 300,
    requiredCriteria: ["wingBeat", "stepActivity"],
    optionalCriteria: ["directionTrend", "depthTrend", "lean"],
  },
} as const satisfies Record<
  MigrationMovementRecognitionProfile,
  MigrationMovementRecognitionConfig
>;

const createMovementSlot = (
  movementId: string,
  recognitionProfile: MigrationMovementRecognitionProfile,
  playbackTiming: MovementPlaybackTiming,
) => ({
  movementId,
  loop: true,
  recognitionProfile,
  playbackTiming,
});

const createTiming = (
  loopEndMs = 5_000,
  loopTransition?: MovementPlaybackTiming["loopTransition"],
): MovementPlaybackTiming => ({
  sourceFps: 30,
  prerollMs: 1_000,
  loopStartMs: 1_000,
  loopEndMs,
  loopTransition,
});

const migrationLoopTransition = { cutAtMs: 4_500, resumeAtMs: 500 } as const;

export const migrationMovementConfig = {
  summerRest: createMovementSlot("summer-step", "summer_rest", createTiming()),
  winterRest: createMovementSlot("winter-step", "winter_rest", createTiming()),
  outbound: {
    slow: createMovementSlot(
      "autumn-migration-slow",
      "migration",
      createTiming(5_000, migrationLoopTransition),
    ),
    medium: createMovementSlot(
      "autumn-migration-medium",
      "migration",
      createTiming(5_000, migrationLoopTransition),
    ),
    fast: createMovementSlot(
      "autumn-migration-fast",
      "migration",
      createTiming(5_000, migrationLoopTransition),
    ),
  },
  return: {
    slow: createMovementSlot(
      "spring-migration-slow",
      "migration",
      createTiming(4_338.4, { cutAtMs: 4_300, resumeAtMs: 300 }),
    ),
    medium: createMovementSlot(
      "spring-migration-medium",
      "migration",
      createTiming(4_997.6, migrationLoopTransition),
    ),
    fast: createMovementSlot(
      "spring-migration-fast",
      "migration",
      createTiming(5_000, migrationLoopTransition),
    ),
  },
} as const satisfies {
  summerRest: ReturnType<typeof createMovementSlot>;
  winterRest: ReturnType<typeof createMovementSlot>;
  outbound: Record<
    MigrationMovementSpeed,
    ReturnType<typeof createMovementSlot>
  >;
  return: Record<MigrationMovementSpeed, ReturnType<typeof createMovementSlot>>;
};
