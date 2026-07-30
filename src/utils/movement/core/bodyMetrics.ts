import type { PoseLandmarkLike } from "~/types/pose";
import {
  averageValid,
  calculateJointAngle,
  distance2D,
  midpoint,
  toPosePoint,
  type PosePoint,
} from "~/utils/pose/poseGeometry";
import { MIN_SHOULDER_WIDTH, POSE_LANDMARK } from "~/utils/pose/poseLandmarks";

export type BodyFrameMetrics = {
  shoulderWidth: number | null;
  leftShoulder: PosePoint | null;
  rightShoulder: PosePoint | null;
  shoulderCenter: PosePoint | null;
  leftHip: PosePoint | null;
  rightHip: PosePoint | null;
  hipCenter: PosePoint | null;
  torsoCenter: PosePoint | null;
  leftTorsoLength: number | null;
  rightTorsoLength: number | null;
  torsoLength: number | null;
  headPoint: PosePoint | null;
  leftElbow: PosePoint | null;
  rightElbow: PosePoint | null;
  leftWrist: PosePoint | null;
  rightWrist: PosePoint | null;
  leftKnee: PosePoint | null;
  rightKnee: PosePoint | null;
  leftAnkle: PosePoint | null;
  rightAnkle: PosePoint | null;
  handCenter: PosePoint | null;
  leftElbowAngle: number | null;
  rightElbowAngle: number | null;
  averageElbowAngle: number | null;
  leftKneeAngle: number | null;
  rightKneeAngle: number | null;
  averageKneeAngle: number | null;
  normalizedHandDistance: number | null;
  normalizedAnkleDistance: number | null;
  normalizedWristSpan: number | null;
  signedHandCenterXOffset: number | null;
  handCenterXOffset: number | null;
  handCenterYFromShoulders: number | null;
  signedTorsoCenterXOffset: number | null;
  torsoCenterXOffset: number | null;
  landmarkConfidence: "ok" | "missing-body-reference";
};

export type NormalizedBodyMetrics = BodyFrameMetrics;

const getLandmark = (landmarks: PoseLandmarkLike[], index: number) =>
  landmarks[index] ?? null;

const getHeadPoint = (landmarks: PoseLandmarkLike[]) =>
  toPosePoint(getLandmark(landmarks, POSE_LANDMARK.NOSE)) ??
  midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_EAR),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_EAR),
  );

export const extractNormalizedBodyMetrics = (
  landmarks: PoseLandmarkLike[] | null | undefined,
): BodyFrameMetrics => {
  const emptyMetrics: BodyFrameMetrics = {
    shoulderWidth: null,
    leftShoulder: null,
    rightShoulder: null,
    shoulderCenter: null,
    leftHip: null,
    rightHip: null,
    hipCenter: null,
    torsoCenter: null,
    leftTorsoLength: null,
    rightTorsoLength: null,
    torsoLength: null,
    headPoint: null,
    leftElbow: null,
    rightElbow: null,
    leftWrist: null,
    rightWrist: null,
    leftKnee: null,
    rightKnee: null,
    leftAnkle: null,
    rightAnkle: null,
    handCenter: null,
    leftElbowAngle: null,
    rightElbowAngle: null,
    averageElbowAngle: null,
    leftKneeAngle: null,
    rightKneeAngle: null,
    averageKneeAngle: null,
    normalizedHandDistance: null,
    normalizedAnkleDistance: null,
    normalizedWristSpan: null,
    signedHandCenterXOffset: null,
    handCenterXOffset: null,
    handCenterYFromShoulders: null,
    signedTorsoCenterXOffset: null,
    torsoCenterXOffset: null,
    landmarkConfidence: "missing-body-reference",
  };

  if (!landmarks?.length) return emptyMetrics;

  const leftShoulder = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_SHOULDER),
  );
  const rightShoulder = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_SHOULDER),
  );
  const leftHip = toPosePoint(getLandmark(landmarks, POSE_LANDMARK.LEFT_HIP));
  const rightHip = toPosePoint(getLandmark(landmarks, POSE_LANDMARK.RIGHT_HIP));
  const leftElbow = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_ELBOW),
  );
  const rightElbow = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_ELBOW),
  );
  const leftWrist = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_WRIST),
  );
  const rightWrist = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_WRIST),
  );
  const leftKnee = toPosePoint(getLandmark(landmarks, POSE_LANDMARK.LEFT_KNEE));
  const rightKnee = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_KNEE),
  );
  const leftAnkle = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_ANKLE),
  );
  const rightAnkle = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_ANKLE),
  );
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
  const headPoint = getHeadPoint(landmarks);

  if (!shoulderCenter || !shoulderWidth || shoulderWidth < MIN_SHOULDER_WIDTH) {
    return {
      ...emptyMetrics,
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      hipCenter,
      headPoint,
      leftElbow,
      rightElbow,
      leftWrist,
      rightWrist,
      leftKnee,
      rightKnee,
      leftAnkle,
      rightAnkle,
    };
  }

  const handCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_WRIST),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_WRIST),
  );
  const handDistance =
    leftWrist && rightWrist ? distance2D(leftWrist, rightWrist) : null;
  const ankleDistance =
    leftAnkle && rightAnkle ? distance2D(leftAnkle, rightAnkle) : null;
  const leftTorsoLength = distance2D(leftShoulder, leftHip);
  const rightTorsoLength = distance2D(rightShoulder, rightHip);
  const torsoLength = averageValid([leftTorsoLength, rightTorsoLength]);
  const leftElbowAngle = calculateJointAngle(
    leftShoulder,
    leftElbow,
    leftWrist,
  );
  const rightElbowAngle = calculateJointAngle(
    rightShoulder,
    rightElbow,
    rightWrist,
  );
  const leftKneeAngle = calculateJointAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateJointAngle(rightHip, rightKnee, rightAnkle);
  const signedHandCenterXOffset = handCenter
    ? (handCenter.x - shoulderCenter.x) / shoulderWidth
    : null;
  const signedTorsoCenterXOffset = hipCenter
    ? (hipCenter.x - shoulderCenter.x) / shoulderWidth
    : null;

  return {
    shoulderWidth,
    leftShoulder,
    rightShoulder,
    shoulderCenter,
    leftHip,
    rightHip,
    hipCenter,
    torsoCenter: hipCenter ?? shoulderCenter,
    leftTorsoLength,
    rightTorsoLength,
    torsoLength,
    headPoint,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    handCenter,
    leftElbowAngle,
    rightElbowAngle,
    averageElbowAngle: averageValid([leftElbowAngle, rightElbowAngle]),
    leftKneeAngle,
    rightKneeAngle,
    averageKneeAngle: averageValid([leftKneeAngle, rightKneeAngle]),
    normalizedHandDistance:
      handDistance !== null ? handDistance / shoulderWidth : null,
    normalizedAnkleDistance:
      ankleDistance !== null ? ankleDistance / shoulderWidth : null,
    normalizedWristSpan:
      leftWrist && rightWrist
        ? Math.abs(rightWrist.x - leftWrist.x) / shoulderWidth
        : null,
    signedHandCenterXOffset,
    handCenterXOffset: signedHandCenterXOffset,
    handCenterYFromShoulders: handCenter
      ? (handCenter.y - shoulderCenter.y) / shoulderWidth
      : null,
    signedTorsoCenterXOffset,
    torsoCenterXOffset: signedTorsoCenterXOffset,
    landmarkConfidence: "ok",
  };
};
