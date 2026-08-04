import type { PoseLandmarkLike } from "~/types/pose";
import type { PosePoint } from "~/utils/pose/poseGeometry";
import { POSE_LANDMARK } from "~/utils/pose/poseLandmarks";
import { MIGRATION_RECOGNITION_THRESHOLDS } from "~/utils/migrationActs/migrationMovementConfig";
import { migrationGestureThresholds } from "~/utils/migrationActs/migrationMovementDefinitions";

const getVisiblePoint = (
  landmarks: PoseLandmarkLike[] | null | undefined,
  index: number,
  minimumVisibility: number = MIGRATION_RECOGNITION_THRESHOLDS.minimumLandmarkVisibility,
): PosePoint | null => {
  const point = landmarks?.[index];

  if (
    !point ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    (point.visibility ?? 1) < minimumVisibility ||
    (point.presence ?? 1) < minimumVisibility
  ) {
    return null;
  }

  return { x: point.x, y: point.y, z: point.z ?? 0 };
};

const midpoint = (left: PosePoint | null, right: PosePoint | null) =>
  left && right
    ? {
        x: (left.x + right.x) / 2,
        y: (left.y + right.y) / 2,
        z: ((left.z ?? 0) + (right.z ?? 0)) / 2,
      }
    : null;

const distance = (first: PosePoint | null, second: PosePoint | null) =>
  first && second ? Math.hypot(first.x - second.x, first.y - second.y) : null;

const jointAngle = (
  first: PosePoint | null,
  joint: PosePoint | null,
  last: PosePoint | null,
) => {
  if (!first || !joint || !last) return null;
  const firstLength = distance(first, joint);
  const lastLength = distance(last, joint);
  if (!firstLength || !lastLength) return null;
  const firstVector = {
    x: first.x - joint.x,
    y: first.y - joint.y,
    z: (first.z ?? 0) - (joint.z ?? 0),
  };
  const lastVector = {
    x: last.x - joint.x,
    y: last.y - joint.y,
    z: (last.z ?? 0) - (joint.z ?? 0),
  };
  const cosine = Math.min(
    1,
    Math.max(
      -1,
      (firstVector.x * lastVector.x +
        firstVector.y * lastVector.y +
        firstVector.z * lastVector.z) /
        (firstLength * lastLength),
    ),
  );
  return (Math.acos(cosine) * 180) / Math.PI;
};

const median = (values: Array<number | null>) => {
  const valid = values
    .filter(
      (value): value is number => value !== null && Number.isFinite(value),
    )
    .sort((first, second) => first - second);

  if (!valid.length) return null;

  const middle = Math.floor(valid.length / 2);
  const upper = valid[middle];
  const lower = valid[Math.max(0, middle - 1)];

  if (upper === undefined || lower === undefined) return null;

  return valid.length % 2 === 0 ? (lower + upper) / 2 : upper;
};

export const calculateHipCenter = (
  landmarks: PoseLandmarkLike[] | null | undefined,
) =>
  midpoint(
    getVisiblePoint(landmarks, POSE_LANDMARK.LEFT_HIP),
    getVisiblePoint(landmarks, POSE_LANDMARK.RIGHT_HIP),
  );

export const calculateShoulderCenter = (
  landmarks: PoseLandmarkLike[] | null | undefined,
) =>
  midpoint(
    getVisiblePoint(landmarks, POSE_LANDMARK.LEFT_SHOULDER),
    getVisiblePoint(landmarks, POSE_LANDMARK.RIGHT_SHOULDER),
  );

export const calculateTorsoScale = (
  landmarks: PoseLandmarkLike[] | null | undefined,
) => {
  const leftShoulder = getVisiblePoint(landmarks, POSE_LANDMARK.LEFT_SHOULDER);
  const rightShoulder = getVisiblePoint(
    landmarks,
    POSE_LANDMARK.RIGHT_SHOULDER,
  );
  const leftHip = getVisiblePoint(landmarks, POSE_LANDMARK.LEFT_HIP);
  const rightHip = getVisiblePoint(landmarks, POSE_LANDMARK.RIGHT_HIP);
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const scale = median([
    distance(leftShoulder, rightShoulder),
    distance(leftHip, rightHip),
    distance(shoulderCenter, hipCenter),
  ]);

  return scale !== null &&
    scale >= MIGRATION_RECOGNITION_THRESHOLDS.minimumTorsoScale
    ? scale
    : null;
};

export const calculateStanceWidth = (
  landmarks: PoseLandmarkLike[] | null | undefined,
) => {
  const leftAnkle = getVisiblePoint(landmarks, POSE_LANDMARK.LEFT_ANKLE);
  const rightAnkle = getVisiblePoint(landmarks, POSE_LANDMARK.RIGHT_ANKLE);
  const torsoScale = calculateTorsoScale(landmarks);

  if (!leftAnkle || !rightAnkle || !torsoScale) return null;

  return Math.abs(leftAnkle.x - rightAnkle.x) / torsoScale;
};

export const calculateAnkleMovement = (
  from: PoseLandmarkLike[] | null | undefined,
  to: PoseLandmarkLike[] | null | undefined,
) => {
  const scales = [calculateTorsoScale(from), calculateTorsoScale(to)];
  const torsoScale = median(scales);

  if (!torsoScale) return null;

  const leftMovement = distance(
    getVisiblePoint(from, POSE_LANDMARK.LEFT_ANKLE),
    getVisiblePoint(to, POSE_LANDMARK.LEFT_ANKLE),
  );
  const rightMovement = distance(
    getVisiblePoint(from, POSE_LANDMARK.RIGHT_ANKLE),
    getVisiblePoint(to, POSE_LANDMARK.RIGHT_ANKLE),
  );
  const maximumMovement = Math.max(
    leftMovement ?? Number.NEGATIVE_INFINITY,
    rightMovement ?? Number.NEGATIVE_INFINITY,
  );

  return Number.isFinite(maximumMovement) ? maximumMovement / torsoScale : null;
};

export const calculateVerticalHipMovement = (
  from: PoseLandmarkLike[] | null | undefined,
  to: PoseLandmarkLike[] | null | undefined,
) => {
  const fromHip = calculateHipCenter(from);
  const toHip = calculateHipCenter(to);
  const torsoScale = median([
    calculateTorsoScale(from),
    calculateTorsoScale(to),
  ]);

  return fromHip && toHip && torsoScale
    ? Math.abs(toHip.y - fromHip.y) / torsoScale
    : null;
};

export const calculateLateralLean = (
  landmarks: PoseLandmarkLike[] | null | undefined,
) => {
  const leftShoulder = getVisiblePoint(landmarks, POSE_LANDMARK.LEFT_SHOULDER);
  const rightShoulder = getVisiblePoint(
    landmarks,
    POSE_LANDMARK.RIGHT_SHOULDER,
  );
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = calculateHipCenter(landmarks);
  const shoulderWidth = distance(leftShoulder, rightShoulder);

  return shoulderCenter &&
    hipCenter &&
    shoulderWidth &&
    shoulderWidth >= MIGRATION_RECOGNITION_THRESHOLDS.minimumTorsoScale
    ? (shoulderCenter.x - hipCenter.x) / shoulderWidth
    : null;
};

export const getMigrationMovementVisiblePoint = getVisiblePoint;

export type MigrationGesturePoseMetrics = {
  shoulderCenterY: number | null;
  hipCenterY: number | null;
  torsoLength: number | null;
  shoulderWidth: number | null;
  leftKneeAngle: number | null;
  rightKneeAngle: number | null;
  visibleKneeCount: number;
  wristSpan: number | null;
  averageWristY: number | null;
  leftWristY: number | null;
  rightWristY: number | null;
  leftElbowAngle: number | null;
  rightElbowAngle: number | null;
};

export type MigrationGesturePoseBaseline = {
  shoulderCenterY: number;
  hipCenterY: number;
  torsoLength: number;
  shoulderWidth: number;
  leftKneeAngle: number | null;
  rightKneeAngle: number | null;
  sampleCount: number;
};

export const extractMigrationGestureMetrics = (
  landmarks: PoseLandmarkLike[],
): MigrationGesturePoseMetrics => {
  const gesturePoint = (index: number) =>
    getVisiblePoint(
      landmarks,
      index,
      migrationGestureThresholds.landmarkVisibility,
    );
  const leftShoulder = gesturePoint(POSE_LANDMARK.LEFT_SHOULDER);
  const rightShoulder = gesturePoint(POSE_LANDMARK.RIGHT_SHOULDER);
  const leftHip = gesturePoint(POSE_LANDMARK.LEFT_HIP);
  const rightHip = gesturePoint(POSE_LANDMARK.RIGHT_HIP);
  const leftKnee = gesturePoint(POSE_LANDMARK.LEFT_KNEE);
  const rightKnee = gesturePoint(POSE_LANDMARK.RIGHT_KNEE);
  const leftAnkle = gesturePoint(POSE_LANDMARK.LEFT_ANKLE);
  const rightAnkle = gesturePoint(POSE_LANDMARK.RIGHT_ANKLE);
  const leftElbow = gesturePoint(POSE_LANDMARK.LEFT_ELBOW);
  const rightElbow = gesturePoint(POSE_LANDMARK.RIGHT_ELBOW);
  const leftWrist = gesturePoint(POSE_LANDMARK.LEFT_WRIST);
  const rightWrist = gesturePoint(POSE_LANDMARK.RIGHT_WRIST);
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);

  return {
    shoulderCenterY: shoulderCenter?.y ?? null,
    hipCenterY: hipCenter?.y ?? null,
    torsoLength: distance(shoulderCenter, hipCenter),
    shoulderWidth: distance(leftShoulder, rightShoulder),
    leftKneeAngle: jointAngle(leftHip, leftKnee, leftAnkle),
    rightKneeAngle: jointAngle(rightHip, rightKnee, rightAnkle),
    visibleKneeCount: Number(Boolean(leftKnee)) + Number(Boolean(rightKnee)),
    wristSpan:
      leftWrist && rightWrist ? Math.abs(leftWrist.x - rightWrist.x) : null,
    averageWristY:
      leftWrist && rightWrist ? (leftWrist.y + rightWrist.y) / 2 : null,
    leftWristY: leftWrist?.y ?? null,
    rightWristY: rightWrist?.y ?? null,
    leftElbowAngle: jointAngle(leftShoulder, leftElbow, leftWrist),
    rightElbowAngle: jointAngle(rightShoulder, rightElbow, rightWrist),
  };
};

export const collectMigrationGestureBaseline = (
  samples: Array<{ landmarks: PoseLandmarkLike[] }>,
): MigrationGesturePoseBaseline | null => {
  const metrics = samples
    .map((sample) => extractMigrationGestureMetrics(sample.landmarks))
    .filter(
      (value) =>
        value.shoulderCenterY !== null &&
        value.hipCenterY !== null &&
        value.torsoLength !== null &&
        value.torsoLength >=
          MIGRATION_RECOGNITION_THRESHOLDS.minimumTorsoScale &&
        value.shoulderWidth !== null &&
        value.visibleKneeCount >= 1,
    );
  if (metrics.length < 5) return null;

  return {
    shoulderCenterY: median(metrics.map((value) => value.shoulderCenterY))!,
    hipCenterY: median(metrics.map((value) => value.hipCenterY))!,
    torsoLength: median(metrics.map((value) => value.torsoLength))!,
    shoulderWidth: median(metrics.map((value) => value.shoulderWidth))!,
    leftKneeAngle: median(metrics.map((value) => value.leftKneeAngle)),
    rightKneeAngle: median(metrics.map((value) => value.rightKneeAngle)),
    sampleCount: metrics.length,
  };
};
