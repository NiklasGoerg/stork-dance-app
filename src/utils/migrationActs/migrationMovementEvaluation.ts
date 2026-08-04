import type {
  MigrationGestureEvaluationResult,
  MigrationGestureFeedbackCode,
} from "~/types/migrationAct";
import type { PoseLandmarkLike } from "~/types/pose";
import {
  getMigrationCheckpointWindow,
  migrationGestureThresholds,
  type MigrationCheckpointCriterion,
  type MigrationMovementCheckpointDefinition,
} from "~/utils/migrationActs/migrationMovementDefinitions";
import {
  collectMigrationGestureBaseline,
  extractMigrationGestureMetrics,
  type MigrationGesturePoseBaseline,
  type MigrationGesturePoseMetrics,
} from "~/utils/migrationActs/migrationMovementMetrics";

export type MigrationCriterionStatus = "success" | "failed" | "not_evaluable";

export type TimedMigrationPoseSample = {
  sourceTimeMs: number;
  landmarks: PoseLandmarkLike[];
};

export type MovementPoseMetrics = MigrationGesturePoseMetrics;
export type MovementPoseBaseline = MigrationGesturePoseBaseline;

export type MigrationCriterionEvaluation = {
  criterion: MigrationCheckpointCriterion;
  status: MigrationCriterionStatus;
  selectedSampleTimestampMs: number | null;
  metrics: Record<string, number | null>;
};

export type MigrationCheckpointEvaluation = {
  checkpointId: string;
  required: boolean;
  status: MigrationCriterionStatus;
  criteria: MigrationCriterionEvaluation[];
  selectedPose: MovementPoseMetrics | null;
};

export const extractMovementPoseMetrics = extractMigrationGestureMetrics;
export const collectMovementPoseBaseline = collectMigrationGestureBaseline;

const kneeDelta = (baseline: number | null, current: number | null) =>
  baseline !== null && current !== null ? baseline - current : null;

export const evaluateModerateCrouch = (
  baseline: MovementPoseBaseline,
  metrics: MovementPoseMetrics,
) => {
  if (
    metrics.shoulderCenterY === null ||
    metrics.hipCenterY === null ||
    metrics.visibleKneeCount < 1
  ) {
    return null;
  }
  const shoulderDrop =
    (metrics.shoulderCenterY - baseline.shoulderCenterY) / baseline.torsoLength;
  const hipDrop =
    (metrics.hipCenterY - baseline.hipCenterY) / baseline.torsoLength;
  const leftKneeFlexion = kneeDelta(
    baseline.leftKneeAngle,
    metrics.leftKneeAngle,
  );
  const rightKneeFlexion = kneeDelta(
    baseline.rightKneeAngle,
    metrics.rightKneeAngle,
  );
  const strongestDrop = Math.max(shoulderDrop, hipDrop);
  const strongestKnee = Math.max(
    0,
    leftKneeFlexion ?? 0,
    rightKneeFlexion ?? 0,
  );
  return {
    passed:
      strongestDrop >= migrationGestureThresholds.sufficientBodyDrop ||
      (strongestDrop >= migrationGestureThresholds.moderateBodyDrop &&
        strongestKnee >= migrationGestureThresholds.unilateralKneeFlexion),
    score: Math.max(
      strongestDrop / migrationGestureThresholds.sufficientBodyDrop,
      strongestKnee / migrationGestureThresholds.unilateralKneeFlexion,
    ),
    shoulderDrop,
    hipDrop,
    leftKneeFlexion,
    rightKneeFlexion,
  };
};

const samplesForCheckpoint = (
  samples: TimedMigrationPoseSample[],
  checkpoint: MigrationMovementCheckpointDefinition,
) => {
  const window = getMigrationCheckpointWindow(checkpoint);
  return samples.filter(
    (sample) =>
      sample.sourceTimeMs >= window.startMs &&
      sample.sourceTimeMs <= window.endMs,
  );
};

export type MigrationReferencePoses = {
  crouch?: MovementPoseMetrics;
  handsUp?: MovementPoseMetrics;
  armsOut?: MovementPoseMetrics;
};
type ScoredCandidate = {
  timestamp: number;
  pose: MovementPoseMetrics;
  score: number;
  passed: boolean;
  values: Record<string, number | null>;
};

const evaluateCriterion = (
  criterion: MigrationCheckpointCriterion,
  samples: TimedMigrationPoseSample[],
  baseline: MovementPoseBaseline | null,
  references: MigrationReferencePoses,
): MigrationCriterionEvaluation & { pose: MovementPoseMetrics | null } => {
  const candidates = samples.map((sample) => ({
    timestamp: sample.sourceTimeMs,
    pose: extractMovementPoseMetrics(sample.landmarks),
  }));
  const scored = candidates.flatMap<ScoredCandidate>((candidate) => {
    const pose = candidate.pose;
    if (criterion === "moderate_crouch" && baseline) {
      const result = evaluateModerateCrouch(baseline, pose);
      if (!result) return [];
      const { passed, score, ...values } = result;
      return [{ ...candidate, score, passed, values }];
    }
    if (criterion === "rise" && references.crouch && pose.torsoLength) {
      const torsoLength = pose.torsoLength;
      const shoulderRise =
        references.crouch.shoulderCenterY !== null &&
        pose.shoulderCenterY !== null
          ? (references.crouch.shoulderCenterY - pose.shoulderCenterY) /
            torsoLength
          : 0;
      const hipRise =
        references.crouch.hipCenterY !== null && pose.hipCenterY !== null
          ? (references.crouch.hipCenterY - pose.hipCenterY) / torsoLength
          : 0;
      const score = Math.max(shoulderRise, hipRise);
      return [
        {
          ...candidate,
          score,
          passed: score >= migrationGestureThresholds.riseDistance,
          values: { shoulderRise, hipRise },
        },
      ];
    }
    if (
      criterion === "hands_up" &&
      pose.torsoLength &&
      pose.shoulderCenterY !== null &&
      pose.leftWristY !== null &&
      pose.rightWristY !== null &&
      pose.leftElbowAngle !== null &&
      pose.rightElbowAngle !== null
    ) {
      const torsoLength = pose.torsoLength;
      const heights = [
        pose.shoulderCenterY - pose.leftWristY,
        pose.shoulderCenterY - pose.rightWristY,
      ]
        .map((value) => value / torsoLength)
        .sort((a, b) => b - a);
      return [
        {
          ...candidate,
          score: heights[0]!,
          passed:
            heights[0]! >= migrationGestureThresholds.handsUpPrimary &&
            heights[1]! >= migrationGestureThresholds.handsUpSecondary,
          values: {
            primaryHandHeight: heights[0]!,
            secondaryHandHeight: heights[1]!,
          },
        },
      ];
    }
    if (
      criterion === "arms_out" &&
      pose.shoulderWidth &&
      pose.wristSpan !== null &&
      pose.torsoLength &&
      pose.averageWristY !== null &&
      pose.shoulderCenterY !== null &&
      pose.leftElbowAngle !== null &&
      pose.rightElbowAngle !== null
    ) {
      const span = pose.wristSpan / pose.shoulderWidth;
      const heightOffset =
        Math.abs(pose.averageWristY - pose.shoulderCenterY) / pose.torsoLength;
      const elbowAngle = Math.min(pose.leftElbowAngle, pose.rightElbowAngle);
      const lowerThanHandsUp =
        !references.handsUp ||
        references.handsUp.averageWristY === null ||
        pose.averageWristY - references.handsUp.averageWristY >=
          migrationGestureThresholds.armsOutLowerThanHandsUp * pose.torsoLength;
      return [
        {
          ...candidate,
          score: span,
          passed:
            span >= migrationGestureThresholds.armsOutSpan &&
            heightOffset <= migrationGestureThresholds.armsOutHeightTolerance &&
            elbowAngle >= migrationGestureThresholds.armsOutElbowAngle &&
            lowerThanHandsUp,
          values: { span, heightOffset, elbowAngle },
        },
      ];
    }
    if (
      criterion === "arms_lowered_or_closer" &&
      references.armsOut &&
      pose.torsoLength &&
      pose.averageWristY !== null &&
      references.armsOut.averageWristY !== null &&
      pose.wristSpan !== null &&
      references.armsOut.wristSpan !== null
    ) {
      const lowered =
        (pose.averageWristY - references.armsOut.averageWristY) /
        pose.torsoLength;
      const closerRatio =
        pose.wristSpan / Math.max(references.armsOut.wristSpan, 0.001);
      const score = Math.max(
        lowered / migrationGestureThresholds.armsLoweredDistance,
        (1 - closerRatio) / (1 - migrationGestureThresholds.armsCloserRatio),
      );
      return [
        {
          ...candidate,
          score,
          passed:
            lowered >= migrationGestureThresholds.armsLoweredDistance ||
            closerRatio <= migrationGestureThresholds.armsCloserRatio,
          values: { lowered, closerRatio },
        },
      ];
    }
    return [];
  });
  const best = scored.sort((first, second) => second.score - first.score)[0];
  return {
    criterion,
    status: !best ? "not_evaluable" : best.passed ? "success" : "failed",
    selectedSampleTimestampMs: best?.timestamp ?? null,
    metrics: best?.values ?? {},
    pose: best?.pose ?? null,
  };
};

export const countEvaluableMigrationSamples = ({
  checkpoint,
  samples,
  baseline,
  references,
}: {
  checkpoint: MigrationMovementCheckpointDefinition;
  samples: TimedMigrationPoseSample[];
  baseline: MovementPoseBaseline | null;
  references: MigrationReferencePoses;
}) =>
  samplesForCheckpoint(samples, checkpoint).filter((sample) =>
    checkpoint.criteria.every(
      (criterion) =>
        evaluateCriterion(criterion, [sample], baseline, references).status !==
        "not_evaluable",
    ),
  ).length;

export const evaluateMigrationCheckpoint = ({
  checkpoint,
  samples,
  baseline,
  references,
}: {
  checkpoint: MigrationMovementCheckpointDefinition;
  samples: TimedMigrationPoseSample[];
  baseline: MovementPoseBaseline | null;
  references: MigrationReferencePoses;
}): MigrationCheckpointEvaluation => {
  const evaluations = checkpoint.criteria.map((criterion) =>
    evaluateCriterion(
      criterion,
      samplesForCheckpoint(samples, checkpoint),
      baseline,
      references,
    ),
  );
  const status = evaluations.some((item) => item.status === "not_evaluable")
    ? "not_evaluable"
    : evaluations.every((item) => item.status === "success")
      ? "success"
      : "failed";
  const selected = evaluations.findLast((item) => item.pose)?.pose ?? null;
  return {
    checkpointId: checkpoint.id,
    required: checkpoint.required,
    status,
    criteria: evaluations.map(({ pose: _pose, ...evaluation }) => evaluation),
    selectedPose: selected,
  };
};

const feedbackByCriterion: Record<
  MigrationCheckpointCriterion,
  MigrationGestureFeedbackCode
> = {
  moderate_crouch: "CROUCH_LOWER",
  rise: "RISE_UP",
  hands_up: "HANDS_UP",
  arms_out: "ARMS_OUT",
  arms_lowered_or_closer: "LOWER_ARMS",
};

export const buildMigrationGestureResult = (
  gestureId: "departure" | "arrival",
  attemptNumber: number,
  checkpoints: MigrationCheckpointEvaluation[],
): MigrationGestureEvaluationResult => {
  const required = checkpoints.filter((checkpoint) => checkpoint.required);
  const failed = required
    .flatMap((checkpoint) => checkpoint.criteria)
    .filter((criterion) => criterion.status !== "success");
  const primary =
    failed.find((criterion) => criterion.status === "not_evaluable") ??
    failed[0];
  const success = !primary;
  return {
    id: `${gestureId}-${attemptNumber}-${success ? "success" : primary.criterion}`,
    status: success ? "success" : primary.status,
    gestureId,
    attemptNumber,
    checkpointId: success
      ? null
      : (required.find((checkpoint) => checkpoint.criteria.includes(primary))
          ?.checkpointId ?? null),
    failedCriteria: failed.map((criterion) => criterion.criterion),
    primaryFeedbackCode: success
      ? "SUCCESS"
      : primary.status === "not_evaluable"
        ? "CHECKPOINT_NOT_EVALUABLE"
        : feedbackByCriterion[primary.criterion],
  };
};
