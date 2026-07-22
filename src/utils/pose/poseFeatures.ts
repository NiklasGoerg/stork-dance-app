import type {
  PoseCalibrationState,
  PoseFeatures,
  PoseLandmarkLike,
} from "~/types/pose";
import {
  averageValid,
  calculateJointAngle,
  distance2D,
  horizontalDistance,
  midpoint,
  toPosePoint,
  verticalDistance,
} from "~/utils/pose/poseGeometry";
import { MIN_SHOULDER_WIDTH, POSE_LANDMARK } from "~/utils/pose/poseLandmarks";

export type PoseFeatureExtractionOptions = {
  shoulderHeightToleranceRatio?: number;
  wristAboveHeadMarginRatio?: number;
};

const defaultOptions: Required<PoseFeatureExtractionOptions> = {
  shoulderHeightToleranceRatio: 0.15,
  wristAboveHeadMarginRatio: 0.1,
};

export const createEmptyPoseFeatures = (): PoseFeatures => ({
  bodySpanRatio: null,
  hipHeightRatio: null,
  averageKneeAngle: null,
  averageElbowAngle: null,
  wristSpanInShoulderWidths: null,
  wristsAtOrAboveShoulders: null,
  wristsAboveHead: null,
});

const getLandmark = (landmarks: PoseLandmarkLike[], index: number) =>
  landmarks[index] ?? null;

const getHeadPoint = (landmarks: PoseLandmarkLike[]) => {
  const nose = toPosePoint(getLandmark(landmarks, POSE_LANDMARK.NOSE));

  if (nose) return nose;

  return midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_EAR),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_EAR),
  );
};

const getFootPoint = (landmarks: PoseLandmarkLike[]) => {
  const leftAnkle = getLandmark(landmarks, POSE_LANDMARK.LEFT_ANKLE);
  const rightAnkle = getLandmark(landmarks, POSE_LANDMARK.RIGHT_ANKLE);
  const ankleMidpoint = midpoint(leftAnkle, rightAnkle);

  if (ankleMidpoint) return ankleMidpoint;

  return (
    toPosePoint(leftAnkle) ??
    toPosePoint(rightAnkle) ??
    midpoint(
      getLandmark(landmarks, POSE_LANDMARK.LEFT_HEEL),
      getLandmark(landmarks, POSE_LANDMARK.RIGHT_HEEL),
    ) ??
    midpoint(
      getLandmark(landmarks, POSE_LANDMARK.LEFT_FOOT_INDEX),
      getLandmark(landmarks, POSE_LANDMARK.RIGHT_FOOT_INDEX),
    )
  );
};

const getShoulderWidth = (landmarks: PoseLandmarkLike[]) => {
  const shoulderWidth = distance2D(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_SHOULDER),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_SHOULDER),
  );

  if (!shoulderWidth || shoulderWidth < MIN_SHOULDER_WIDTH) return null;

  return shoulderWidth;
};

// Measures the vertical body span used as the neutral calibration baseline.
export const extractBodyCalibrationMeasurements = (
  landmarks: PoseLandmarkLike[],
) => {
  const headPoint = getHeadPoint(landmarks);
  const footPoint = getFootPoint(landmarks);
  const hipCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_HIP),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_HIP),
  );
  const bodySpan = verticalDistance(headPoint, footPoint);
  const hipHeight = verticalDistance(hipCenter, footPoint);

  return {
    bodySpan,
    hipHeight,
  };
};

// Derives normalized pose features from the current 2D landmark frame.
export const extractPoseFeatures = (
  landmarks: PoseLandmarkLike[] | null | undefined,
  calibration: PoseCalibrationState,
  customOptions: PoseFeatureExtractionOptions = {},
): PoseFeatures => {
  if (!landmarks?.length) return createEmptyPoseFeatures();

  const options = {
    ...defaultOptions,
    ...customOptions,
  };
  const features = createEmptyPoseFeatures();
  const shoulderWidth = getShoulderWidth(landmarks);
  const headPoint = getHeadPoint(landmarks);
  const footPoint = getFootPoint(landmarks);
  const hipCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_HIP),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_HIP),
  );
  const currentBodySpan = verticalDistance(headPoint, footPoint);
  const currentHipHeight = verticalDistance(hipCenter, footPoint);

  if (currentBodySpan && calibration.neutralBodySpan) {
    features.bodySpanRatio = currentBodySpan / calibration.neutralBodySpan;
  }

  if (currentHipHeight && calibration.neutralHipHeight) {
    features.hipHeightRatio = currentHipHeight / calibration.neutralHipHeight;
  }

  features.averageKneeAngle = averageValid([
    calculateJointAngle(
      getLandmark(landmarks, POSE_LANDMARK.LEFT_HIP),
      getLandmark(landmarks, POSE_LANDMARK.LEFT_KNEE),
      getLandmark(landmarks, POSE_LANDMARK.LEFT_ANKLE),
    ),
    calculateJointAngle(
      getLandmark(landmarks, POSE_LANDMARK.RIGHT_HIP),
      getLandmark(landmarks, POSE_LANDMARK.RIGHT_KNEE),
      getLandmark(landmarks, POSE_LANDMARK.RIGHT_ANKLE),
    ),
  ]);

  features.averageElbowAngle = averageValid([
    calculateJointAngle(
      getLandmark(landmarks, POSE_LANDMARK.LEFT_SHOULDER),
      getLandmark(landmarks, POSE_LANDMARK.LEFT_ELBOW),
      getLandmark(landmarks, POSE_LANDMARK.LEFT_WRIST),
    ),
    calculateJointAngle(
      getLandmark(landmarks, POSE_LANDMARK.RIGHT_SHOULDER),
      getLandmark(landmarks, POSE_LANDMARK.RIGHT_ELBOW),
      getLandmark(landmarks, POSE_LANDMARK.RIGHT_WRIST),
    ),
  ]);

  if (shoulderWidth) {
    const wristSpan = horizontalDistance(
      getLandmark(landmarks, POSE_LANDMARK.LEFT_WRIST),
      getLandmark(landmarks, POSE_LANDMARK.RIGHT_WRIST),
    );

    if (wristSpan !== null) {
      features.wristSpanInShoulderWidths = wristSpan / shoulderWidth;
    }

    const wristShoulderPairs = [
      [
        getLandmark(landmarks, POSE_LANDMARK.LEFT_WRIST),
        getLandmark(landmarks, POSE_LANDMARK.LEFT_SHOULDER),
      ],
      [
        getLandmark(landmarks, POSE_LANDMARK.RIGHT_WRIST),
        getLandmark(landmarks, POSE_LANDMARK.RIGHT_SHOULDER),
      ],
    ] as const;
    const shoulderTolerance =
      shoulderWidth * options.shoulderHeightToleranceRatio;
    const evaluableShoulderPairs = wristShoulderPairs
      .map(([wrist, shoulder]) => ({
        wrist: toPosePoint(wrist),
        shoulder: toPosePoint(shoulder),
      }))
      .filter((pair) => pair.wrist && pair.shoulder);

    if (evaluableShoulderPairs.length) {
      // MediaPipe image coordinates use smaller y-values for points higher in the image.
      features.wristsAtOrAboveShoulders = evaluableShoulderPairs.filter(
        ({ wrist, shoulder }) =>
          wrist !== null &&
          shoulder !== null &&
          wrist.y <= shoulder.y + shoulderTolerance,
      ).length;
    }

    if (headPoint) {
      const headMargin = shoulderWidth * options.wristAboveHeadMarginRatio;
      const wrists = [
        toPosePoint(getLandmark(landmarks, POSE_LANDMARK.LEFT_WRIST)),
        toPosePoint(getLandmark(landmarks, POSE_LANDMARK.RIGHT_WRIST)),
      ].filter((wrist): wrist is NonNullable<typeof wrist> => !!wrist);

      if (wrists.length) {
        features.wristsAboveHead = wrists.filter(
          (wrist) => wrist.y < headPoint.y - headMargin,
        ).length;
      }
    }
  }

  return features;
};

// Guards calibration so crouches or transitional movement do not become the neutral baseline.
export const isLikelyNeutralStandingPose = (landmarks: PoseLandmarkLike[]) => {
  const averageKneeAngle = averageValid([
    calculateJointAngle(
      getLandmark(landmarks, POSE_LANDMARK.LEFT_HIP),
      getLandmark(landmarks, POSE_LANDMARK.LEFT_KNEE),
      getLandmark(landmarks, POSE_LANDMARK.LEFT_ANKLE),
    ),
    calculateJointAngle(
      getLandmark(landmarks, POSE_LANDMARK.RIGHT_HIP),
      getLandmark(landmarks, POSE_LANDMARK.RIGHT_KNEE),
      getLandmark(landmarks, POSE_LANDMARK.RIGHT_ANKLE),
    ),
  ]);
  const measurements = extractBodyCalibrationMeasurements(landmarks);

  return (
    averageKneeAngle !== null &&
    averageKneeAngle >= 150 &&
    measurements.bodySpan !== null &&
    measurements.hipHeight !== null
  );
};
