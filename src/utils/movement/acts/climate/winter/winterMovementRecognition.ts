import type { PoseLandmarkLike } from "~/types/pose";
import {
  getBeatPassState,
  getWeightedBeatEvaluationScore,
} from "~/utils/movement/core/criteria";
import { extractNormalizedBodyMetrics } from "~/utils/movement/core/bodyMetrics";
import {
  buildWinterBeatCriteria,
  getWinterBeatFeedbackCode,
  getWinterCriteriaScore,
} from "~/utils/movement/acts/climate/winter/winterCriteria";
import {
  WINTER_BEAT_WEIGHTS,
  WINTER_MOVEMENT_REFERENCE,
  winterMovementConfig,
} from "~/utils/movement/acts/climate/winter/winterReference";
import type {
  WinterBeat,
  WinterBeatEvaluation,
  WinterContractionClass,
  WinterNeutralReference,
  WinterRecognitionMetrics,
  WinterRecognitionResultState,
  WinterSequenceEvaluation,
  WinterValue,
} from "~/utils/movement/acts/climate/winter/winterTypes";
import {
  averageValid,
  distance2D,
  type PosePoint,
} from "~/utils/pose/poseGeometry";

export * from "~/utils/movement/acts/climate/winter/winterReference";
export * from "~/utils/movement/acts/climate/winter/winterTypes";

type BeatContext = {
  expectedValue?: WinterValue;
  neutralReference?: WinterNeutralReference | null;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const getBodyHeight = ({
  shoulderCenter,
  leftAnkle,
  rightAnkle,
}: {
  shoulderCenter: PosePoint | null;
  leftAnkle: PosePoint | null;
  rightAnkle: PosePoint | null;
}) => {
  const averageAnkleY = averageValid([leftAnkle?.y, rightAnkle?.y]);

  if (!shoulderCenter || averageAnkleY === null) return null;

  return Math.abs(averageAnkleY - shoulderCenter.y);
};

const getReferenceDrop = ({
  currentY,
  neutralY,
  torsoLength,
}: {
  currentY: number | null | undefined;
  neutralY: number | null | undefined;
  torsoLength: number;
}) =>
  currentY !== null &&
  currentY !== undefined &&
  neutralY !== null &&
  neutralY !== undefined
    ? (currentY - neutralY) / torsoLength
    : null;

const getBodyHeightRatio = ({
  bodyHeight,
  neutralBodyHeight,
}: {
  bodyHeight: number | null;
  neutralBodyHeight: number | null | undefined;
}) =>
  bodyHeight !== null &&
  neutralBodyHeight !== null &&
  neutralBodyHeight !== undefined &&
  neutralBodyHeight > 0
    ? bodyHeight / neutralBodyHeight
    : null;

const getWinterCompactnessScore = ({
  headDrop,
  shoulderDrop,
  hipDrop,
  bodyHeightRatio,
  averageKneeAngle,
  torsoForwardLean,
}: {
  headDrop: number | null;
  shoulderDrop: number | null;
  hipDrop: number | null;
  bodyHeightRatio: number | null;
  averageKneeAngle: number | null;
  torsoForwardLean: number | null;
}) =>
  averageValid([
    headDrop !== null ? clamp01(headDrop * 0.9) : null,
    shoulderDrop !== null ? clamp01(shoulderDrop * 0.9) : null,
    hipDrop !== null ? clamp01(hipDrop * 0.85) : null,
    bodyHeightRatio !== null ? clamp01((1 - bodyHeightRatio) * 1.6) : null,
    averageKneeAngle !== null ? clamp01((165 - averageKneeAngle) / 95) : null,
    torsoForwardLean !== null ? clamp01(torsoForwardLean * 0.8) : null,
  ]);

const classifyContraction = (
  compactnessScore: number | null,
): WinterContractionClass => {
  if (compactnessScore === null || !Number.isFinite(compactnessScore)) {
    return "unknown";
  }

  if (
    compactnessScore < WINTER_MOVEMENT_REFERENCE["100"].contractionRange.max
  ) {
    return "upright";
  }
  if (compactnessScore < WINTER_MOVEMENT_REFERENCE["50"].contractionRange.max) {
    return "medium";
  }
  if (compactnessScore < WINTER_MOVEMENT_REFERENCE["20"].contractionRange.max) {
    return "deep";
  }

  return "extreme";
};

const getExpectedContractionClass = (
  expectedValue: WinterValue,
): WinterContractionClass => {
  if (expectedValue === "100") return "upright";
  if (expectedValue === "50") return "medium";
  if (expectedValue === "20") return "deep";

  return "extreme";
};

const createEmptyMetrics = (
  expectedValue: WinterValue = "100",
  neutralReference?: WinterNeutralReference | null,
): WinterRecognitionMetrics => ({
  shoulderWidth: null,
  torsoLength: null,
  neutralReferenceAvailable: Boolean(neutralReference),
  neutralShoulderCenterY: neutralReference?.shoulderCenterY ?? null,
  neutralHipCenterY: neutralReference?.hipCenterY ?? null,
  neutralBodyHeight: neutralReference?.bodyHeight ?? null,
  neutralAnkleDistance: neutralReference?.ankleDistance ?? null,
  neutralHeadY: neutralReference?.headY ?? null,
  headY: null,
  shoulderCenterY: null,
  hipCenterY: null,
  bodyHeight: null,
  headDrop: null,
  shoulderDrop: null,
  hipDrop: null,
  bodyHeightRatio: null,
  leftKneeAngle: null,
  rightKneeAngle: null,
  averageKneeAngle: null,
  torsoForwardLean: null,
  compactnessScore: null,
  expectedContractionClass: getExpectedContractionClass(expectedValue),
  detectedContractionClass: "unknown",
  normalizedHandDistance: null,
  normalizedAnkleDistance: null,
  handOpeningWidth: null,
  leftHandHeightFromShoulders: null,
  rightHandHeightFromShoulders: null,
  handsAtShoulderHeight: null,
  armsOpenSideways: null,
  elbowsMostlyStraight: null,
  armsCrossed: null,
  handsCenteredForHug: null,
  handsCompactForHug: null,
  leftHandOnRightSide: null,
  rightHandOnLeftSide: null,
  selfHugDetected: null,
  handsNearOppositeShoulders: null,
  handsNearHead: null,
  handsAboveHead: null,
  headProtectionExpected:
    WINTER_MOVEMENT_REFERENCE[expectedValue].requiresHeadProtection === true,
  headProtectionDetected: null,
  returnToUprightDetected: null,
  armsReleased: null,
  feetStable: null,
  landmarkConfidence: "missing-body-reference",
});

export const extractWinterRecognitionMetrics = (
  landmarks: PoseLandmarkLike[] | null | undefined,
  context: BeatContext = {},
): WinterRecognitionMetrics => {
  const expectedValue = context.expectedValue ?? "100";
  const neutralReference = context.neutralReference ?? null;

  if (!landmarks?.length)
    return createEmptyMetrics(expectedValue, neutralReference);

  const bodyMetrics = extractNormalizedBodyMetrics(landmarks);
  const {
    shoulderWidth,
    shoulderCenter,
    hipCenter,
    leftWrist,
    rightWrist,
    leftAnkle,
    rightAnkle,
  } = bodyMetrics;
  const leftShoulder = bodyMetrics.leftShoulder;
  const rightShoulder = bodyMetrics.rightShoulder;
  const headPoint = bodyMetrics.headPoint;
  const torsoLength = bodyMetrics.torsoLength ?? shoulderWidth;

  if (!shoulderWidth || !shoulderCenter || !hipCenter || !torsoLength) {
    return createEmptyMetrics(expectedValue, neutralReference);
  }

  const bodyHeight = getBodyHeight({ shoulderCenter, leftAnkle, rightAnkle });
  const headY = headPoint?.y ?? null;
  const headDrop = getReferenceDrop({
    currentY: headY,
    neutralY: neutralReference?.headY,
    torsoLength,
  });
  const shoulderDrop = getReferenceDrop({
    currentY: shoulderCenter.y,
    neutralY: neutralReference?.shoulderCenterY,
    torsoLength,
  });
  const hipDrop = getReferenceDrop({
    currentY: hipCenter.y,
    neutralY: neutralReference?.hipCenterY,
    torsoLength,
  });
  const bodyHeightRatio = getBodyHeightRatio({
    bodyHeight,
    neutralBodyHeight: neutralReference?.bodyHeight,
  });
  const leftKneeAngle = bodyMetrics.leftKneeAngle;
  const rightKneeAngle = bodyMetrics.rightKneeAngle;
  const averageKneeAngle = bodyMetrics.averageKneeAngle;
  const torsoForwardLean =
    shoulderCenter && hipCenter
      ? Math.abs(shoulderCenter.x - hipCenter.x) / shoulderWidth
      : null;
  const compactnessScore = getWinterCompactnessScore({
    headDrop,
    shoulderDrop,
    hipDrop,
    bodyHeightRatio,
    averageKneeAngle,
    torsoForwardLean,
  });
  const handOpeningWidth =
    leftWrist && rightWrist
      ? Math.abs(rightWrist.x - leftWrist.x) / shoulderWidth
      : null;
  const leftHandHeightFromShoulders = leftWrist
    ? (shoulderCenter.y - leftWrist.y) / torsoLength
    : null;
  const rightHandHeightFromShoulders = rightWrist
    ? (shoulderCenter.y - rightWrist.y) / torsoLength
    : null;
  const handsAtShoulderHeight =
    leftHandHeightFromShoulders === null ||
    rightHandHeightFromShoulders === null
      ? null
      : Math.abs(leftHandHeightFromShoulders) <=
          winterMovementConfig.thresholds.shoulderHeightTolerance &&
        Math.abs(rightHandHeightFromShoulders) <=
          winterMovementConfig.thresholds.shoulderHeightTolerance;
  const armsOpenSideways =
    handOpeningWidth === null
      ? null
      : handOpeningWidth >= winterMovementConfig.thresholds.openArmWidthMin;
  const averageElbowAngle = bodyMetrics.averageElbowAngle;
  const elbowsMostlyStraight =
    averageElbowAngle === null
      ? null
      : averageElbowAngle >= winterMovementConfig.thresholds.elbowStraightMin;
  const handCenterXOffset = bodyMetrics.handCenterXOffset;
  const handsCenteredForHug =
    handCenterXOffset === null
      ? null
      : Math.abs(handCenterXOffset) <=
        winterMovementConfig.thresholds.selfHugCenterMaxOffset;
  const handsCompactForHug =
    bodyMetrics.normalizedHandDistance === null
      ? null
      : bodyMetrics.normalizedHandDistance <=
        winterMovementConfig.thresholds.selfHugHandDistanceMax;
  const armsCrossed =
    handsCenteredForHug === null || handsCompactForHug === null
      ? null
      : handsCenteredForHug && handsCompactForHug;
  const leftHandOnRightSide =
    leftWrist && leftShoulder && rightShoulder
      ? leftShoulder.x > rightShoulder.x
        ? leftWrist.x <= shoulderCenter.x
        : leftWrist.x >= shoulderCenter.x
      : null;
  const rightHandOnLeftSide =
    rightWrist && leftShoulder && rightShoulder
      ? leftShoulder.x > rightShoulder.x
        ? rightWrist.x >= shoulderCenter.x
        : rightWrist.x <= shoulderCenter.x
      : null;
  const handsAtHugHeight =
    leftHandHeightFromShoulders === null ||
    rightHandHeightFromShoulders === null
      ? null
      : leftHandHeightFromShoulders >=
          winterMovementConfig.thresholds.selfHugHeightMin &&
        leftHandHeightFromShoulders <=
          winterMovementConfig.thresholds.selfHugHeightMax &&
        rightHandHeightFromShoulders >=
          winterMovementConfig.thresholds.selfHugHeightMin &&
        rightHandHeightFromShoulders <=
          winterMovementConfig.thresholds.selfHugHeightMax;
  const leftHandToRightShoulder =
    leftWrist && rightShoulder
      ? distance2D(leftWrist, rightShoulder) / shoulderWidth
      : null;
  const rightHandToLeftShoulder =
    rightWrist && leftShoulder
      ? distance2D(rightWrist, leftShoulder) / shoulderWidth
      : null;
  const handsNearOppositeShoulders =
    leftHandToRightShoulder === null || rightHandToLeftShoulder === null
      ? null
      : averageValid([leftHandToRightShoulder, rightHandToLeftShoulder])! <=
        winterMovementConfig.thresholds.oppositeShoulderDistanceMax;
  const selfHugDetected =
    handsAtHugHeight === null ||
    handsCenteredForHug === null ||
    handsCompactForHug === null
      ? null
      : handsAtHugHeight &&
        ((handsCenteredForHug && handsCompactForHug) ||
          handsNearOppositeShoulders === true ||
          leftHandOnRightSide === true ||
          rightHandOnLeftSide === true);
  const leftHandToHead =
    leftWrist && headPoint
      ? distance2D(leftWrist, headPoint) / shoulderWidth
      : null;
  const rightHandToHead =
    rightWrist && headPoint
      ? distance2D(rightWrist, headPoint) / shoulderWidth
      : null;
  const handsNearHead =
    leftHandToHead === null || rightHandToHead === null
      ? null
      : averageValid([leftHandToHead, rightHandToHead])! <= 1.2;
  const handsAboveHead =
    leftHandHeightFromShoulders === null ||
    rightHandHeightFromShoulders === null ||
    headPoint === null
      ? null
      : leftWrist!.y <= headPoint.y + 0.08 &&
        rightWrist!.y <= headPoint.y + 0.08;
  const headProtectionDetected =
    handsNearHead === null && handsAboveHead === null
      ? null
      : handsNearHead === true || handsAboveHead === true;
  const returnDropSignal = averageValid([headDrop, shoulderDrop, hipDrop]);
  const returnToUprightDetected =
    returnDropSignal === null
      ? null
      : returnDropSignal <= winterMovementConfig.thresholds.returnDropMax ||
        (compactnessScore !== null && compactnessScore <= 0.4);
  const armsReleased =
    handOpeningWidth === null
      ? null
      : handOpeningWidth >=
        winterMovementConfig.thresholds.returnHandDistanceMin;
  const feetStable =
    bodyMetrics.normalizedAnkleDistance === null ||
    neutralReference?.ankleDistance === null ||
    neutralReference?.ankleDistance === undefined
      ? null
      : Math.abs(
          bodyMetrics.normalizedAnkleDistance - neutralReference.ankleDistance,
        ) <= winterMovementConfig.thresholds.feetStableMaxDelta;

  return {
    shoulderWidth,
    torsoLength,
    neutralReferenceAvailable: Boolean(neutralReference),
    neutralShoulderCenterY: neutralReference?.shoulderCenterY ?? null,
    neutralHipCenterY: neutralReference?.hipCenterY ?? null,
    neutralBodyHeight: neutralReference?.bodyHeight ?? null,
    neutralAnkleDistance: neutralReference?.ankleDistance ?? null,
    neutralHeadY: neutralReference?.headY ?? null,
    headY,
    shoulderCenterY: shoulderCenter.y,
    hipCenterY: hipCenter.y,
    bodyHeight,
    headDrop,
    shoulderDrop,
    hipDrop,
    bodyHeightRatio,
    leftKneeAngle,
    rightKneeAngle,
    averageKneeAngle,
    torsoForwardLean,
    compactnessScore,
    expectedContractionClass: getExpectedContractionClass(expectedValue),
    detectedContractionClass: classifyContraction(compactnessScore),
    normalizedHandDistance: bodyMetrics.normalizedHandDistance,
    normalizedAnkleDistance: bodyMetrics.normalizedAnkleDistance,
    handOpeningWidth,
    leftHandHeightFromShoulders,
    rightHandHeightFromShoulders,
    handsAtShoulderHeight,
    armsOpenSideways,
    elbowsMostlyStraight,
    armsCrossed,
    handsCenteredForHug,
    handsCompactForHug,
    leftHandOnRightSide,
    rightHandOnLeftSide,
    selfHugDetected,
    handsNearOppositeShoulders,
    handsNearHead,
    handsAboveHead,
    headProtectionExpected:
      WINTER_MOVEMENT_REFERENCE[expectedValue].requiresHeadProtection === true,
    headProtectionDetected,
    returnToUprightDetected,
    armsReleased,
    feetStable,
    landmarkConfidence: bodyMetrics.landmarkConfidence,
  };
};

export const evaluateWinterBeat = (
  landmarks: PoseLandmarkLike[] | null | undefined,
  beat: WinterBeat,
  timestamp: number,
  context: BeatContext = {},
): WinterBeatEvaluation => {
  const expectedValue = context.expectedValue ?? "100";
  const metrics = extractWinterRecognitionMetrics(landmarks, {
    ...context,
    expectedValue,
  });

  if (!landmarks?.length || metrics.shoulderWidth === null) {
    return {
      beat,
      score: 0,
      passed: false,
      trackingUnavailable: true,
      criteria: [],
      timestamp,
      expectedValue,
      feedbackCode: "FULL_BODY_NOT_VISIBLE",
      metrics,
    };
  }

  const criteria = buildWinterBeatCriteria(beat, metrics, expectedValue);
  const score = getWinterCriteriaScore(criteria);
  const { passed, trackingUnavailable } = getBeatPassState({
    criteria,
    score,
    passScore: winterMovementConfig.thresholds.beatPassScore,
  });

  return {
    beat,
    score,
    passed,
    trackingUnavailable,
    criteria,
    timestamp,
    expectedValue,
    feedbackCode: passed ? undefined : getWinterBeatFeedbackCode(criteria),
    metrics,
  };
};

const hasFailedCriterion = (
  evaluation: WinterBeatEvaluation,
  criterionIds: string[],
) =>
  evaluation.criteria.some(
    (criterion) =>
      criterionIds.includes(criterion.id) && criterion.status === "failed",
  );

const findWinterProblemByBeatAndCriteria = (
  beatEvaluations: WinterBeatEvaluation[],
  beat: WinterBeat,
  criterionIds: string[],
) =>
  beatEvaluations.find(
    (evaluation) =>
      evaluation.beat === beat &&
      !evaluation.passed &&
      evaluation.feedbackCode &&
      hasFailedCriterion(evaluation, criterionIds),
  );

export const getPrioritizedWinterProblemEvaluation = (
  beatEvaluations: WinterBeatEvaluation[],
) => {
  const trackingProblem = beatEvaluations.find(
    (evaluation) => evaluation.trackingUnavailable,
  );

  if (trackingProblem) return trackingProblem;

  return (
    findWinterProblemByBeatAndCriteria(beatEvaluations, 1, [
      "open-arms-wide",
      "hands-shoulder-height",
    ]) ??
    findWinterProblemByBeatAndCriteria(beatEvaluations, 2, [
      "self-hug-crossed",
      "opposite-shoulders",
    ]) ??
    findWinterProblemByBeatAndCriteria(beatEvaluations, 3, [
      "value-contraction",
      "head-protection",
      "knee-contraction",
      "keep-arms-crossed",
    ]) ??
    findWinterProblemByBeatAndCriteria(beatEvaluations, 4, [
      "return-upright",
      "arms-released",
    ]) ??
    beatEvaluations.find(
      (evaluation) => !evaluation.passed && evaluation.feedbackCode,
    )
  );
};

export const evaluateWinterSequence = (
  beatEvaluations: WinterBeatEvaluation[],
): WinterSequenceEvaluation => {
  const totalScore = getWeightedBeatEvaluationScore(
    beatEvaluations,
    WINTER_BEAT_WEIGHTS,
  );
  const hasTrackingUnavailable = beatEvaluations.some(
    (evaluation) => evaluation.trackingUnavailable,
  );
  const hasCentralFailure = beatEvaluations.some(
    (evaluation) => !evaluation.passed,
  );
  const passed =
    !hasTrackingUnavailable &&
    !hasCentralFailure &&
    totalScore >= winterMovementConfig.thresholds.almostCorrectScore;
  const resultState: WinterRecognitionResultState = hasTrackingUnavailable
    ? "trackingUnavailable"
    : totalScore >= winterMovementConfig.thresholds.successScore &&
        !hasCentralFailure
      ? "success"
      : passed
        ? "almostCorrect"
        : "retryRequired";
  const prioritizedProblem =
    getPrioritizedWinterProblemEvaluation(beatEvaluations);

  return {
    passed,
    resultState,
    totalScore,
    beatEvaluations,
    feedbackCode:
      resultState === "success"
        ? "SUCCESS"
        : (prioritizedProblem?.feedbackCode ?? "TRY_AGAIN"),
  };
};
