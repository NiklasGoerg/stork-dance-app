import { getWeightedCriteriaScore } from "~/utils/movement/core/criteria";
import { isInMovementRange } from "~/utils/movement/core/range";
import {
  SPRING_MOVEMENT_REFERENCE,
  springMovementConfig,
} from "~/utils/movement/acts/climate/spring/springReference";
import type {
  SpringBeat,
  SpringCriterionImportance,
  SpringCriterionResult,
  SpringFeedbackCode,
  SpringRecognitionMetrics,
  SpringValue,
} from "~/utils/movement/acts/climate/spring/springTypes";

const roundDebug = (value: number | null) =>
  value === null || !Number.isFinite(value) ? "n/a" : Number(value.toFixed(2));

const criterion = ({
  id,
  label,
  importance,
  value,
  passed,
  expectedRange,
  feedbackCode,
}: {
  id: string;
  label: string;
  importance: SpringCriterionImportance;
  value: number | string | boolean | null | undefined;
  passed: boolean;
  expectedRange?: string;
  feedbackCode?: SpringFeedbackCode;
}): SpringCriterionResult => {
  const evaluable =
    value !== null && value !== undefined && value !== "unknown";

  return {
    id,
    label,
    status: !evaluable ? "notEvaluable" : passed ? "passed" : "failed",
    passed: evaluable && passed,
    score: evaluable && passed ? 1 : 0,
    importance,
    debugValue: typeof value === "number" ? roundDebug(value) : String(value),
    expectedRange,
    feedbackCode: evaluable && !passed ? feedbackCode : undefined,
  };
};

const kneeCriterion = (metrics: SpringRecognitionMetrics) =>
  criterion({
    id: "knee-pattern",
    label: "Supporting knee follows the alternating bloom pattern",
    importance: "supporting",
    value: metrics.detectedKneeSide,
    passed:
      metrics.detectedKneeSide === "unknown" ||
      metrics.detectedKneeSide === "none" ||
      metrics.detectedKneeSide === metrics.expectedKneeSide,
    expectedRange: metrics.expectedKneeSide,
    feedbackCode: "LIFT_OTHER_KNEE",
  });

const lowHandsCriterion = (
  metrics: SpringRecognitionMetrics,
  id = "hands-start-low",
) =>
  criterion({
    id,
    label: "Hands are low before the bloom",
    importance: "essential",
    value: metrics.lowerHandHeight,
    passed:
      metrics.lowerHandHeight !== null &&
      metrics.lowerHandHeight <= springMovementConfig.thresholds.handsLowMax,
    expectedRange: `<= ${springMovementConfig.thresholds.handsLowMax}`,
    feedbackCode: "START_HANDS_LOW",
  });

const closeToBodyCriterion = (metrics: SpringRecognitionMetrics) =>
  criterion({
    id: "hands-close-to-body",
    label: "Hands stay close to the body at the start",
    importance: "essential",
    value: metrics.normalizedHandDistance,
    passed:
      metrics.normalizedHandDistance !== null &&
      metrics.normalizedHandDistance <=
        springMovementConfig.thresholds.handsCloseToBodyMax &&
      (metrics.handCenterXOffset === null ||
        Math.abs(metrics.handCenterXOffset) <=
          springMovementConfig.thresholds.centerMaxOffset),
    expectedRange: `distance <= ${springMovementConfig.thresholds.handsCloseToBodyMax}`,
    feedbackCode: "KEEP_HANDS_CLOSE_TO_BODY",
  });

const returnCriterion = (
  metrics: SpringRecognitionMetrics,
  expectedValue: SpringValue,
) => {
  const returnHeightMin =
    expectedValue === "20" || expectedValue === "30"
      ? 0.18
      : springMovementConfig.thresholds.returnHeightMin;
  const returnHeightMax = springMovementConfig.thresholds.returnHeightMax;

  return criterion({
    id: "hands-return-prayer",
    label: "Hands return together in front of the chest",
    importance: "essential",
    value: metrics.lowerHandHeight,
    passed:
      metrics.lowerHandHeight !== null &&
      metrics.lowerHandHeight >= returnHeightMin &&
      metrics.lowerHandHeight <= returnHeightMax &&
      metrics.handsGathered === true,
    expectedRange: `${returnHeightMin}..${returnHeightMax}, gathered`,
    feedbackCode: "LOWER_AND_RETURN",
  });
};

const maxHeightCriterion = (
  metrics: SpringRecognitionMetrics,
  expectedValue: SpringValue,
) => {
  const reference = SPRING_MOVEMENT_REFERENCE[expectedValue];
  const measuredHandHeight =
    expectedValue === "100"
      ? metrics.lowerHandHeight
      : metrics.averageHandHeight;
  const isTooHigh =
    measuredHandHeight !== null &&
    Number.isFinite(reference.handHeightRange.max) &&
    measuredHandHeight > reference.handHeightRange.max;

  return criterion({
    id: "value-hand-height",
    label: "Bloom reaches the expected hand height",
    importance: "essential",
    value: measuredHandHeight,
    passed: isInMovementRange(measuredHandHeight, reference.handHeightRange),
    expectedRange: `${reference.handHeightRange.min}..${
      Number.isFinite(reference.handHeightRange.max)
        ? reference.handHeightRange.max
        : "open"
    }`,
    feedbackCode: isTooHigh ? "KEEP_BLOOM_LOWER" : "OPEN_ARMS_HIGHER",
  });
};

const openHandsCriterion = (metrics: SpringRecognitionMetrics) =>
  criterion({
    id: "hands-open-side",
    label: "Hands open to the sides",
    importance: "essential",
    value: metrics.handOpeningWidth,
    passed:
      metrics.handOpeningWidth !== null &&
      metrics.handOpeningWidth >= springMovementConfig.thresholds.handsOpenMin,
    expectedRange: `>= ${springMovementConfig.thresholds.handsOpenMin}`,
    feedbackCode: "OPEN_ARMS_TO_BEGIN",
  });

const sideShoulderOpeningCriterion = (metrics: SpringRecognitionMetrics) => {
  const minOutside = springMovementConfig.thresholds.wristOutsideShoulderMin;
  const outsideSignals = [
    metrics.leftWristOutsideShoulder,
    metrics.rightWristOutsideShoulder,
  ];
  const minimumOutsideSignal =
    outsideSignals[0] !== null && outsideSignals[1] !== null
      ? Math.min(outsideSignals[0], outsideSignals[1])
      : null;

  return criterion({
    id: "wrists-outside-shoulders",
    label: "Hands open outside their same-side shoulders",
    importance: "essential",
    value: minimumOutsideSignal,
    passed: minimumOutsideSignal !== null && minimumOutsideSignal >= minOutside,
    expectedRange: `>= ${minOutside}`,
    feedbackCode: "OPEN_ARMS_TO_BEGIN",
  });
};

const armsExtendedCriterion = (
  metrics: SpringRecognitionMetrics,
  importance: SpringCriterionImportance = "supporting",
) =>
  criterion({
    id: "arms-extended",
    label: "Elbows stay extended through the bloom",
    importance,
    value: metrics.averageElbowAngle,
    passed:
      metrics.averageElbowAngle !== null &&
      metrics.averageElbowAngle >=
        springMovementConfig.thresholds.elbowExtendedMin,
    expectedRange: `>= ${springMovementConfig.thresholds.elbowExtendedMin}`,
    feedbackCode: "OPEN_ARMS_TO_BEGIN",
  });

const endpointArmOpeningCriterion = (
  metrics: SpringRecognitionMetrics,
  expectedValue: SpringValue,
) => {
  const reference = SPRING_MOVEMENT_REFERENCE[expectedValue];

  if (!reference.handOpeningMin) return null;

  const handOpeningPassed =
    metrics.handOpeningWidth !== null &&
    metrics.handOpeningWidth >= reference.handOpeningMin;
  const wristOutsidePassed =
    !reference.wristOutsideShoulderMin ||
    (metrics.leftWristOutsideShoulder !== null &&
      metrics.rightWristOutsideShoulder !== null &&
      Math.min(
        metrics.leftWristOutsideShoulder,
        metrics.rightWristOutsideShoulder,
      ) >= reference.wristOutsideShoulderMin);

  return criterion({
    id: "endpoint-arm-opening",
    label: "Hands move away from the body for the value endpoint",
    importance: expectedValue === "40" ? "essential" : "supporting",
    value: metrics.handOpeningWidth,
    passed: handOpeningPassed && wristOutsidePassed,
    expectedRange: `opening >= ${reference.handOpeningMin}${
      reference.wristOutsideShoulderMin
        ? `, wrist outside >= ${reference.wristOutsideShoulderMin}`
        : ""
    }`,
    feedbackCode: "OPEN_ARMS_TO_BEGIN",
  });
};

const shoulderChestHeightCriterion = (metrics: SpringRecognitionMetrics) =>
  criterion({
    id: "beat2-shoulder-chest-height",
    label: "Hands are at chest or shoulder height",
    importance: "essential",
    value: metrics.lowerHandHeight,
    passed:
      metrics.lowerHandHeight !== null &&
      metrics.lowerHandHeight >= 0.58 &&
      metrics.lowerHandHeight <= 1.12,
    expectedRange: "0.58..1.12",
    feedbackCode:
      metrics.lowerHandHeight !== null && metrics.lowerHandHeight > 1.12
        ? "KEEP_BLOOM_LOWER"
        : "OPEN_ARMS_HIGHER",
  });

const overheadCriterion = (metrics: SpringRecognitionMetrics) =>
  criterion({
    id: "hands-overhead",
    label: "Hands meet above the head",
    importance: "essential",
    value: metrics.overheadBloom,
    passed: metrics.overheadBloom === true,
    expectedRange: "hands above head and gathered",
    feedbackCode: "REACH_ABOVE_HEAD",
  });

const gatheredCriterion = (metrics: SpringRecognitionMetrics) =>
  criterion({
    id: "hands-gathered-front",
    label: "Hands gather in front of the body",
    importance: "essential",
    value: metrics.handsGathered,
    passed: metrics.handsGathered === true,
    expectedRange: "hands close and centered",
    feedbackCode: "GATHER_HANDS_IN_FRONT",
  });

export const buildSpringBeatCriteria = (
  beat: SpringBeat,
  metrics: SpringRecognitionMetrics,
  expectedValue: SpringValue,
) => {
  if (beat === 1) {
    return [
      lowHandsCriterion(metrics),
      closeToBodyCriterion(metrics),
      armsExtendedCriterion(metrics),
      kneeCriterion(metrics),
    ];
  }

  if (beat === 2) {
    return expectedValue === "100"
      ? [
          shoulderChestHeightCriterion(metrics),
          openHandsCriterion(metrics),
          sideShoulderOpeningCriterion(metrics),
          armsExtendedCriterion(metrics),
          kneeCriterion(metrics),
        ]
      : [
          maxHeightCriterion(metrics, expectedValue),
          endpointArmOpeningCriterion(metrics, expectedValue),
          armsExtendedCriterion(metrics),
          kneeCriterion(metrics),
        ].filter((item): item is SpringCriterionResult => item !== null);
  }

  if (beat === 3) {
    return expectedValue === "100"
      ? [
          overheadCriterion(metrics),
          gatheredCriterion(metrics),
          armsExtendedCriterion(metrics),
        ]
      : [
          maxHeightCriterion(metrics, expectedValue),
          endpointArmOpeningCriterion(metrics, expectedValue),
          kneeCriterion(metrics),
          armsExtendedCriterion(metrics),
        ].filter((item): item is SpringCriterionResult => item !== null);
  }

  return [returnCriterion(metrics, expectedValue), kneeCriterion(metrics)];
};

export const getSpringCriteriaScore = (criteria: SpringCriterionResult[]) =>
  getWeightedCriteriaScore(criteria);

export const getSpringBeatFeedbackCode = (
  criteria: SpringCriterionResult[],
): SpringFeedbackCode | undefined => {
  const notEvaluable = criteria.find(
    (item) => item.importance === "essential" && item.status === "notEvaluable",
  );

  if (notEvaluable) return "FULL_BODY_NOT_VISIBLE";

  const priority = [
    "hands-start-low",
    "hands-close-to-body",
    "beat2-shoulder-chest-height",
    "value-hand-height",
    "endpoint-arm-opening",
    "hands-overhead",
    "hands-gathered-front",
    "hands-return-prayer",
    "knee-pattern",
    "arms-extended",
  ];
  const failedCriterion = priority
    .map((id) =>
      criteria.find(
        (item) =>
          item.id === id &&
          item.status === "failed" &&
          (item.importance === "essential" || item.feedbackCode),
      ),
    )
    .find((item): item is SpringCriterionResult => Boolean(item));

  if (failedCriterion) return failedCriterion.feedbackCode ?? "TRY_AGAIN";

  return criteria.find(
    (item) => item.importance === "supporting" && item.status === "failed",
  )?.feedbackCode;
};
