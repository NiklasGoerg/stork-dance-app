import type { PoseLandmarkLike } from "~/types/pose";
import {
  getEssentialCriteriaStats,
  getWeightedCriteriaScore,
} from "~/utils/movement/core/criteria";
import {
  formatMovementRange,
  getRangeFailureDirection,
  isInMovementRange,
} from "~/utils/movement/core/range";
import {
  SUMMER_MOVEMENT_REFERENCE,
  summerMovementConfig,
} from "~/utils/movement/acts/climate/summer/summerReference";
import type {
  SummerBeat,
  SummerCriterionDomain,
  SummerCriterionImportance,
  SummerCriterionResult,
  SummerFeedbackCode,
  SummerIntensity,
  SummerRange,
  SummerRecognitionMetrics,
  SummerStepSide,
} from "~/utils/movement/acts/climate/summer/summerTypes";
import {
  averageValid,
  distance2D,
  midpoint,
  toPosePoint,
} from "~/utils/pose/poseGeometry";
import { MIN_SHOULDER_WIDTH, POSE_LANDMARK } from "~/utils/pose/poseLandmarks";

type BeatContext = {
  expectedIntensity?: SummerIntensity;
  expectedStepSide?: Exclude<SummerStepSide, "none" | "unknown"> | null;
  expansionReference?: {
    normalizedAnkleDistance: number | null;
    lowestHandHeightFromShoulders: number | null;
  } | null;
  preparationReference?: {
    handRaiseAmplitude: number | null;
    normalizedArmOpening: number | null;
  } | null;
};

const getLandmark = (landmarks: PoseLandmarkLike[], index: number) =>
  landmarks[index] ?? null;

const roundDebug = (value: number | null) =>
  value === null || !Number.isFinite(value) ? "n/a" : Number(value.toFixed(2));

const getShoulderWidth = (landmarks: PoseLandmarkLike[]) => {
  const shoulderWidth = distance2D(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_SHOULDER),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_SHOULDER),
  );

  if (!shoulderWidth || shoulderWidth < MIN_SHOULDER_WIDTH) return null;

  return shoulderWidth;
};

const getHeadPoint = (landmarks: PoseLandmarkLike[]) =>
  toPosePoint(getLandmark(landmarks, POSE_LANDMARK.NOSE)) ??
  midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_EAR),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_EAR),
  );

const criterion = ({
  id,
  label,
  importance,
  domain = "shape",
  value,
  passed,
  expectedRange,
  failureDirection,
  feedbackCode,
}: {
  id: string;
  label: string;
  importance: SummerCriterionImportance;
  domain?: SummerCriterionDomain;
  value: number | string | null | undefined;
  passed: boolean;
  expectedRange?: string;
  failureDirection?: "tooLow" | "tooHigh";
  feedbackCode?: SummerFeedbackCode;
}): SummerCriterionResult => {
  const evaluable =
    value !== null && value !== undefined && value !== "unknown";

  return {
    id,
    label,
    status: !evaluable ? "notEvaluable" : passed ? "passed" : "failed",
    passed: evaluable && passed,
    score: evaluable && passed ? 1 : 0,
    importance,
    domain,
    debugValue: typeof value === "number" ? roundDebug(value) : value,
    expectedRange,
    failureDirection: evaluable && !passed ? failureDirection : undefined,
    feedbackCode: evaluable && !passed ? feedbackCode : undefined,
  };
};

const rangeCriterion = ({
  id,
  label,
  importance,
  domain = "intensity",
  value,
  range,
  tooLowFeedback,
  tooHighFeedback,
}: {
  id: string;
  label: string;
  importance: SummerCriterionImportance;
  domain?: SummerCriterionDomain;
  value: number | null;
  range: SummerRange;
  tooLowFeedback: SummerFeedbackCode;
  tooHighFeedback: SummerFeedbackCode;
}) => {
  const failureDirection = getRangeFailureDirection(value, range);

  return criterion({
    id,
    label,
    importance,
    domain,
    value,
    passed: isInMovementRange(value, range),
    expectedRange: formatMovementRange(range),
    failureDirection,
    feedbackCode:
      failureDirection === "tooLow"
        ? tooLowFeedback
        : failureDirection === "tooHigh"
          ? tooHighFeedback
          : undefined,
  });
};

const getHandCenterXOffset = (landmarks: PoseLandmarkLike[]) => {
  const shoulderWidth = getShoulderWidth(landmarks);
  const handCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_WRIST),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_WRIST),
  );
  const shoulderCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_SHOULDER),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_SHOULDER),
  );

  if (!shoulderWidth || !handCenter || !shoulderCenter) return null;

  return Math.abs(handCenter.x - shoulderCenter.x) / shoulderWidth;
};

const getHandCenterYFromShoulders = (landmarks: PoseLandmarkLike[]) => {
  const shoulderWidth = getShoulderWidth(landmarks);
  const handCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_WRIST),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_WRIST),
  );
  const shoulderCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_SHOULDER),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_SHOULDER),
  );

  if (!shoulderWidth || !handCenter || !shoulderCenter) return null;

  return (handCenter.y - shoulderCenter.y) / shoulderWidth;
};

const getWristSideOpening = (landmarks: PoseLandmarkLike[]) => {
  const shoulderWidth = getShoulderWidth(landmarks);
  const leftWrist = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_WRIST),
  );
  const rightWrist = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_WRIST),
  );
  const shoulderCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_SHOULDER),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_SHOULDER),
  );

  if (!shoulderWidth || !leftWrist || !rightWrist || !shoulderCenter) {
    return null;
  }

  return {
    leftOffset: (leftWrist.x - shoulderCenter.x) / shoulderWidth,
    rightOffset: (rightWrist.x - shoulderCenter.x) / shoulderWidth,
    span: Math.abs(leftWrist.x - rightWrist.x) / shoulderWidth,
  };
};

const getBothHandsAboveHead = (
  landmarks: PoseLandmarkLike[],
  marginMultiplier = summerMovementConfig["100"].thresholds
    .handsAboveHeadMargin,
) => {
  const shoulderWidth = getShoulderWidth(landmarks);
  const headPoint = getHeadPoint(landmarks);
  const leftWrist = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_WRIST),
  );
  const rightWrist = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_WRIST),
  );

  if (!shoulderWidth || !headPoint || !leftWrist || !rightWrist) return null;

  const margin = shoulderWidth * marginMultiplier;

  return leftWrist.y <= headPoint.y - margin &&
    rightWrist.y <= headPoint.y - margin
    ? 1
    : 0;
};

const getElbowsBelowShoulders = (landmarks: PoseLandmarkLike[]) => {
  const shoulderWidth = getShoulderWidth(landmarks);
  const leftElbow = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_ELBOW),
  );
  const rightElbow = toPosePoint(
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_ELBOW),
  );
  const shoulderCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_SHOULDER),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_SHOULDER),
  );

  if (!shoulderWidth || !leftElbow || !rightElbow || !shoulderCenter) {
    return null;
  }

  return leftElbow.y >= shoulderCenter.y - shoulderWidth * 0.25 &&
    rightElbow.y >= shoulderCenter.y - shoulderWidth * 0.25
    ? 1
    : 0;
};

const getStandingSymmetry = (landmarks: PoseLandmarkLike[]) => {
  const shoulderCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_SHOULDER),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_SHOULDER),
  );
  const hipCenter = midpoint(
    getLandmark(landmarks, POSE_LANDMARK.LEFT_HIP),
    getLandmark(landmarks, POSE_LANDMARK.RIGHT_HIP),
  );
  const shoulderWidth = getShoulderWidth(landmarks);

  if (!shoulderCenter || !hipCenter || !shoulderWidth) return null;

  return Math.abs(shoulderCenter.x - hipCenter.x) / shoulderWidth;
};

export const buildSummerBeatCriteria = (
  landmarks: PoseLandmarkLike[],
  beat: SummerBeat,
  metrics: SummerRecognitionMetrics,
  context: BeatContext,
) => {
  const expectedIntensity = context.expectedIntensity ?? "100";
  const thresholds = summerMovementConfig[expectedIntensity].thresholds;
  const reference = SUMMER_MOVEMENT_REFERENCE[expectedIntensity];
  const averageHandY = averageValid([
    metrics.leftHandHeightFromShoulders,
    metrics.rightHandHeightFromShoulders,
  ]);
  const averageElbowAngle = metrics.averageElbowAngle;
  const handCenterXOffset = getHandCenterXOffset(landmarks);
  const handCenterY = getHandCenterYFromShoulders(landmarks);
  const opening = getWristSideOpening(landmarks);

  if (beat === 1) {
    return [
      criterion({
        id: "feet-close",
        label: "Feet close",
        importance: "essential",
        value: metrics.normalizedAnkleDistance,
        passed:
          metrics.normalizedAnkleDistance !== null &&
          metrics.normalizedAnkleDistance <= thresholds.closedStanceMax,
        expectedRange: `<= ${thresholds.closedStanceMax}`,
      }),
      criterion({
        id: "hands-together",
        label: "Hands together in front of upper body",
        importance: "essential",
        value: metrics.normalizedHandDistance,
        passed:
          metrics.normalizedHandDistance !== null &&
          metrics.normalizedHandDistance <= thresholds.handsTogetherMax,
        expectedRange: `<= ${thresholds.handsTogetherMax}`,
      }),
      criterion({
        id: "hand-center-between-shoulders",
        label: "Hand center between shoulders",
        importance: "essential",
        value: handCenterXOffset,
        passed:
          handCenterXOffset !== null &&
          handCenterXOffset <= thresholds.handCenterMaxOffset,
        expectedRange: `<= ${thresholds.handCenterMaxOffset}`,
      }),
      criterion({
        id: "hands-chest-height",
        label: "Hands around chest-to-shoulder height",
        importance: "essential",
        value: handCenterY,
        passed:
          handCenterY !== null &&
          handCenterY >= thresholds.chestMinY &&
          handCenterY <= thresholds.chestMaxY,
        expectedRange: `${thresholds.chestMinY}..${thresholds.chestMaxY}`,
      }),
      criterion({
        id: "elbows-below-shoulders",
        label: "Elbows below shoulders",
        importance: "supporting",
        value: getElbowsBelowShoulders(landmarks),
        passed: getElbowsBelowShoulders(landmarks) === 1,
      }),
      criterion({
        id: "upright-torso",
        label: "Upper body upright",
        importance: "supporting",
        value: getStandingSymmetry(landmarks),
        passed: (getStandingSymmetry(landmarks) ?? 1) <= 0.55,
        expectedRange: "<= 0.55",
      }),
    ];
  }

  if (beat === 2) {
    const expectedSide = context.expectedStepSide;
    const sideMatchesExpectation =
      !expectedSide || metrics.detectedStepSide === expectedSide;
    const handsAboveHeadMargin =
      expectedIntensity === "100" ? thresholds.handsAboveHeadMargin : -0.02;
    const preparationHandRaise =
      context.preparationReference?.handRaiseAmplitude ?? null;
    const hasRaisedFromPreparation =
      metrics.handRaiseAmplitude !== null &&
      (preparationHandRaise === null ||
        metrics.handRaiseAmplitude >=
          preparationHandRaise + (expectedIntensity === "10" ? 0.02 : 0.04));
    const handFeedbackTooHigh =
      expectedIntensity === "100" ? "TRY_AGAIN" : "MOVEMENT_TOO_LARGE";
    const elbowFeedbackTooLow =
      expectedIntensity === "100" ? "STRAIGHTEN_ARMS" : "TRY_AGAIN";
    const elbowFeedbackTooHigh =
      expectedIntensity === "100" ? "TRY_AGAIN" : "BEND_ELBOWS_MORE";

    return [
      criterion({
        id: "one-leg-stepped-side",
        label: "One leg stepped clearly to the side",
        importance: "essential",
        value: metrics.detectedStepSide,
        passed:
          metrics.detectedStepSide === "left" ||
          metrics.detectedStepSide === "right",
        expectedRange: "left or right",
      }),
      criterion({
        id: "alternate-step-side",
        label: "Alternating step side",
        importance: "essential",
        value: expectedSide ? metrics.detectedStepSide : "not-set",
        passed: sideMatchesExpectation,
        expectedRange: expectedSide ?? "first side may be either",
      }),
      criterion({
        id: "hands-raised-from-prep",
        label: "Hands move upward from preparation",
        importance: "essential",
        value: metrics.handRaiseAmplitude,
        passed: hasRaisedFromPreparation,
        expectedRange:
          preparationHandRaise === null
            ? "visible upward movement"
            : `>= ${roundDebug(
                preparationHandRaise +
                  (expectedIntensity === "10" ? 0.02 : 0.04),
              )}`,
        feedbackCode: "RAISE_ARMS_HIGHER",
      }),
      reference.beat2.handsAboveHeadRequired
        ? criterion({
            id: "hands-above-head",
            label: "Both hands above the head",
            importance: "essential",
            domain: "intensity",
            value: getBothHandsAboveHead(landmarks),
            passed:
              getBothHandsAboveHead(landmarks, handsAboveHeadMargin) === 1,
            feedbackCode: "RAISE_ARMS_HIGHER",
          })
        : criterion({
            id: "hands-stay-compact",
            label: "Hands stay compact in front of upper body",
            importance: "essential",
            domain: "shape",
            value: handCenterXOffset,
            passed:
              handCenterXOffset !== null &&
              handCenterXOffset <= thresholds.handCenterMaxOffset,
            expectedRange: `<= ${thresholds.handCenterMaxOffset}`,
            feedbackCode: "MOVE_HANDS_TO_CENTER",
          }),
      rangeCriterion({
        id: "hand-raise-target",
        label: `Hand height matches ${expectedIntensity}`,
        importance: "essential",
        value: metrics.handRaiseAmplitude,
        range: reference.beat2.handRaiseAmplitude,
        tooLowFeedback: "RAISE_ARMS_HIGHER",
        tooHighFeedback: handFeedbackTooHigh,
      }),
      rangeCriterion({
        id: "elbow-angle-target",
        label: `Elbow bend matches ${expectedIntensity}`,
        importance: "supporting",
        value: averageElbowAngle,
        range: reference.beat2.elbowAngle,
        tooLowFeedback: elbowFeedbackTooLow,
        tooHighFeedback: elbowFeedbackTooHigh,
      }),
      criterion({
        id: "hands-form-overhead-shape",
        label: "Hands form one upward shape",
        importance: "supporting",
        value: metrics.normalizedHandDistance,
        passed:
          metrics.normalizedHandDistance !== null &&
          metrics.normalizedHandDistance <= thresholds.overheadHandsTogetherMax,
        expectedRange: `<= ${thresholds.overheadHandsTogetherMax}`,
      }),
    ];
  }

  if (beat === 3) {
    const expectedSide = context.expectedStepSide;
    const steppedSide =
      expectedSide && metrics.detectedStepSide !== "unknown"
        ? metrics.detectedStepSide === expectedSide
        : metrics.detectedStepSide === "left" ||
          metrics.detectedStepSide === "right";
    const openingDirectionMatches =
      opening !== null &&
      Math.sign(opening.leftOffset) !== Math.sign(opening.rightOffset);
    const minimumShapeOpening =
      expectedIntensity === "10"
        ? 0.12
        : expectedIntensity === "30"
          ? 0.28
          : 0.48;

    return [
      criterion({
        id: "stepped-leg-remains",
        label: "Stepped leg remains to the side",
        importance: "essential",
        value: metrics.detectedStepSide,
        passed: steppedSide,
        expectedRange: expectedSide ?? "same side as expansion",
      }),
      criterion({
        id: "hands-open-sides",
        label: "Hands opened to both sides",
        importance: "essential",
        value: opening?.span,
        passed:
          opening !== null &&
          opening.span >= minimumShapeOpening &&
          openingDirectionMatches,
        expectedRange: `>= ${minimumShapeOpening}`,
        feedbackCode: "OPEN_ARMS_TO_SIDES",
      }),
      criterion({
        id: "hands-shoulder-height",
        label: "Hands around shoulder height",
        importance: "essential",
        value: averageHandY,
        passed:
          metrics.leftHandHeightFromShoulders !== null &&
          metrics.rightHandHeightFromShoulders !== null &&
          Math.abs(metrics.leftHandHeightFromShoulders) <=
            thresholds.shoulderHeightTolerance &&
          Math.abs(metrics.rightHandHeightFromShoulders) <=
            thresholds.shoulderHeightTolerance,
        expectedRange: `+/- ${thresholds.shoulderHeightTolerance}`,
      }),
      rangeCriterion({
        id: "arm-opening-target",
        label: `Arm opening matches ${expectedIntensity}`,
        importance: "supporting",
        value: metrics.normalizedArmOpening,
        range: reference.beat3.armOpening,
        tooLowFeedback: "OPEN_ARMS_TO_SIDES",
        tooHighFeedback:
          expectedIntensity === "100" ? "TRY_AGAIN" : "OPEN_ARMS_LESS",
      }),
      rangeCriterion({
        id: "elbow-angle-target",
        label: `Elbow bend matches ${expectedIntensity}`,
        importance: "supporting",
        value: averageElbowAngle,
        range: reference.beat3.elbowAngle,
        tooLowFeedback:
          expectedIntensity === "100" ? "STRAIGHTEN_ARMS" : "TRY_AGAIN",
        tooHighFeedback:
          expectedIntensity === "100" ? "TRY_AGAIN" : "BEND_ELBOWS_MORE",
      }),
      criterion({
        id: "hands-similar-height",
        label: "Hands at similar height",
        importance: "supporting",
        value:
          metrics.leftHandHeightFromShoulders !== null &&
          metrics.rightHandHeightFromShoulders !== null
            ? Math.abs(
                metrics.leftHandHeightFromShoulders -
                  metrics.rightHandHeightFromShoulders,
              )
            : null,
        passed:
          metrics.leftHandHeightFromShoulders !== null &&
          metrics.rightHandHeightFromShoulders !== null &&
          Math.abs(
            metrics.leftHandHeightFromShoulders -
              metrics.rightHandHeightFromShoulders,
          ) <= 0.5,
        expectedRange: "<= 0.5",
      }),
    ];
  }

  const expansionAnkleDistance =
    context.expansionReference?.normalizedAnkleDistance ?? null;
  const expansionReturned =
    expansionAnkleDistance === null || metrics.normalizedAnkleDistance === null
      ? metrics.normalizedAnkleDistance
      : metrics.normalizedAnkleDistance / expansionAnkleDistance;

  return [
    criterion({
      id: "feet-returned-close",
      label: "Feet returned to closed stance",
      importance: "essential",
      value: metrics.normalizedAnkleDistance,
      passed:
        metrics.normalizedAnkleDistance !== null &&
        metrics.normalizedAnkleDistance <= thresholds.closedStanceMax,
      expectedRange: `<= ${thresholds.closedStanceMax}`,
    }),
    criterion({
      id: "hands-lowered-sides",
      label: "Hands lowered to the sides",
      importance: "essential",
      value: averageHandY,
      passed:
        metrics.leftHandHeightFromShoulders !== null &&
        metrics.rightHandHeightFromShoulders !== null &&
        metrics.leftHandHeightFromShoulders >= thresholds.handsLoweredMinY &&
        metrics.rightHandHeightFromShoulders >= thresholds.handsLoweredMinY,
      expectedRange: `>= ${thresholds.handsLoweredMinY}`,
    }),
    criterion({
      id: "returned-from-expansion",
      label: "Movement returned from expansion",
      importance: "essential",
      value: expansionReturned,
      passed:
        expansionReturned !== null &&
        expansionReturned <= thresholds.returnExpansionRatio,
      expectedRange: `<= ${thresholds.returnExpansionRatio}`,
    }),
    criterion({
      id: "arms-relaxed",
      label: "Arms relaxed or extended down",
      importance: "supporting",
      value: averageElbowAngle,
      passed:
        averageElbowAngle !== null &&
        averageElbowAngle >= thresholds.straightElbowMinAngle - 18,
      expectedRange: `>= ${thresholds.straightElbowMinAngle - 18}`,
    }),
    criterion({
      id: "body-symmetric",
      label: "Body roughly symmetric",
      importance: "supporting",
      value: getStandingSymmetry(landmarks),
      passed: (getStandingSymmetry(landmarks) ?? 1) <= 0.55,
      expectedRange: "<= 0.55",
    }),
  ];
};

export const getSummerCriteriaScore = (criteria: SummerCriterionResult[]) =>
  getWeightedCriteriaScore(criteria);

export const getSummerEssentialPassRatio = (
  criteria: SummerCriterionResult[],
) => {
  const essentialCriteria = criteria.filter(
    (item) => item.importance === "essential",
  );
  const evaluableEssentialCriteria = essentialCriteria.filter(
    (item) => item.status !== "notEvaluable",
  );
  const essentialStats = getEssentialCriteriaStats(criteria);

  return {
    essentialCriteria,
    evaluableEssentialCriteria,
    passRatio:
      essentialStats.totalCount > 0
        ? essentialStats.passedCount / essentialStats.totalCount
        : 0,
  };
};

export const getSummerBeatFeedbackCode = (
  beat: SummerBeat,
  criteria: SummerCriterionResult[],
): SummerFeedbackCode | undefined => {
  const failed = criteria.find(
    (item) => item.importance === "essential" && item.status === "failed",
  );
  const notEvaluable = criteria.find(
    (item) => item.importance === "essential" && item.status === "notEvaluable",
  );

  if (notEvaluable) return "FULL_BODY_NOT_VISIBLE";
  if (!failed) {
    const supportingFailure = criteria.find(
      (item) => item.importance === "supporting" && item.status === "failed",
    );

    return supportingFailure?.feedbackCode;
  }

  if (failed.feedbackCode) return failed.feedbackCode;

  if (
    failed.id === "hands-together" ||
    failed.id === "hand-center-between-shoulders"
  ) {
    return "MOVE_HANDS_TO_CENTER";
  }

  if (failed.id === "one-leg-stepped-side") return "TRY_AGAIN";
  if (failed.id === "alternate-step-side") return "ALTERNATE_STEP_SIDE";
  if (
    failed.id === "hands-above-head" ||
    failed.id === "both-arms-raised" ||
    failed.id === "hands-raised-from-prep" ||
    failed.id === "hand-raise-target"
  ) {
    return "RAISE_ARMS_HIGHER";
  }
  if (failed.id === "hands-open-sides" || beat === 3) {
    return "OPEN_ARMS_TO_SIDES";
  }
  if (failed.id === "feet-returned-close") return "RETURN_FEET_TO_CENTER";
  if (failed.id === "hands-lowered-sides") return "LOWER_ARMS";

  return "TRY_AGAIN";
};
