import type { PoseLandmarkLike } from "~/types/pose";
import {
  distance2D,
  midpoint,
  toPosePoint,
  type PosePoint,
} from "~/utils/pose/poseGeometry";
import { MIN_SHOULDER_WIDTH, POSE_LANDMARK } from "~/utils/pose/poseLandmarks";

export type NormalizedBodyMetrics = {
  shoulderWidth: number | null;
  shoulderCenter: PosePoint | null;
  hipCenter: PosePoint | null;
  torsoCenter: PosePoint | null;
  leftWrist: PosePoint | null;
  rightWrist: PosePoint | null;
  leftAnkle: PosePoint | null;
  rightAnkle: PosePoint | null;
  handCenter: PosePoint | null;
  normalizedHandDistance: number | null;
  normalizedAnkleDistance: number | null;
  landmarkConfidence: "ok" | "missing-body-reference";
};

const getLandmark = (landmarks: PoseLandmarkLike[], index: number) =>
  landmarks[index] ?? null;

export const extractNormalizedBodyMetrics = (
  landmarks: PoseLandmarkLike[] | null | undefined,
): NormalizedBodyMetrics => {
  const emptyMetrics: NormalizedBodyMetrics = {
    shoulderWidth: null,
    shoulderCenter: null,
    hipCenter: null,
    torsoCenter: null,
    leftWrist: null,
    rightWrist: null,
    leftAnkle: null,
    rightAnkle: null,
    handCenter: null,
    normalizedHandDistance: null,
    normalizedAnkleDistance: null,
    landmarkConfidence: "missing-body-reference",
  };

  if (!landmarks?.length) return emptyMetrics;

  const shoulderCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_SHOULDER),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_SHOULDER),
  );
  const hipCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_HIP),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_HIP),
  );
  const shoulderWidth = distance2D(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_SHOULDER),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_SHOULDER),
  );

  if (!shoulderCenter || !shoulderWidth || shoulderWidth < MIN_SHOULDER_WIDTH) {
    return emptyMetrics;
  }

  const leftWrist = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_WRIST),
  );
  const rightWrist = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_WRIST),
  );
  const leftAnkle = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_ANKLE),
  );
  const rightAnkle = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_ANKLE),
  );
  const handCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_WRIST),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_WRIST),
  );
  const handDistance =
    leftWrist && rightWrist ? distance2D(leftWrist, rightWrist) : null;
  const ankleDistance =
    leftAnkle && rightAnkle ? distance2D(leftAnkle, rightAnkle) : null;

  return {
    shoulderWidth,
    shoulderCenter,
    hipCenter,
    torsoCenter: hipCenter ?? shoulderCenter,
    leftWrist,
    rightWrist,
    leftAnkle,
    rightAnkle,
    handCenter,
    normalizedHandDistance:
      handDistance !== null ? handDistance / shoulderWidth : null,
    normalizedAnkleDistance:
      ankleDistance !== null ? ankleDistance / shoulderWidth : null,
    landmarkConfidence: "ok",
  };
};
