import { afterEach, describe, expect, it, vi } from "vitest";
import { useMigrationActMovementRecognition } from "~/composables/migrationActs/useMigrationActMovementRecognition";
import type { PoseLandmarkLike } from "~/types/pose";
import { POSE_LANDMARK } from "~/utils/pose/poseLandmarks";
import {
  evaluateMigrationMovementWindow,
  type MigrationMovementRecognitionSample,
} from "~/utils/migrationActs/migrationMovementCriteria";
import {
  calculateAnkleMovement,
  calculateHipCenter,
  calculateLateralLean,
  calculateShoulderCenter,
  calculateStanceWidth,
  calculateTorsoScale,
  calculateVerticalHipMovement,
} from "~/utils/migrationActs/migrationMovementMetrics";

const createLandmarks = ({
  leftAnkleX = 0.35,
  rightAnkleX = 0.65,
  hipY = 0.55,
  elbowY = 0.3,
}: {
  leftAnkleX?: number;
  rightAnkleX?: number;
  hipY?: number;
  elbowY?: number;
} = {}): PoseLandmarkLike[] => {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
  }));

  landmarks[POSE_LANDMARK.LEFT_SHOULDER] = {
    x: 0.4,
    y: 0.3,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.RIGHT_SHOULDER] = {
    x: 0.6,
    y: 0.3,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.LEFT_HIP] = {
    x: 0.42,
    y: hipY,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.RIGHT_HIP] = {
    x: 0.58,
    y: hipY,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.LEFT_ELBOW] = {
    x: 0.35,
    y: elbowY,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.RIGHT_ELBOW] = {
    x: 0.65,
    y: elbowY,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.LEFT_ANKLE] = {
    x: leftAnkleX,
    y: 0.85,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.RIGHT_ANKLE] = {
    x: rightAnkleX,
    y: 0.85,
    visibility: 1,
  };

  return landmarks;
};

const createSample = ({
  barElapsedMs,
  ankleX,
  stanceWidth,
  hipY = 0.55,
  wingState = "neutral",
}: {
  barElapsedMs: number;
  ankleX: number;
  stanceWidth: number;
  hipY?: number;
  wingState?: MigrationMovementRecognitionSample["wingState"];
}): MigrationMovementRecognitionSample => ({
  timestampMs: barElapsedMs,
  barElapsedMs,
  hipCenter: { x: 0.5, y: hipY },
  torsoScale: 0.2,
  stanceWidth,
  lean: 0,
  leftAnkle: { x: ankleX, y: 0.85 },
  rightAnkle: { x: 0.65, y: 0.85 },
  wingState,
});

const successfulSamples: MigrationMovementRecognitionSample[] = [
  createSample({
    barElapsedMs: 0,
    ankleX: 0.35,
    stanceWidth: 1.5,
    hipY: 0.55,
    wingState: "up",
  }),
  createSample({
    barElapsedMs: 900,
    ankleX: 0.4,
    stanceWidth: 1.1,
    hipY: 0.58,
    wingState: "down",
  }),
  createSample({
    barElapsedMs: 1_800,
    ankleX: 0.36,
    stanceWidth: 1.0,
    hipY: 0.54,
  }),
  createSample({
    barElapsedMs: 2_100,
    ankleX: 0.35,
    stanceWidth: 1.5,
    wingState: "up",
  }),
  createSample({
    barElapsedMs: 3_000,
    ankleX: 0.4,
    stanceWidth: 1.1,
    wingState: "down",
  }),
  createSample({
    barElapsedMs: 3_800,
    ankleX: 0.36,
    stanceWidth: 1.0,
  }),
];

describe("migration movement metrics and criteria", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("derives stable normalized body metrics", () => {
    const start = createLandmarks();
    const moved = createLandmarks({ leftAnkleX: 0.4, hipY: 0.58 });

    expect(calculateHipCenter(start)).toMatchObject({ x: 0.5, y: 0.55 });
    expect(calculateShoulderCenter(start)).toMatchObject({ x: 0.5, y: 0.3 });
    expect(calculateTorsoScale(start)).toBeCloseTo(0.2);
    expect(calculateStanceWidth(start)).toBeCloseTo(1.5);
    expect(calculateAnkleMovement(start, moved)).toBeGreaterThan(0.16);
    expect(calculateVerticalHipMovement(start, moved)).toBeGreaterThan(0.08);
    expect(calculateLateralLean(start)).toBeCloseTo(0);
  });

  it("recognizes a summer step-touch", () => {
    const evaluation = evaluateMigrationMovementWindow(
      "summer_rest",
      successfulSamples,
    );

    expect(evaluation.status).toBe("success");
    expect(evaluation.stepActivity).toBe("success");
    expect(evaluation.stanceWidthChange).toBe("success");
  });

  it("accepts winter step activity without requiring bounce", () => {
    const samplesWithoutBounce = successfulSamples.map((sample) => ({
      ...sample,
      hipCenter: { x: 0.5, y: 0.55 },
    }));
    const evaluation = evaluateMigrationMovementWindow(
      "winter_rest",
      samplesWithoutBounce,
    );

    expect(evaluation.status).toBe("success");
    expect(evaluation.stepActivity).toBe("success");
    expect(evaluation.verticalBounce).toBe("failed");
  });

  it("requires both wing beat and step activity for migration", () => {
    const wingOnly = successfulSamples.map((sample) => ({
      ...sample,
      leftAnkle: { x: 0.35, y: 0.85 },
    }));

    expect(
      evaluateMigrationMovementWindow("migration", successfulSamples).status,
    ).toBe("success");
    expect(
      evaluateMigrationMovementWindow("migration", wingOnly),
    ).toMatchObject({
      status: "failed",
      wingBeat: "success",
      stepActivity: "failed",
    });
  });

  it("marks missing required landmarks as not evaluable", () => {
    const missingSamples = [0, 1_000, 2_000, 3_000].map(
      (barElapsedMs): MigrationMovementRecognitionSample => ({
        timestampMs: barElapsedMs,
        barElapsedMs,
        hipCenter: null,
        torsoScale: null,
        stanceWidth: null,
        lean: null,
        leftAnkle: null,
        rightAnkle: null,
        wingState: "not_evaluable",
      }),
    );

    expect(
      evaluateMigrationMovementWindow("migration", missingSamples).status,
    ).toBe("not_evaluable");
  });

  it("uses the shared skeleton success pulse for a successful window", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const recognition = useMigrationActMovementRecognition();
    const frames = [
      { time: 0, leftAnkleX: 0.35, rightAnkleX: 0.65 },
      { time: 900, leftAnkleX: 0.4, rightAnkleX: 0.6 },
      { time: 1_800, leftAnkleX: 0.36, rightAnkleX: 0.62 },
      { time: 2_100, leftAnkleX: 0.35, rightAnkleX: 0.65 },
      { time: 3_000, leftAnkleX: 0.4, rightAnkleX: 0.6 },
      { time: 3_800, leftAnkleX: 0.36, rightAnkleX: 0.62 },
    ];

    recognition.start("summer_rest", {
      transportTimeMs: 0,
      movementElapsedMs: 0,
      prerollMs: 1_000,
    });
    recognition.handlePoseFrame({
      landmarks: createLandmarks(),
      transportTimeMs: 500,
      timestampMs: 500,
    });
    expect(recognition.currentBeatWindow.value).toBe("preroll");
    expect(recognition.lastEvaluationStatus.value).toBe("idle");
    frames.forEach((frame) =>
      recognition.handlePoseFrame({
        landmarks: createLandmarks(frame),
        transportTimeMs: frame.time + 1_000,
        timestampMs: frame.time + 1_000,
      }),
    );
    recognition.handlePoseFrame({
      landmarks: createLandmarks(),
      transportTimeMs: 5_000,
      timestampMs: 5_000,
    });

    expect(recognition.lastEvaluationStatus.value).toBe("success");
    expect(recognition.skeletonFeedbackState.value.mode).toBe("successPulse");
    expect(recognition.skeletonFeedbackState.value.pulseDurationMs).toBe(300);
    expect(recognition.lastPulseAt.value).not.toBeNull();

    recognition.cleanup();
  });
});
