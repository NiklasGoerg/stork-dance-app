import type {
  MigrationMovementCriterionStatus,
  MigrationMovementEvaluationStatus,
  MigrationMovementRecognitionProfile,
  MigrationMovementWingState,
} from "~/types/migrationAct";
import type { PoseLandmarkLike } from "~/types/pose";
import type { PosePoint } from "~/utils/pose/poseGeometry";
import { POSE_LANDMARK } from "~/utils/pose/poseLandmarks";
import { MIGRATION_RECOGNITION_THRESHOLDS } from "~/utils/migrationActs/migrationMovementConfig";
import {
  calculateShoulderCenter,
  calculateTorsoScale,
  getMigrationMovementVisiblePoint,
} from "~/utils/migrationActs/migrationMovementMetrics";

export type MigrationMovementRecognitionSample = {
  timestampMs: number;
  barElapsedMs: number;
  hipCenter: PosePoint | null;
  torsoScale: number | null;
  stanceWidth: number | null;
  lean: number | null;
  leftAnkle: PosePoint | null;
  rightAnkle: PosePoint | null;
  wingState: MigrationMovementWingState;
};

export type MigrationMovementWindowEvaluation = {
  status: MigrationMovementEvaluationStatus;
  wingBeat: MigrationMovementCriterionStatus;
  stepActivity: MigrationMovementCriterionStatus;
  stanceWidthChange: MigrationMovementCriterionStatus;
  verticalBounce: MigrationMovementCriterionStatus;
};

const getStatus = (evaluable: boolean, passed: boolean) =>
  !evaluable ? "not_evaluable" : passed ? "success" : "failed";

const getPointRange = (
  samples: MigrationMovementRecognitionSample[],
  selectPoint: (sample: MigrationMovementRecognitionSample) => PosePoint | null,
) => {
  const points = samples
    .map(selectPoint)
    .filter((point): point is PosePoint => !!point);
  const torsoScales = samples
    .map((sample) => sample.torsoScale)
    .filter((scale): scale is number => scale !== null);

  if (points.length < 2 || !torsoScales.length) return null;

  const torsoScale =
    torsoScales.reduce((sum, value) => sum + value, 0) / torsoScales.length;
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);

  return (
    Math.hypot(
      Math.max(...xValues) - Math.min(...xValues),
      Math.max(...yValues) - Math.min(...yValues),
    ) / torsoScale
  );
};

export const evaluateStepActivity = (
  samples: MigrationMovementRecognitionSample[],
): MigrationMovementCriterionStatus => {
  const windows = [
    samples.filter(
      (sample) =>
        sample.barElapsedMs < MIGRATION_RECOGNITION_THRESHOLDS.twoBeatWindowMs,
    ),
    samples.filter(
      (sample) =>
        sample.barElapsedMs >= MIGRATION_RECOGNITION_THRESHOLDS.twoBeatWindowMs,
    ),
  ];
  const movements = windows.map((windowSamples) => {
    const left = getPointRange(windowSamples, (sample) => sample.leftAnkle);
    const right = getPointRange(windowSamples, (sample) => sample.rightAnkle);
    const maximum = Math.max(
      left ?? Number.NEGATIVE_INFINITY,
      right ?? Number.NEGATIVE_INFINITY,
    );

    return Number.isFinite(maximum) ? maximum : null;
  });

  return getStatus(
    movements.every((movement) => movement !== null),
    movements.every(
      (movement) =>
        movement !== null &&
        movement >= MIGRATION_RECOGNITION_THRESHOLDS.ankleMovement,
    ),
  );
};

export const evaluateStanceWidthChange = (
  samples: MigrationMovementRecognitionSample[],
): MigrationMovementCriterionStatus => {
  const widths = samples
    .map((sample) => sample.stanceWidth)
    .filter((width): width is number => width !== null);

  if (widths.length < 2) return "not_evaluable";

  const hasWiderThenNarrower = widths.some((width, index) =>
    widths
      .slice(index + 1)
      .some(
        (laterWidth) =>
          width - laterWidth >=
          MIGRATION_RECOGNITION_THRESHOLDS.stanceWidthChange,
      ),
  );

  return hasWiderThenNarrower ? "success" : "failed";
};

export const evaluateVerticalBounce = (
  samples: MigrationMovementRecognitionSample[],
): MigrationMovementCriterionStatus => {
  const hips = samples.filter(
    (sample) => sample.hipCenter && sample.torsoScale !== null,
  );

  if (hips.length < 2) return "not_evaluable";

  const hasDownThenUp = hips.some((sample, index) =>
    hips.slice(index + 1).some((laterSample) => {
      const scale = (sample.torsoScale! + laterSample.torsoScale!) / 2;

      return (
        sample.hipCenter!.y - laterSample.hipCenter!.y >=
        MIGRATION_RECOGNITION_THRESHOLDS.verticalBounce * scale
      );
    }),
  );

  return hasDownThenUp ? "success" : "failed";
};

export const calculateWingState = (
  landmarks: PoseLandmarkLike[] | null | undefined,
): MigrationMovementWingState => {
  const leftShoulder = getMigrationMovementVisiblePoint(
    landmarks,
    POSE_LANDMARK.LEFT_SHOULDER,
  );
  const rightShoulder = getMigrationMovementVisiblePoint(
    landmarks,
    POSE_LANDMARK.RIGHT_SHOULDER,
  );
  const leftElbow = getMigrationMovementVisiblePoint(
    landmarks,
    POSE_LANDMARK.LEFT_ELBOW,
  );
  const rightElbow = getMigrationMovementVisiblePoint(
    landmarks,
    POSE_LANDMARK.RIGHT_ELBOW,
  );
  const torsoScale = calculateTorsoScale(landmarks);

  if (
    !leftShoulder ||
    !rightShoulder ||
    !leftElbow ||
    !rightElbow ||
    !calculateShoulderCenter(landmarks) ||
    !torsoScale
  ) {
    return "not_evaluable";
  }

  const leftOffset = (leftElbow.y - leftShoulder.y) / torsoScale;
  const rightOffset = (rightElbow.y - rightShoulder.y) / torsoScale;

  if (
    leftOffset <= MIGRATION_RECOGNITION_THRESHOLDS.wingsUpTolerance &&
    rightOffset <= MIGRATION_RECOGNITION_THRESHOLDS.wingsUpTolerance
  ) {
    return "up";
  }

  if (
    leftOffset >= MIGRATION_RECOGNITION_THRESHOLDS.wingsDownTolerance &&
    rightOffset >= MIGRATION_RECOGNITION_THRESHOLDS.wingsDownTolerance
  ) {
    return "down";
  }

  return "neutral";
};

export const evaluateWingBeat = (
  samples: MigrationMovementRecognitionSample[],
): MigrationMovementCriterionStatus => {
  const wingStates = samples
    .map((sample) => sample.wingState)
    .filter((state) => state !== "not_evaluable");

  if (!wingStates.length) return "not_evaluable";

  const firstUpIndex = wingStates.indexOf("up");
  const hasDownAfterUp =
    firstUpIndex >= 0 && wingStates.slice(firstUpIndex + 1).includes("down");

  return hasDownAfterUp ? "success" : "failed";
};

export const evaluateMigrationMovementWindow = (
  profile: MigrationMovementRecognitionProfile,
  samples: MigrationMovementRecognitionSample[],
): MigrationMovementWindowEvaluation => {
  const stepActivity = evaluateStepActivity(samples);
  const stanceWidthChange = evaluateStanceWidthChange(samples);
  const verticalBounce = evaluateVerticalBounce(samples);
  const wingBeat = evaluateWingBeat(samples);
  const required =
    profile === "summer_rest"
      ? [stepActivity, stanceWidthChange]
      : profile === "winter_rest"
        ? [stepActivity]
        : [wingBeat, stepActivity];
  const status = required.includes("not_evaluable")
    ? "not_evaluable"
    : required.every((criterion) => criterion === "success")
      ? "success"
      : "failed";

  return {
    status,
    wingBeat,
    stepActivity,
    stanceWidthChange,
    verticalBounce,
  };
};
