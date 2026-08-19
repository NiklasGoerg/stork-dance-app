import type { PoseLandmarkLike } from "~/types/pose";
import { MIN_LANDMARK_VISIBILITY } from "~/utils/pose/poseLandmarks";

export type PosePoint = {
  x: number;
  y: number;
  z?: number;
};

export const isValidPosePoint = (
  point?: PoseLandmarkLike | null,
): point is PoseLandmarkLike =>
  !!point &&
  Number.isFinite(point.x) &&
  Number.isFinite(point.y) &&
  (point.z === undefined || Number.isFinite(point.z)) &&
  (point.visibility === undefined ||
    point.visibility >= MIN_LANDMARK_VISIBILITY) &&
  (point.presence === undefined || point.presence >= MIN_LANDMARK_VISIBILITY);

export const toPosePoint = (
  point?: PoseLandmarkLike | null,
): PosePoint | null => {
  if (!isValidPosePoint(point)) return null;

  return {
    x: point.x,
    y: point.y,
    z: point.z ?? 0,
  };
};

export const midpoint = (
  a?: PoseLandmarkLike | null,
  b?: PoseLandmarkLike | null,
): PosePoint | null => {
  const pointA = toPosePoint(a);
  const pointB = toPosePoint(b);

  if (!pointA || !pointB) return null;

  return {
    x: (pointA.x + pointB.x) / 2,
    y: (pointA.y + pointB.y) / 2,
    z: ((pointA.z ?? 0) + (pointB.z ?? 0)) / 2,
  };
};

export const distance2D = (
  a?: PoseLandmarkLike | null,
  b?: PoseLandmarkLike | null,
) => {
  const pointA = toPosePoint(a);
  const pointB = toPosePoint(b);

  if (!pointA || !pointB) return null;

  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
};

export const horizontalDistance = (
  a?: PoseLandmarkLike | null,
  b?: PoseLandmarkLike | null,
) => {
  const pointA = toPosePoint(a);
  const pointB = toPosePoint(b);

  if (!pointA || !pointB) return null;

  return Math.abs(pointA.x - pointB.x);
};

export const verticalDistance = (
  a?: PoseLandmarkLike | null,
  b?: PoseLandmarkLike | null,
) => {
  const pointA = toPosePoint(a);
  const pointB = toPosePoint(b);

  if (!pointA || !pointB) return null;

  return Math.abs(pointA.y - pointB.y);
};

export const calculateJointAngle = (
  a?: PoseLandmarkLike | null,
  joint?: PoseLandmarkLike | null,
  c?: PoseLandmarkLike | null,
) => {
  const pointA = toPosePoint(a);
  const pointJoint = toPosePoint(joint);
  const pointC = toPosePoint(c);

  if (!pointA || !pointJoint || !pointC) return null;

  const vectorA = {
    x: pointA.x - pointJoint.x,
    y: pointA.y - pointJoint.y,
    z: (pointA.z ?? 0) - (pointJoint.z ?? 0),
  };
  const vectorC = {
    x: pointC.x - pointJoint.x,
    y: pointC.y - pointJoint.y,
    z: (pointC.z ?? 0) - (pointJoint.z ?? 0),
  };
  const magnitudeA = Math.hypot(vectorA.x, vectorA.y, vectorA.z);
  const magnitudeC = Math.hypot(vectorC.x, vectorC.y, vectorC.z);

  if (magnitudeA <= 0 || magnitudeC <= 0) return null;

  const dot =
    vectorA.x * vectorC.x + vectorA.y * vectorC.y + vectorA.z * vectorC.z;
  const cosine = Math.min(Math.max(dot / (magnitudeA * magnitudeC), -1), 1);

  return (Math.acos(cosine) * 180) / Math.PI;
};

export const averageValid = (values: Array<number | null | undefined>) => {
  const validValues = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );

  if (!validValues.length) return null;

  return (
    validValues.reduce((sum, value) => sum + value, 0) / validValues.length
  );
};
