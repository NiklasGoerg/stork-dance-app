import { describe, expect, it } from "vitest";
import type { PoseLandmarkLike } from "~/types/pose";
import {
  evaluateSpringBeat,
  extractSpringRecognitionMetrics,
} from "~/utils/movement/acts/climate/spring/springMovementRecognition";
import { POSE_LANDMARK } from "~/utils/pose/poseLandmarks";

const point = (x: number, y: number): PoseLandmarkLike => ({
  x,
  y,
  visibility: 1,
});

const midpoint = (
  first: PoseLandmarkLike,
  second: PoseLandmarkLike,
): PoseLandmarkLike => point((first.x + second.x) / 2, (first.y + second.y) / 2);

const createSpringLandmarks = ({
  leftWrist = point(0.5, 0.56),
  rightWrist = point(0.5, 0.56),
}: {
  leftWrist?: PoseLandmarkLike;
  rightWrist?: PoseLandmarkLike;
} = {}): PoseLandmarkLike[] => {
  const landmarks = Array.from({ length: 33 }, () => point(0.5, 0.5));
  const leftShoulder = point(0.4, 0.4);
  const rightShoulder = point(0.6, 0.4);

  landmarks[POSE_LANDMARK.LEFT_SHOULDER] = leftShoulder;
  landmarks[POSE_LANDMARK.RIGHT_SHOULDER] = rightShoulder;
  landmarks[POSE_LANDMARK.LEFT_HIP] = point(0.42, 0.7);
  landmarks[POSE_LANDMARK.RIGHT_HIP] = point(0.58, 0.7);
  landmarks[POSE_LANDMARK.LEFT_WRIST] = leftWrist;
  landmarks[POSE_LANDMARK.RIGHT_WRIST] = rightWrist;
  landmarks[POSE_LANDMARK.LEFT_ELBOW] = midpoint(leftShoulder, leftWrist);
  landmarks[POSE_LANDMARK.RIGHT_ELBOW] = midpoint(rightShoulder, rightWrist);
  landmarks[POSE_LANDMARK.LEFT_KNEE] = point(0.42, 0.82);
  landmarks[POSE_LANDMARK.RIGHT_KNEE] = point(0.58, 0.82);
  landmarks[POSE_LANDMARK.LEFT_ANKLE] = point(0.42, 0.94);
  landmarks[POSE_LANDMARK.RIGHT_ANKLE] = point(0.58, 0.94);

  return landmarks;
};

describe("spring movement recognition", () => {
  it("accepts a looser beat 1 start with low, slightly opened hands", () => {
    const result = evaluateSpringBeat(
      createSpringLandmarks({
        leftWrist: point(0.35, 0.54),
        rightWrist: point(0.65, 0.54),
      }),
      1,
      0,
    );

    expect(result.passed).toBe(true);
    expect(result.metrics.lowerHandHeight).toBeCloseTo(0.53, 2);
    expect(result.metrics.normalizedHandDistance).toBeCloseTo(1.5, 2);
    expect(result.feedbackCode).toBeUndefined();
  });

  it("still rejects beat 1 when the hands start too high", () => {
    const result = evaluateSpringBeat(
      createSpringLandmarks({
        leftWrist: point(0.44, 0.49),
        rightWrist: point(0.56, 0.49),
      }),
      1,
      0,
    );

    expect(result.passed).toBe(false);
    expect(result.feedbackCode).toBe("START_HANDS_LOW");
  });

  it("still rejects beat 1 when the hands start far outside the body", () => {
    const result = evaluateSpringBeat(
      createSpringLandmarks({
        leftWrist: point(0.2, 0.55),
        rightWrist: point(0.8, 0.55),
      }),
      1,
      0,
    );

    expect(result.passed).toBe(false);
    expect(result.feedbackCode).toBe("KEEP_HANDS_CLOSE_TO_BODY");
  });

  it.each([
    ["20", point(0.47, 0.675), point(0.53, 0.675)],
    ["30", point(0.45, 0.49), point(0.55, 0.49)],
    ["40", point(0.44, 0.4), point(0.56, 0.4)],
  ] as const)(
    "accepts a generous %s% spring value range",
    (expectedValue, leftWrist, rightWrist) => {
      const result = evaluateSpringBeat(
        createSpringLandmarks({ leftWrist, rightWrist }),
        3,
        0,
        { expectedValue },
      );

      expect(result.passed).toBe(true);
      expect(result.feedbackCode).toBeUndefined();
    },
  );

  it("accepts a 100% beat 3 overhead bloom with hands slightly apart", () => {
    const landmarks = createSpringLandmarks({
      leftWrist: point(0.42, 0.36),
      rightWrist: point(0.58, 0.36),
    });
    const metrics = extractSpringRecognitionMetrics(landmarks);
    const result = evaluateSpringBeat(landmarks, 3, 0, {
      expectedValue: "100",
    });

    expect(metrics.handsGathered).toBe(false);
    expect(metrics.overheadBloom).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.feedbackCode).toBeUndefined();
  });

  it("still rejects a 100% beat 3 bloom when the hands are below overhead", () => {
    const result = evaluateSpringBeat(
      createSpringLandmarks({
        leftWrist: point(0.42, 0.38),
        rightWrist: point(0.58, 0.38),
      }),
      3,
      0,
      { expectedValue: "100" },
    );

    expect(result.passed).toBe(false);
    expect(result.feedbackCode).toBe("REACH_ABOVE_HEAD");
  });
});
