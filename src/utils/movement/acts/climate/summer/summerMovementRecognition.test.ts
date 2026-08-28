import { describe, expect, it } from "vitest";
import { evaluateSummerBeat } from "~/utils/movement/acts/climate/summer/summerMovementRecognition";
import type { PoseLandmarkLike } from "~/types/pose";
import { POSE_LANDMARK } from "~/utils/pose/poseLandmarks";

const createLandmarks = ({
  leftWristX = 0.34,
  rightWristX = 0.66,
  wristY = 0.22,
}: {
  leftWristX?: number;
  rightWristX?: number;
  wristY?: number;
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
  landmarks[POSE_LANDMARK.LEFT_HIP] = { x: 0.42, y: 0.58, visibility: 1 };
  landmarks[POSE_LANDMARK.RIGHT_HIP] = { x: 0.58, y: 0.58, visibility: 1 };
  landmarks[POSE_LANDMARK.LEFT_ELBOW] = {
    x: leftWristX < 0.5 ? 0.38 : 0.48,
    y: wristY + 0.05,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.RIGHT_ELBOW] = {
    x: rightWristX > 0.5 ? 0.62 : 0.52,
    y: wristY + 0.05,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.LEFT_WRIST] = {
    x: leftWristX,
    y: wristY,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.RIGHT_WRIST] = {
    x: rightWristX,
    y: wristY,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.LEFT_ANKLE] = {
    x: 0.34,
    y: 0.86,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.RIGHT_ANKLE] = {
    x: 0.66,
    y: 0.86,
    visibility: 1,
  };

  return landmarks;
};

describe("Summer movement recognition", () => {
  it("allows green feedback for a loose Count-3 circle continuation", () => {
    const evaluation = evaluateSummerBeat(createLandmarks(), 3, 0, {
      expectedIntensity: "100",
      expansionReference: {
        normalizedAnkleDistance: 1.4,
        lowestHandHeightFromShoulders: -0.6,
      },
    });

    expect(evaluation.passed).toBe(true);
    expect(evaluation.negativeFeedbackEligible).toBe(true);
    expect(evaluation.feedbackSignals).toEqual([]);
  });

  it("makes an imperfect Count-3 transition non-punitive", () => {
    const evaluation = evaluateSummerBeat(
      createLandmarks({ leftWristX: 0.49, rightWristX: 0.51, wristY: 0.17 }),
      3,
      0,
      {
        expectedIntensity: "100",
        expansionReference: {
          normalizedAnkleDistance: 1.4,
          lowestHandHeightFromShoulders: -0.6,
        },
      },
    );

    expect(evaluation.passed).toBe(false);
    expect(evaluation.negativeFeedbackEligible).toBe(false);
    expect(evaluation.feedbackCode).toBeUndefined();
    expect(evaluation.feedbackSignals).toEqual([]);
  });
});
