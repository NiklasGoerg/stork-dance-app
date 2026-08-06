import { describe, expect, it } from "vitest";
import type { PoseLandmarkLike } from "~/types/pose";
import {
  collectMovementPoseBaseline,
  evaluateMigrationCheckpoint,
  evaluateModerateCrouch,
  extractMovementPoseMetrics,
  type TimedMigrationPoseSample,
} from "~/utils/migrationActs/migrationMovementEvaluation";
import {
  getMigrationGestureBeatForCheckpoint,
  migrationGestureMovementDefinitions,
  resolveGestureCountdownSourceTime,
  type MigrationMovementCheckpointDefinition,
} from "~/utils/migrationActs/migrationMovementDefinitions";
import { POSE_LANDMARK } from "~/utils/pose/poseLandmarks";

const point = (x: number, y: number): PoseLandmarkLike => ({
  x,
  y,
  visibility: 1,
  presence: 1,
});

const pose = ({
  shoulderY = 0.3,
  hipY = 0.5,
  kneeY = 0.7,
  wrists,
  ankles = false,
}: {
  shoulderY?: number;
  hipY?: number;
  kneeY?: number;
  wrists?: { left: [number, number]; right: [number, number] };
  ankles?: boolean;
} = {}): PoseLandmarkLike[] => {
  const landmarks = Array.from({ length: 33 }, () => point(0, 0));
  for (const landmark of landmarks) landmark.visibility = 0;
  landmarks[POSE_LANDMARK.LEFT_SHOULDER] = point(0.4, shoulderY);
  landmarks[POSE_LANDMARK.RIGHT_SHOULDER] = point(0.6, shoulderY);
  landmarks[POSE_LANDMARK.LEFT_HIP] = point(0.43, hipY);
  landmarks[POSE_LANDMARK.RIGHT_HIP] = point(0.57, hipY);
  landmarks[POSE_LANDMARK.LEFT_KNEE] = point(0.43, kneeY);
  landmarks[POSE_LANDMARK.RIGHT_KNEE] = point(0.57, kneeY);
  if (ankles) {
    landmarks[POSE_LANDMARK.LEFT_ANKLE] = point(0.43, 0.9);
    landmarks[POSE_LANDMARK.RIGHT_ANKLE] = point(0.57, 0.9);
  }
  if (wrists) {
    landmarks[POSE_LANDMARK.LEFT_ELBOW] = point(
      (0.4 + wrists.left[0]) / 2,
      (shoulderY + wrists.left[1]) / 2,
    );
    landmarks[POSE_LANDMARK.RIGHT_ELBOW] = point(
      (0.6 + wrists.right[0]) / 2,
      (shoulderY + wrists.right[1]) / 2,
    );
    landmarks[POSE_LANDMARK.LEFT_WRIST] = point(...wrists.left);
    landmarks[POSE_LANDMARK.RIGHT_WRIST] = point(...wrists.right);
  }
  return landmarks;
};

const samples = (
  landmarks: PoseLandmarkLike[],
  sourceTimeMs = 1_000,
): TimedMigrationPoseSample[] =>
  Array.from({ length: 6 }, (_, index) => ({
    sourceTimeMs: sourceTimeMs + index,
    landmarks,
  }));

const baseline = () => collectMovementPoseBaseline(samples(pose(), 0))!;
const checkpoint = (
  criterion: MigrationMovementCheckpointDefinition["criteria"][number],
): MigrationMovementCheckpointDefinition => ({
  id: criterion,
  targetSourceTimeMs: 1_000,
  windowBeforeMs: 400,
  windowAfterMs: 400,
  required: true,
  criteria: [criterion],
});

describe("migration movement evaluation", () => {
  it("evaluates crouch without ankles when shoulders, hips, and a knee are visible", () => {
    const metrics = extractMovementPoseMetrics(
      pose({ shoulderY: 0.35, hipY: 0.55 }),
    );

    expect(metrics.leftKneeAngle).toBeNull();
    expect(evaluateModerateCrouch(baseline(), metrics)?.passed).toBe(true);
  });

  it("distinguishes a shallow crouch from missing pose information", () => {
    const shallow = evaluateMigrationCheckpoint({
      checkpoint: checkpoint("moderate_crouch"),
      samples: samples(pose({ shoulderY: 0.31, hipY: 0.51 })),
      baseline: baseline(),
      references: {},
    });
    const missing = evaluateMigrationCheckpoint({
      checkpoint: checkpoint("moderate_crouch"),
      samples: samples([]),
      baseline: baseline(),
      references: {},
    });

    expect(shallow.status).toBe("failed");
    expect(missing.status).toBe("not_evaluable");
  });

  it("selects a valid best sample even when another frame is invalid", () => {
    const result = evaluateMigrationCheckpoint({
      checkpoint: checkpoint("moderate_crouch"),
      samples: [
        { sourceTimeMs: 900, landmarks: [] },
        {
          sourceTimeMs: 1_100,
          landmarks: pose({ shoulderY: 0.36, hipY: 0.56 }),
        },
      ],
      baseline: baseline(),
      references: {},
    });

    expect(result.status).toBe("success");
    expect(result.criteria[0]?.selectedSampleTimestampMs).toBe(1_100);
  });

  it("requires both assessed arms for hands-up and arms-out", () => {
    const armsOut = pose({
      wrists: { left: [0.1, 0.3], right: [0.9, 0.3] },
    });
    armsOut[POSE_LANDMARK.RIGHT_ELBOW]!.visibility = 0;

    expect(
      evaluateMigrationCheckpoint({
        checkpoint: checkpoint("arms_out"),
        samples: samples(armsOut),
        baseline: baseline(),
        references: {},
      }).status,
    ).toBe("not_evaluable");
  });

  it("declares only the intended Departure and Arrival checkpoints", () => {
    expect(migrationGestureMovementDefinitions.departure.checkpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          criteria: ["moderate_crouch"],
          required: true,
        }),
        expect.objectContaining({
          criteria: ["rise", "hands_up"],
          required: true,
        }),
        expect.objectContaining({ criteria: ["arms_out"], required: false }),
      ]),
    );
    expect(
      migrationGestureMovementDefinitions.arrival.checkpoints[1],
    ).toMatchObject({
      criteria: ["arms_lowered_or_closer"],
      required: false,
    });
    expect(
      migrationGestureMovementDefinitions.arrival.checkpoints[2],
    ).toMatchObject({
      criteria: ["moderate_crouch", "arms_lowered_or_closer"],
      required: true,
    });
  });

  it("maps gesture countdown playback and local feedback beats", () => {
    const definition = migrationGestureMovementDefinitions.departure;
    expect(
      resolveGestureCountdownSourceTime({
        definition,
        elapsedMs: 0,
        durationMs: 4_000,
      }),
    ).toBe(1_000);
    expect(
      resolveGestureCountdownSourceTime({
        definition,
        elapsedMs: 4_000,
        durationMs: 4_000,
      }),
    ).toBe(4_400);
    expect(getMigrationGestureBeatForCheckpoint("departure-crouch")).toBe(1);
    expect(getMigrationGestureBeatForCheckpoint("departure-rise-hands")).toBe(
      2,
    );
    expect(getMigrationGestureBeatForCheckpoint("departure-arms-out")).toBe(3);
    expect(getMigrationGestureBeatForCheckpoint("arrival-arms-out")).toBe(1);
    expect(getMigrationGestureBeatForCheckpoint("arrival-descent")).toBe(2);
    expect(getMigrationGestureBeatForCheckpoint("arrival-landing")).toBe(3);
  });
});
