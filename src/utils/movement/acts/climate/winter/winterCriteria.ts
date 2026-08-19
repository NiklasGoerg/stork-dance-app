import { getWeightedCriteriaScore } from "~/utils/movement/core/criteria";
import {
  getRangeFailureDirection,
  isInMovementRange,
} from "~/utils/movement/core/range";
import {
  WINTER_MOVEMENT_REFERENCE,
  winterMovementConfig,
} from "~/utils/movement/acts/climate/winter/winterReference";
import {
  createAct4SeasonCriterionFactory,
  getHighestPriorityFailedCriterion,
} from "~/utils/act4/criteria";
import type {
  WinterBeat,
  WinterCriterionImportance,
  WinterCriterionResult,
  WinterFeedbackCode,
  WinterRecognitionMetrics,
  WinterValue,
} from "~/utils/movement/acts/climate/winter/winterTypes";

const criterion = createAct4SeasonCriterionFactory<
  WinterCriterionImportance,
  WinterFeedbackCode,
  WinterCriterionResult
>();

const openArmsCriterion = (metrics: WinterRecognitionMetrics) =>
  criterion({
    id: "open-arms-wide",
    label: "Arms open wide at shoulder height",
    importance: "essential",
    value: metrics.handOpeningWidth,
    passed:
      metrics.handOpeningWidth !== null &&
      metrics.handOpeningWidth >=
        winterMovementConfig.thresholds.openArmWidthMin,
    expectedRange: `>= ${winterMovementConfig.thresholds.openArmWidthMin}`,
    feedbackCode: "OPEN_ARMS_WIDER",
  });

const shoulderHeightCriterion = (metrics: WinterRecognitionMetrics) =>
  criterion({
    id: "hands-shoulder-height",
    label: "Hands stay near shoulder height",
    importance: "essential",
    value: metrics.handsAtShoulderHeight,
    passed: metrics.handsAtShoulderHeight === true,
    expectedRange: `within ${winterMovementConfig.thresholds.shoulderHeightTolerance}`,
    feedbackCode: "RAISE_ARMS_TO_SHOULDERS",
  });

const straightArmsCriterion = (
  metrics: WinterRecognitionMetrics,
  importance: WinterCriterionImportance = "supporting",
) =>
  criterion({
    id: "arms-straight",
    label: "Elbows stay extended",
    importance,
    value: metrics.elbowsMostlyStraight,
    passed: metrics.elbowsMostlyStraight === true,
    expectedRange: `>= ${winterMovementConfig.thresholds.elbowStraightMin}`,
    feedbackCode: "STRAIGHTEN_ARMS_MORE",
  });

const selfHugCriterion = (
  metrics: WinterRecognitionMetrics,
  importance: WinterCriterionImportance = "essential",
) =>
  criterion({
    id: "self-hug-crossed",
    label: "Arms cross in front of the body",
    importance,
    value: metrics.selfHugDetected,
    passed: metrics.selfHugDetected === true,
    expectedRange: "wrists crossed in front",
    feedbackCode: "CROSS_ARMS_IN_FRONT",
  });

const oppositeShoulderCriterion = (metrics: WinterRecognitionMetrics) =>
  criterion({
    id: "opposite-shoulders",
    label: "Hands reach toward opposite shoulders",
    importance: "supporting",
    value: metrics.handsNearOppositeShoulders,
    passed: metrics.handsNearOppositeShoulders !== false,
    expectedRange: `<= ${winterMovementConfig.thresholds.oppositeShoulderDistanceMax}`,
    feedbackCode: "REACH_OPPOSITE_SHOULDERS",
  });

const uprightCriterion = (metrics: WinterRecognitionMetrics) =>
  criterion({
    id: "stay-upright",
    label: "Body stays upright",
    importance: "supporting",
    value: metrics.compactnessScore,
    passed:
      (metrics.compactnessScore !== null &&
        metrics.compactnessScore <=
          WINTER_MOVEMENT_REFERENCE["100"].contractionRange.max) ||
      (metrics.hipDrop !== null &&
        metrics.hipDrop <= winterMovementConfig.thresholds.uprightDropMax),
    expectedRange: `<= ${WINTER_MOVEMENT_REFERENCE["100"].contractionRange.max}`,
    feedbackCode: "STAY_UPRIGHT",
  });

const contractionCriterion = (
  metrics: WinterRecognitionMetrics,
  expectedValue: WinterValue,
) => {
  const reference = WINTER_MOVEMENT_REFERENCE[expectedValue];
  const failureDirection = getRangeFailureDirection(
    metrics.compactnessScore,
    reference.contractionRange,
  );
  const tooHighCode: WinterFeedbackCode =
    expectedValue === "100" ? "STAY_UPRIGHT" : "STAY_HIGHER";
  const tooLowCode: WinterFeedbackCode =
    expectedValue === "-10" && metrics.headProtectionDetected !== true
      ? "LOWER_BODY_AND_PROTECT_HEAD"
      : "CONTRACT_MORE";

  return criterion({
    id: "value-contraction",
    label: "Body contraction matches the winter value",
    importance: "essential",
    value: metrics.compactnessScore,
    passed: isInMovementRange(
      metrics.compactnessScore,
      reference.contractionRange,
    ),
    expectedRange: `${reference.contractionRange.min}..${reference.contractionRange.max}`,
    feedbackCode: failureDirection === "tooHigh" ? tooHighCode : tooLowCode,
  });
};

const kneeContractionCriterion = (
  metrics: WinterRecognitionMetrics,
  expectedValue: WinterValue,
) => {
  const reference = WINTER_MOVEMENT_REFERENCE[expectedValue];
  const failureDirection = getRangeFailureDirection(
    metrics.averageKneeAngle,
    reference.kneeAngleRange,
  );

  return criterion({
    id: "knee-contraction",
    label: "Knees match the contraction depth",
    importance: "supporting",
    value: metrics.averageKneeAngle,
    passed:
      expectedValue === "100"
        ? metrics.averageKneeAngle === null ||
          metrics.averageKneeAngle >=
            winterMovementConfig.thresholds.uprightKneeAngleMin
        : isInMovementRange(metrics.averageKneeAngle, reference.kneeAngleRange),
    expectedRange: `${reference.kneeAngleRange.min}..${reference.kneeAngleRange.max}`,
    feedbackCode:
      failureDirection === "tooLow" ? "STAY_HIGHER" : "BEND_KNEES_MORE",
  });
};

const keepArmsCrossedCriterion = (metrics: WinterRecognitionMetrics) =>
  criterion({
    id: "keep-arms-crossed",
    label: "Arms remain crossed during contraction",
    importance: "supporting",
    value: metrics.selfHugDetected,
    passed: metrics.selfHugDetected !== false,
    expectedRange: "crossed or compact",
    feedbackCode: "KEEP_ARMS_CROSSED",
  });

const headProtectionCriterion = (metrics: WinterRecognitionMetrics) =>
  criterion({
    id: "head-protection",
    label: "Hands protect the head in extreme cold",
    importance: "essential",
    value: metrics.headProtectionDetected,
    passed: metrics.headProtectionDetected === true,
    expectedRange: "hands near or above head",
    feedbackCode:
      metrics.compactnessScore !== null &&
      metrics.compactnessScore <
        WINTER_MOVEMENT_REFERENCE["-10"].contractionRange.min
        ? "LOWER_BODY_AND_PROTECT_HEAD"
        : "PROTECT_HEAD",
  });

const returnUprightCriterion = (metrics: WinterRecognitionMetrics) =>
  criterion({
    id: "return-upright",
    label: "Body returns upright",
    importance: "essential",
    value: metrics.returnToUprightDetected,
    passed: metrics.returnToUprightDetected === true,
    expectedRange: `drop <= ${winterMovementConfig.thresholds.returnDropMax}`,
    feedbackCode: "RETURN_TO_UPRIGHT",
  });

const armsReleasedCriterion = (metrics: WinterRecognitionMetrics) =>
  criterion({
    id: "arms-released",
    label: "Arms release from the self-hug",
    importance: "supporting",
    value: metrics.armsReleased,
    passed: metrics.armsReleased !== false,
    expectedRange: `hands apart >= ${winterMovementConfig.thresholds.returnHandDistanceMin}`,
    feedbackCode: "LOWER_ARMS",
  });

const stableFeetCriterion = (metrics: WinterRecognitionMetrics) =>
  criterion({
    id: "feet-stable",
    label: "Feet stay stable",
    importance: "supporting",
    value: metrics.feetStable,
    passed: metrics.feetStable !== false,
    expectedRange: "no side step",
    feedbackCode: "LOWER_BODY_NOT_VISIBLE",
  });

export const buildWinterBeatCriteria = (
  beat: WinterBeat,
  metrics: WinterRecognitionMetrics,
  expectedValue: WinterValue,
) => {
  if (beat === 1) {
    return [
      openArmsCriterion(metrics),
      shoulderHeightCriterion(metrics),
      straightArmsCriterion(metrics),
      stableFeetCriterion(metrics),
    ];
  }

  if (beat === 2) {
    return [
      selfHugCriterion(metrics),
      oppositeShoulderCriterion(metrics),
      uprightCriterion(metrics),
      stableFeetCriterion(metrics),
    ];
  }

  if (beat === 3) {
    return [
      expectedValue === "-10"
        ? keepArmsCrossedCriterion(metrics)
        : selfHugCriterion(metrics, "supporting"),
      contractionCriterion(metrics, expectedValue),
      kneeContractionCriterion(metrics, expectedValue),
      ...(expectedValue === "-10" ? [headProtectionCriterion(metrics)] : []),
      stableFeetCriterion(metrics),
    ];
  }

  return expectedValue === "100"
    ? [armsReleasedCriterion(metrics), stableFeetCriterion(metrics)]
    : [
        returnUprightCriterion(metrics),
        armsReleasedCriterion(metrics),
        stableFeetCriterion(metrics),
      ];
};

export const getWinterCriteriaScore = (criteria: WinterCriterionResult[]) =>
  getWeightedCriteriaScore(criteria);

export const getWinterBeatFeedbackCode = (
  criteria: WinterCriterionResult[],
): WinterFeedbackCode | undefined => {
  const notEvaluable = criteria.find(
    (item) => item.importance === "essential" && item.status === "notEvaluable",
  );

  if (notEvaluable) return "UPPER_BODY_NOT_VISIBLE";

  const priority = [
    "open-arms-wide",
    "hands-shoulder-height",
    "arms-straight",
    "self-hug-crossed",
    "opposite-shoulders",
    "value-contraction",
    "head-protection",
    "knee-contraction",
    "keep-arms-crossed",
    "return-upright",
    "arms-released",
    "feet-stable",
  ];
  const failedCriterion = getHighestPriorityFailedCriterion(
    criteria.filter(
      (item) => item.importance === "essential" || item.feedbackCode,
    ),
    priority,
  );

  if (failedCriterion) return failedCriterion.feedbackCode ?? "TRY_AGAIN";

  return criteria.find(
    (item) => item.importance === "supporting" && item.status === "failed",
  )?.feedbackCode;
};
