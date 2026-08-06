import type { StoryGestureId } from "~/story/gestures";

export type MigrationCheckpointCriterion =
  | "moderate_crouch"
  | "rise"
  | "hands_up"
  | "arms_out"
  | "arms_lowered_or_closer";

export type MigrationMovementCheckpointDefinition = {
  id: string;
  targetSourceTimeMs: number;
  windowBeforeMs: number;
  windowAfterMs: number;
  required: boolean;
  criteria: readonly MigrationCheckpointCriterion[];
};

export type MigrationGestureMovementDefinition = {
  id: StoryGestureId;
  movementId: string;
  prerollMs: number;
  attemptEndSourceTimeMs: number;
  feedbackBeats: number;
  checkpoints: readonly MigrationMovementCheckpointDefinition[];
};

export const migrationGestureThresholds = {
  landmarkVisibility: 0.45,
  sufficientBodyDrop: 0.22,
  moderateBodyDrop: 0.1,
  unilateralKneeFlexion: 16,
  handsUpPrimary: 0.25,
  handsUpSecondary: -0.05,
  riseDistance: 0.18,
  armsOutSpan: 2.4,
  armsOutHeightTolerance: 0.75,
  armsOutElbowAngle: 145,
  armsOutLowerThanHandsUp: 0.05,
  armsLoweredDistance: 0.3,
  armsCloserRatio: 0.75,
} as const;

export const migrationGestureMovementDefinitions = {
  departure: {
    id: "departure",
    movementId: "departure-gesture",
    prerollMs: 1_000,
    attemptEndSourceTimeMs: 4_400,
    feedbackBeats: 4,
    checkpoints: [
      {
        id: "departure-crouch",
        targetSourceTimeMs: 1_000,
        windowBeforeMs: 400,
        windowAfterMs: 600,
        required: true,
        criteria: ["moderate_crouch"],
      },
      {
        id: "departure-rise-hands",
        targetSourceTimeMs: 2_000,
        windowBeforeMs: 350,
        windowAfterMs: 650,
        required: true,
        criteria: ["rise", "hands_up"],
      },
      {
        id: "departure-arms-out",
        targetSourceTimeMs: 3_000,
        windowBeforeMs: 400,
        windowAfterMs: 700,
        required: false,
        criteria: ["arms_out"],
      },
    ],
  },
  arrival: {
    id: "arrival",
    movementId: "arrival-gesture",
    prerollMs: 1_000,
    attemptEndSourceTimeMs: 4_400,
    feedbackBeats: 4,
    checkpoints: [
      {
        id: "arrival-arms-out",
        targetSourceTimeMs: 1_000,
        windowBeforeMs: 400,
        windowAfterMs: 600,
        required: true,
        criteria: ["arms_out"],
      },
      {
        id: "arrival-descent",
        targetSourceTimeMs: 2_000,
        windowBeforeMs: 350,
        windowAfterMs: 550,
        required: false,
        criteria: ["arms_lowered_or_closer"],
      },
      {
        id: "arrival-landing",
        targetSourceTimeMs: 2_600,
        windowBeforeMs: 600,
        windowAfterMs: 1_000,
        required: true,
        criteria: ["moderate_crouch", "arms_lowered_or_closer"],
      },
    ],
  },
} as const satisfies Record<StoryGestureId, MigrationGestureMovementDefinition>;

export const getMigrationGestureMovementDefinition = (id: StoryGestureId) =>
  migrationGestureMovementDefinitions[id];

export const getMigrationCheckpointWindow = (
  checkpoint: MigrationMovementCheckpointDefinition,
) => ({
  startMs: checkpoint.targetSourceTimeMs - checkpoint.windowBeforeMs,
  endMs: checkpoint.targetSourceTimeMs + checkpoint.windowAfterMs,
});

export const getMigrationGestureBeatForCheckpoint = (checkpointId: string) => {
  const beats: Record<string, 1 | 2 | 3> = {
    "departure-crouch": 1,
    "departure-rise-hands": 2,
    "departure-arms-out": 3,
    "arrival-arms-out": 1,
    "arrival-descent": 2,
    "arrival-landing": 3,
  };
  return beats[checkpointId] ?? null;
};

export const resolveGestureCountdownSourceTime = ({
  definition,
  elapsedMs,
  durationMs,
}: {
  definition: MigrationGestureMovementDefinition;
  elapsedMs: number;
  durationMs: number;
}) =>
  definition.prerollMs +
  Math.min(Math.max(elapsedMs / Math.max(durationMs, 1), 0), 1) *
    (definition.attemptEndSourceTimeMs - definition.prerollMs);
