import type { PoseLandmarkLike } from "~/types/pose";
import {
  getBeatPassState,
  getWeightedBeatEvaluationScore,
} from "~/utils/movement/core/criteria";
import {
  springCriterionFeedbackMetadata,
  springFeedbackMetadata,
} from "~/utils/act5/feedback/catalog";
import { buildAct5BeatFeedbackSignals } from "~/utils/act5/feedback/signals";
import { selectAct5FinalFeedback } from "~/utils/act5/feedback/selectFinalFeedback";
import { extractNormalizedBodyMetrics } from "~/utils/movement/core/bodyMetrics";
import { evaluateHandsGatheredAtCenter } from "~/utils/movement/core/predicates/handPoses";
import {
  buildSpringBeatCriteria,
  getSpringBeatFeedbackCode,
  getSpringCriteriaScore,
} from "~/utils/movement/acts/climate/spring/springCriteria";
import {
  SPRING_BEAT_WEIGHTS,
  SPRING_MOVEMENT_REFERENCE,
  springMovementConfig,
} from "~/utils/movement/acts/climate/spring/springReference";
import type {
  SpringBeat,
  SpringBeatEvaluation,
  SpringFeedbackCode,
  SpringHandHeightRegion,
  SpringKneeSide,
  SpringPreparationReference,
  SpringRecognitionMetrics,
  SpringRecognitionResultState,
  SpringSequenceEvaluation,
  SpringValue,
} from "~/utils/movement/acts/climate/spring/springTypes";
import { averageValid, toPosePoint } from "~/utils/pose/poseGeometry";
import { POSE_LANDMARK } from "~/utils/pose/poseLandmarks";

export * from "~/utils/movement/acts/climate/spring/springReference";
export * from "~/utils/movement/acts/climate/spring/springTypes";

type BeatContext = {
  expectedValue?: SpringValue;
  expectedKneeSide?: SpringKneeSide;
  measureIndex?: number | null;
  preparationReference?: SpringPreparationReference | null;
};

const getLandmarkPoint = (landmarks: PoseLandmarkLike[], index: number) =>
  toPosePoint(landmarks[index]);

const classifyHandHeightRegion = (
  lowerHandHeight: number | null,
): SpringHandHeightRegion => {
  if (lowerHandHeight === null || !Number.isFinite(lowerHandHeight)) {
    return "unknown";
  }

  if (lowerHandHeight < 0.22) return "low";
  if (lowerHandHeight < 0.45) return "waist";
  if (lowerHandHeight < 0.78) return "chest";
  if (lowerHandHeight < 1.12) return "shoulder";

  return "overhead";
};

const getExpectedKneeSideForMeasure = (measureIndex: number): SpringKneeSide =>
  measureIndex % 2 === 0 ? "left" : "right";

const detectKneeSide = ({
  leftKneeLift,
  rightKneeLift,
}: {
  leftKneeLift: number | null;
  rightKneeLift: number | null;
}): SpringKneeSide => {
  if (leftKneeLift === null || rightKneeLift === null) return "unknown";

  const minSignal = springMovementConfig.thresholds.kneeLiftMin;
  const dominance = 0.035;

  if (leftKneeLift < minSignal && rightKneeLift < minSignal) return "none";
  if (leftKneeLift - rightKneeLift >= dominance) return "left";
  if (rightKneeLift - leftKneeLift >= dominance) return "right";

  return "unknown";
};

const getOpeningImpulse = ({
  leftHandLateralOffset,
  rightHandLateralOffset,
  preparationReference,
}: {
  leftHandLateralOffset: number | null;
  rightHandLateralOffset: number | null;
  preparationReference?: SpringPreparationReference | null;
}) => {
  if (
    leftHandLateralOffset === null ||
    rightHandLateralOffset === null ||
    preparationReference?.leftHandLateralOffset === null ||
    preparationReference?.rightHandLateralOffset === null ||
    preparationReference?.leftHandLateralOffset === undefined ||
    preparationReference?.rightHandLateralOffset === undefined
  ) {
    return {
      openingImpulse: null,
      leftOutwardImpulse: null,
      rightOutwardImpulse: null,
    };
  }

  const leftOutwardImpulse =
    preparationReference.leftHandLateralOffset - leftHandLateralOffset;
  const rightOutwardImpulse =
    rightHandLateralOffset - preparationReference.rightHandLateralOffset;
  const openingImpulse = averageValid([
    Math.max(0, leftOutwardImpulse),
    Math.max(0, rightOutwardImpulse),
  ]);

  return {
    openingImpulse,
    leftOutwardImpulse,
    rightOutwardImpulse,
  };
};

const createEmptyMetrics = (
  expectedValue: SpringValue = "100",
  expectedKneeSide: SpringKneeSide = "unknown",
): SpringRecognitionMetrics => ({
  shoulderWidth: null,
  torsoLength: null,
  normalizedHandDistance: null,
  normalizedAnkleDistance: null,
  leftHandHeight: null,
  rightHandHeight: null,
  averageHandHeight: null,
  lowerHandHeight: null,
  handHeightDifference: null,
  detectedHandHeightRegion: "unknown",
  expectedHandHeightMin:
    SPRING_MOVEMENT_REFERENCE[expectedValue].handHeightRange.min,
  expectedHandHeightMax: Number.isFinite(
    SPRING_MOVEMENT_REFERENCE[expectedValue].handHeightRange.max,
  )
    ? SPRING_MOVEMENT_REFERENCE[expectedValue].handHeightRange.max
    : null,
  leftHandLateralOffset: null,
  rightHandLateralOffset: null,
  handCenterXOffset: null,
  handCenterHeight: null,
  handOpeningWidth: null,
  leftWristOutsideShoulder: null,
  rightWristOutsideShoulder: null,
  handsGathered: null,
  handsOpen: null,
  handsLow: null,
  handsReturnedToPrayer: null,
  overheadBloom: null,
  leftElbowAngle: null,
  rightElbowAngle: null,
  averageElbowAngle: null,
  openingImpulse: null,
  leftOutwardImpulse: null,
  rightOutwardImpulse: null,
  expectedKneeSide,
  detectedKneeSide: "unknown",
  kneeLiftSignal: null,
  landmarkConfidence: "missing-body-reference",
});

export const extractSpringRecognitionMetrics = (
  landmarks: PoseLandmarkLike[] | null | undefined,
  context: BeatContext = {},
): SpringRecognitionMetrics => {
  const expectedValue = context.expectedValue ?? "100";
  const expectedKneeSide = context.expectedKneeSide ?? "unknown";

  if (!landmarks?.length)
    return createEmptyMetrics(expectedValue, expectedKneeSide);

  const bodyMetrics = extractNormalizedBodyMetrics(landmarks);
  const { shoulderWidth, shoulderCenter, hipCenter, leftWrist, rightWrist } =
    bodyMetrics;
  const leftShoulder = getLandmarkPoint(landmarks, POSE_LANDMARK.LEFT_SHOULDER);
  const rightShoulder = getLandmarkPoint(
    landmarks,
    POSE_LANDMARK.RIGHT_SHOULDER,
  );
  const torsoLength = bodyMetrics.torsoLength ?? shoulderWidth;

  if (!shoulderWidth || !shoulderCenter || !hipCenter || !torsoLength) {
    return createEmptyMetrics(expectedValue, expectedKneeSide);
  }

  const leftHandHeight = leftWrist
    ? (hipCenter.y - leftWrist.y) / torsoLength
    : null;
  const rightHandHeight = rightWrist
    ? (hipCenter.y - rightWrist.y) / torsoLength
    : null;
  const averageHandHeight = averageValid([leftHandHeight, rightHandHeight]);
  const validHandHeights = [leftHandHeight, rightHandHeight].filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  const lowerHandHeight = validHandHeights.length
    ? Math.min(...validHandHeights)
    : null;
  const handHeightDifference =
    leftHandHeight !== null && rightHandHeight !== null
      ? Math.abs(leftHandHeight - rightHandHeight)
      : null;
  const leftHandLateralOffset = leftWrist
    ? (leftWrist.x - shoulderCenter.x) / shoulderWidth
    : null;
  const rightHandLateralOffset = rightWrist
    ? (rightWrist.x - shoulderCenter.x) / shoulderWidth
    : null;
  const handCenterXOffset = bodyMetrics.handCenterXOffset;
  const handCenterHeight = bodyMetrics.handCenter
    ? (hipCenter.y - bodyMetrics.handCenter.y) / torsoLength
    : null;
  const handOpeningWidth = bodyMetrics.normalizedWristSpan;
  const leftWristOutsideShoulder =
    leftWrist && leftShoulder
      ? Math.abs(leftWrist.x - leftShoulder.x) / shoulderWidth
      : null;
  const rightWristOutsideShoulder =
    rightWrist && rightShoulder
      ? Math.abs(rightWrist.x - rightShoulder.x) / shoulderWidth
      : null;
  const normalizedHandDistance = bodyMetrics.normalizedHandDistance;
  const gatheredAtCenter = evaluateHandsGatheredAtCenter(bodyMetrics, {
    maxNormalizedHandDistance: springMovementConfig.thresholds.handsGatheredMax,
    maxAbsoluteCenterOffset: springMovementConfig.thresholds.centerMaxOffset,
  });
  const handsGathered = gatheredAtCenter.evaluable
    ? gatheredAtCenter.passed
    : null;
  const handsOpen =
    handOpeningWidth === null
      ? null
      : handOpeningWidth >= springMovementConfig.thresholds.handsOpenMin;
  const handsLow =
    lowerHandHeight === null
      ? null
      : lowerHandHeight <= springMovementConfig.thresholds.handsLowMax;
  const handsReturnedToPrayer =
    lowerHandHeight === null || handsGathered === null
      ? null
      : lowerHandHeight >= springMovementConfig.thresholds.returnHeightMin &&
        lowerHandHeight <= springMovementConfig.thresholds.returnHeightMax &&
        handsGathered;
  const overheadBloom =
    lowerHandHeight === null ||
    normalizedHandDistance === null ||
    handCenterXOffset === null
      ? null
      : lowerHandHeight >=
          springMovementConfig.thresholds.overheadHandHeightMin &&
        normalizedHandDistance <=
          springMovementConfig.thresholds.overheadHandsGatheredMax &&
        Math.abs(handCenterXOffset) <=
          springMovementConfig.thresholds.overheadCenterMaxOffset;
  const leftElbowAngle = bodyMetrics.leftElbowAngle;
  const rightElbowAngle = bodyMetrics.rightElbowAngle;
  const averageElbowAngle = bodyMetrics.averageElbowAngle;
  const leftKnee = getLandmarkPoint(landmarks, POSE_LANDMARK.LEFT_KNEE);
  const rightKnee = getLandmarkPoint(landmarks, POSE_LANDMARK.RIGHT_KNEE);
  const leftKneeLift = leftKnee
    ? Math.max(0, (hipCenter.y - leftKnee.y) / torsoLength)
    : null;
  const rightKneeLift = rightKnee
    ? Math.max(0, (hipCenter.y - rightKnee.y) / torsoLength)
    : null;
  const detectedKneeSide = detectKneeSide({ leftKneeLift, rightKneeLift });
  const kneeLiftSignal =
    leftKneeLift === null || rightKneeLift === null
      ? null
      : Math.max(leftKneeLift, rightKneeLift);
  const impulses = getOpeningImpulse({
    leftHandLateralOffset,
    rightHandLateralOffset,
    preparationReference: context.preparationReference,
  });

  return {
    shoulderWidth,
    torsoLength,
    normalizedHandDistance,
    normalizedAnkleDistance: bodyMetrics.normalizedAnkleDistance,
    leftHandHeight,
    rightHandHeight,
    averageHandHeight,
    lowerHandHeight,
    handHeightDifference,
    detectedHandHeightRegion: classifyHandHeightRegion(lowerHandHeight),
    expectedHandHeightMin:
      SPRING_MOVEMENT_REFERENCE[expectedValue].handHeightRange.min,
    expectedHandHeightMax: Number.isFinite(
      SPRING_MOVEMENT_REFERENCE[expectedValue].handHeightRange.max,
    )
      ? SPRING_MOVEMENT_REFERENCE[expectedValue].handHeightRange.max
      : null,
    leftHandLateralOffset,
    rightHandLateralOffset,
    handCenterXOffset,
    handCenterHeight,
    handOpeningWidth,
    leftWristOutsideShoulder,
    rightWristOutsideShoulder,
    handsGathered,
    handsOpen,
    handsLow,
    handsReturnedToPrayer,
    overheadBloom,
    leftElbowAngle,
    rightElbowAngle,
    averageElbowAngle,
    ...impulses,
    expectedKneeSide,
    detectedKneeSide,
    kneeLiftSignal,
    landmarkConfidence: "ok",
  };
};

export const evaluateSpringBeat = (
  landmarks: PoseLandmarkLike[] | null | undefined,
  beat: SpringBeat,
  timestamp: number,
  context: BeatContext = {},
): SpringBeatEvaluation => {
  const expectedValue = context.expectedValue ?? "100";
  const expectedKneeSide = context.expectedKneeSide ?? "unknown";
  const metrics = extractSpringRecognitionMetrics(landmarks, {
    ...context,
    expectedValue,
    expectedKneeSide,
  });

  if (!landmarks?.length || metrics.shoulderWidth === null) {
    return {
      beat,
      measureIndex: context.measureIndex,
      score: 0,
      passed: false,
      trackingUnavailable: true,
      criteria: [],
      timestamp,
      expectedValue,
      expectedKneeSide,
      feedbackCode: "FULL_BODY_NOT_VISIBLE",
      feedbackSignals: buildAct5BeatFeedbackSignals<SpringFeedbackCode>({
        season: "spring",
        beat,
        measureIndex: context.measureIndex ?? null,
        criteria: [],
        trackingUnavailable: true,
        fallbackCode: "FULL_BODY_NOT_VISIBLE",
        codeMetadata: springFeedbackMetadata,
        criterionMetadata: springCriterionFeedbackMetadata,
        missedBeatSample: !landmarks?.length,
        landmarkConfidence: metrics.landmarkConfidence,
      }),
      metrics,
    };
  }

  const criteria = buildSpringBeatCriteria(beat, metrics, expectedValue);
  const score = getSpringCriteriaScore(criteria);
  const { passed, trackingUnavailable } = getBeatPassState({
    criteria,
    score,
    passScore: springMovementConfig.thresholds.beatPassScore,
  });

  return {
    beat,
    measureIndex: context.measureIndex,
    score,
    passed,
    trackingUnavailable,
    criteria,
    timestamp,
    expectedValue,
    expectedKneeSide,
    feedbackCode: passed ? undefined : getSpringBeatFeedbackCode(criteria),
    feedbackSignals: buildAct5BeatFeedbackSignals<SpringFeedbackCode>({
      season: "spring",
      beat,
      measureIndex: context.measureIndex ?? null,
      criteria,
      trackingUnavailable,
      fallbackCode: getSpringBeatFeedbackCode(criteria),
      codeMetadata: springFeedbackMetadata,
      criterionMetadata: springCriterionFeedbackMetadata,
      landmarkConfidence: metrics.landmarkConfidence,
    }),
    metrics,
  };
};

const hasFailedCriterion = (
  evaluation: SpringBeatEvaluation,
  criterionIds: string[],
) =>
  evaluation.criteria.some(
    (criterion) =>
      criterionIds.includes(criterion.id) && criterion.status === "failed",
  );

const findSpringProblemByBeatAndCriteria = (
  beatEvaluations: SpringBeatEvaluation[],
  beat: SpringBeat,
  criterionIds: string[],
) =>
  beatEvaluations.find(
    (evaluation) =>
      evaluation.beat === beat &&
      !evaluation.passed &&
      evaluation.feedbackCode &&
      hasFailedCriterion(evaluation, criterionIds),
  );

export const getPrioritizedSpringProblemEvaluation = (
  beatEvaluations: SpringBeatEvaluation[],
) => {
  const trackingProblem = beatEvaluations.find(
    (evaluation) => evaluation.trackingUnavailable,
  );

  if (trackingProblem) return trackingProblem;

  return (
    findSpringProblemByBeatAndCriteria(beatEvaluations, 1, [
      "hands-start-low",
      "hands-close-to-body",
    ]) ??
    findSpringProblemByBeatAndCriteria(beatEvaluations, 2, [
      "beat2-shoulder-chest-height",
      "value-hand-height",
      "endpoint-arm-opening",
      "hands-open-side",
      "wrists-outside-shoulders",
    ]) ??
    findSpringProblemByBeatAndCriteria(beatEvaluations, 3, [
      "hands-overhead",
      "hands-gathered-front",
      "value-hand-height",
      "endpoint-arm-opening",
    ]) ??
    findSpringProblemByBeatAndCriteria(beatEvaluations, 4, [
      "hands-return-prayer",
    ]) ??
    findSpringProblemByBeatAndCriteria(beatEvaluations, 1, ["knee-pattern"]) ??
    findSpringProblemByBeatAndCriteria(beatEvaluations, 2, ["knee-pattern"]) ??
    findSpringProblemByBeatAndCriteria(beatEvaluations, 3, ["knee-pattern"]) ??
    beatEvaluations.find(
      (evaluation) => !evaluation.passed && evaluation.feedbackCode,
    )
  );
};

export const evaluateSpringSequence = (
  beatEvaluations: SpringBeatEvaluation[],
): SpringSequenceEvaluation => {
  const totalScore = getWeightedBeatEvaluationScore(
    beatEvaluations,
    SPRING_BEAT_WEIGHTS,
  );
  const hasCentralFailure = beatEvaluations.some(
    (evaluation) => !evaluation.passed,
  );
  const selectedFeedback = selectAct5FinalFeedback<SpringFeedbackCode>({
    season: "spring",
    beatEvaluations,
    codeMetadata: springFeedbackMetadata,
    criterionMetadata: springCriterionFeedbackMetadata,
    fallbackCode: "TRY_AGAIN",
  });
  const hasSevereTracking =
    selectedFeedback.category === "tracking" &&
    selectedFeedback.evidence.severeTracking;
  const passed =
    !hasSevereTracking &&
    !hasCentralFailure &&
    totalScore >= springMovementConfig.thresholds.almostCorrectScore;
  const resultState: SpringRecognitionResultState = hasSevereTracking
    ? "trackingUnavailable"
    : totalScore >= springMovementConfig.thresholds.successScore &&
        !hasCentralFailure
      ? "success"
      : passed
        ? "almostCorrect"
        : "retryRequired";

  return {
    passed,
    resultState,
    totalScore,
    beatEvaluations,
    feedbackCode: resultState === "success" ? "SUCCESS" : selectedFeedback.code,
    primaryFeedbackCode:
      resultState === "success" ? "SUCCESS" : selectedFeedback.code,
    selectedFeedback,
  };
};

export const getSpringExpectedKneeSideForMeasure =
  getExpectedKneeSideForMeasure;
