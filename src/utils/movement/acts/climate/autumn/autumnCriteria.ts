import { getWeightedCriteriaScore } from "~/utils/movement/core/criteria";
import { evaluateFeetClose } from "~/utils/movement/core/predicates/stancePoses";
import { isInMovementRange } from "~/utils/movement/core/range";
import {
  AUTUMN_MOVEMENT_REFERENCE,
  autumnMovementConfig,
} from "~/utils/movement/acts/climate/autumn/autumnReference";
import {
  createAct5SeasonCriterionFactory,
  getHighestPriorityFailedCriterion,
} from "~/features/act5/movements/criteria";
import type {
  AutumnBeat,
  AutumnCriterionImportance,
  AutumnCriterionResult,
  AutumnDirection,
  AutumnFeedbackCode,
  AutumnRecognitionMetrics,
  AutumnValueClass,
} from "~/utils/movement/acts/climate/autumn/autumnTypes";

type BeatContext = {
  expectedDirection: AutumnDirection;
  expectedValueClass: AutumnValueClass;
};

const criterion = createAct5SeasonCriterionFactory<
  AutumnCriterionImportance,
  AutumnFeedbackCode,
  AutumnCriterionResult
>({
  nullishDebugValue: "omit",
  stringifyNonNumericDebugValue: false,
});

const getHeightCriterion = (metrics: AutumnRecognitionMetrics) =>
  criterion({
    id: "hands-chest-shoulder-height",
    label: "Hands stay at chest or shoulder height",
    importance: "supporting",
    value: metrics.handCenterYFromShoulders,
    passed:
      metrics.handCenterYFromShoulders !== null &&
      metrics.handCenterYFromShoulders >=
        autumnMovementConfig.thresholds.chestMinY &&
      metrics.handCenterYFromShoulders <=
        autumnMovementConfig.thresholds.chestMaxY,
    expectedRange: `${autumnMovementConfig.thresholds.chestMinY}..${autumnMovementConfig.thresholds.chestMaxY}`,
    feedbackCode: "KEEP_HANDS_AT_CHEST_HEIGHT",
  });

const destinationSignForDirection = (direction: AutumnDirection) =>
  direction === "leftToRight" ? 1 : -1;

const extensionOrder = {
  unknown: -1,
  compact: 0,
  forward: 1,
  large: 2,
  maximum: 3,
};

const hasAtLeastExtension = (
  actual: AutumnRecognitionMetrics["outerArmExtensionClass"],
  expected: AutumnRecognitionMetrics["outerArmExtensionClass"],
) => extensionOrder[actual] >= extensionOrder[expected];

const usesDetailedArmShapeCriteria = (valueClass: AutumnValueClass) =>
  valueClass === "50" || valueClass === "80" || valueClass === "100";

const AUTUMN_25_RELATIVE_PROGRESS_MIN = 0.012;
const AUTUMN_25_OUTER_WRIST_TO_CENTER_MIN = 0.16;
const AUTUMN_25_BEAT2_PROGRESS_MIN = 0.012;

const endpointRegionCriterion = (
  metrics: AutumnRecognitionMetrics,
  context: BeatContext,
) => {
  const reference = AUTUMN_MOVEMENT_REFERENCE[context.expectedValueClass];
  const isAutumn25 = context.expectedValueClass === "25";
  const progress = metrics.normalizedProgress;
  const normalizedProgress = metrics.normalizedProgress;
  const isTooShort =
    !isAutumn25 && progress !== null && progress < reference.progressRange.min;
  const upperProgressForRange = isAutumn25 ? normalizedProgress : progress;
  const isTooFar =
    upperProgressForRange !== null &&
    Number.isFinite(reference.progressRange.max) &&
    upperProgressForRange > reference.progressRange.max;
  const passed = isAutumn25
    ? progress !== null &&
      normalizedProgress !== null &&
      progress >= reference.progressRange.min &&
      normalizedProgress <= reference.progressRange.max
    : isInMovementRange(progress, reference.progressRange);

  return criterion({
    id: "endpoint-value-range",
    label: "Endpoint lands in the expected value range",
    importance: "essential",
    value: progress,
    passed,
    expectedRange: isAutumn25
      ? `global <= ${reference.progressRange.max}`
      : `${reference.progressRange.min}..${
          Number.isFinite(reference.progressRange.max)
            ? reference.progressRange.max
            : "open"
        }`,
    feedbackCode: isTooShort
      ? isAutumn25
        ? "INSUFFICIENT_PROGRESS"
        : "ENDPOINT_TOO_SHORT"
      : isTooFar || metrics.endpointErrorKind === "tooFar"
        ? "ENDPOINT_TOO_FAR"
        : reference.endpointRegion === "farDestinationSide"
          ? "END_AT_FAR_DESTINATION_SIDE"
          : reference.endpointRegion === "destinationSide"
            ? "END_AT_DESTINATION_SIDE"
            : reference.endpointRegion === "centerFront"
              ? "END_AT_CENTER"
              : reference.endpointRegion === "nearCenterStartSide"
                ? "END_BEFORE_CENTER"
                : "END_AT_START_SIDE_DIAGONAL",
  });
};

const endpointProgressCriterion = (
  metrics: AutumnRecognitionMetrics,
  context: BeatContext,
) => {
  const isAutumn25 = context.expectedValueClass === "25";
  const minimumProgress = isAutumn25
    ? AUTUMN_25_RELATIVE_PROGRESS_MIN
    : autumnMovementConfig.thresholds.beat3ProgressMin;
  const autumn25OuterWristPassed =
    isAutumn25 &&
    metrics.outerWristProgressToCenter !== null &&
    metrics.outerWristProgressToCenter >= AUTUMN_25_OUTER_WRIST_TO_CENTER_MIN;
  const visibleProgressPassed =
    metrics.progressFromStartingPose !== null &&
    metrics.progressFromStartingPose >= minimumProgress;

  return criterion({
    id: "progress-from-start",
    label: "Movement visibly leaves the starting pose",
    importance: "essential",
    value: isAutumn25
      ? (metrics.outerWristProgressToCenter ?? metrics.progressFromStartingPose)
      : metrics.progressFromStartingPose,
    passed: isAutumn25
      ? autumn25OuterWristPassed || visibleProgressPassed
      : visibleProgressPassed,
    expectedRange: isAutumn25
      ? `outer wrist toward center >= ${AUTUMN_25_OUTER_WRIST_TO_CENTER_MIN} or relative >= ${minimumProgress}`
      : `>= ${minimumProgress}`,
    feedbackCode: "INSUFFICIENT_PROGRESS",
  });
};

const outerArmExtensionCriterion = (
  metrics: AutumnRecognitionMetrics,
  context: BeatContext,
) => {
  const reference = AUTUMN_MOVEMENT_REFERENCE[context.expectedValueClass];

  return criterion({
    id: "outer-arm-extension",
    label: "Outer arm reaches toward the endpoint",
    importance:
      context.expectedValueClass === "100" ||
      context.expectedValueClass === "80"
        ? "essential"
        : "supporting",
    value: metrics.outerArmExtensionClass,
    passed: hasAtLeastExtension(
      metrics.outerArmExtensionClass,
      reference.outerArmExtension,
    ),
    expectedRange: reference.outerArmExtension,
    feedbackCode: "EXTEND_OUTER_ARM",
  });
};

const outerWristCriterion = (
  metrics: AutumnRecognitionMetrics,
  context: BeatContext,
) => {
  const reference = AUTUMN_MOVEMENT_REFERENCE[context.expectedValueClass];
  const minimum = reference.requireOuterWristBeyondShoulder
    ? autumnMovementConfig.thresholds.outerWristBeyondShoulderMin
    : context.expectedValueClass === "80"
      ? autumnMovementConfig.thresholds.outerWristAutumn80Min
      : autumnMovementConfig.thresholds.outerWristNearShoulderMin;

  return criterion({
    id: "outer-wrist-endpoint-side",
    label: "Outer wrist reaches toward the endpoint side",
    importance:
      context.expectedValueClass === "100" ||
      context.expectedValueClass === "80"
        ? "essential"
        : "supporting",
    value: metrics.outerWristRelativeToOuterShoulder,
    passed:
      metrics.outerWristRelativeToOuterShoulder !== null &&
      metrics.outerWristRelativeToOuterShoulder >= minimum,
    expectedRange: `>= ${minimum}`,
    feedbackCode:
      context.expectedValueClass === "25" || context.expectedValueClass === "40"
        ? undefined
        : "EXTEND_OUTER_ARM",
  });
};

const armDirectionCriteria = (
  metrics: AutumnRecognitionMetrics,
  context: BeatContext,
) => {
  const destinationSign = destinationSignForDirection(
    context.expectedDirection,
  );
  const outerDirectionTowardEndpoint =
    metrics.outerArmDirectionX === null
      ? null
      : metrics.outerArmDirectionX * destinationSign;
  const innerForearmTowardEndpoint =
    metrics.innerForearmDirectionX === null
      ? null
      : metrics.innerForearmDirectionX * destinationSign;

  return [
    criterion({
      id: "outer-arm-oriented-endpoint",
      label: "Outer arm points toward the endpoint",
      importance: "supporting",
      value: outerDirectionTowardEndpoint,
      passed:
        outerDirectionTowardEndpoint !== null &&
        outerDirectionTowardEndpoint >= 0.1,
      expectedRange: "toward endpoint",
      feedbackCode: "EXTEND_OUTER_ARM",
    }),
    criterion({
      id: "inner-forearm-oriented-endpoint",
      label: "Inner forearm follows the endpoint direction",
      importance:
        context.expectedValueClass === "100" ||
        context.expectedValueClass === "80"
          ? "essential"
          : "supporting",
      value: innerForearmTowardEndpoint,
      passed:
        innerForearmTowardEndpoint !== null &&
        innerForearmTowardEndpoint >=
          autumnMovementConfig.thresholds.innerForearmDestinationMin,
      expectedRange: `>= ${autumnMovementConfig.thresholds.innerForearmDestinationMin}`,
      feedbackCode: "ALIGN_BOTH_ARMS",
    }),
    criterion({
      id: "shared-arm-direction",
      label: "Both arms share the endpoint direction",
      importance: "supporting",
      value: metrics.armDirectionSimilarity,
      passed:
        metrics.armDirectionSimilarity !== null &&
        metrics.armDirectionSimilarity >=
          autumnMovementConfig.thresholds.armDirectionSimilarityMin,
      expectedRange: `>= ${autumnMovementConfig.thresholds.armDirectionSimilarityMin}`,
      feedbackCode: "ALIGN_BOTH_ARMS",
    }),
  ];
};

const torsoFacingCriterion = (metrics: AutumnRecognitionMetrics) =>
  criterion({
    id: "torso-facing-forward",
    label: "Chest stays mostly facing forward",
    importance: "supporting",
    value: metrics.torsoFacingScore,
    passed:
      metrics.torsoFacingScore !== null &&
      metrics.torsoFacingScore >=
        autumnMovementConfig.thresholds.torsoFacingMinScore,
    expectedRange: `>= ${autumnMovementConfig.thresholds.torsoFacingMinScore}`,
    feedbackCode: "KEEP_CHEST_FORWARD",
  });

export const buildAutumnBeatCriteria = (
  beat: AutumnBeat,
  metrics: AutumnRecognitionMetrics,
  context: BeatContext,
) => {
  const thresholds = autumnMovementConfig.thresholds;
  const reference = AUTUMN_MOVEMENT_REFERENCE[context.expectedValueClass];
  const startSidePassed = metrics.startSidePassed === true;

  if (beat === 1) {
    return [
      criterion({
        id: "hands-start-side",
        label: "Hands start on the correct side",
        importance: "essential",
        value: metrics.handCenterXOffset,
        passed: startSidePassed,
        expectedRange:
          context.expectedDirection === "leftToRight"
            ? `<= -${thresholds.startSideMinOffset}`
            : `>= ${thresholds.startSideMinOffset}`,
        feedbackCode:
          context.expectedDirection === "leftToRight"
            ? "START_LEFT"
            : "START_RIGHT",
      }),
      getHeightCriterion(metrics),
      criterion({
        id: "constant-radius",
        label: "Hands stay extended from torso",
        importance: "supporting",
        value: metrics.handRadiusFromTorso,
        passed: isInMovementRange(metrics.handRadiusFromTorso, {
          min: thresholds.radiusMin,
          max: thresholds.radiusMax,
        }),
        expectedRange: `${thresholds.radiusMin}..${thresholds.radiusMax}`,
      }),
    ];
  }

  if (beat === 2) {
    const beat2ProgressMin =
      context.expectedValueClass === "25"
        ? AUTUMN_25_BEAT2_PROGRESS_MIN
        : thresholds.beat2ProgressMin;

    return [
      getHeightCriterion(metrics),
      criterion({
        id: "hands-left-start-side",
        label: "Hands move away from the starting side",
        importance: "supporting",
        value: metrics.progressFromStartingPose,
        passed:
          metrics.progressFromStartingPose !== null &&
          metrics.progressFromStartingPose >= beat2ProgressMin,
        expectedRange: `>= ${beat2ProgressMin}`,
        feedbackCode: "INSUFFICIENT_PROGRESS",
      }),
    ];
  }

  if (beat === 3) {
    const detailedArmShapeCriteria = usesDetailedArmShapeCriteria(
      context.expectedValueClass,
    )
      ? [
          outerArmExtensionCriterion(metrics, context),
          ...armDirectionCriteria(metrics, context),
        ]
      : [];

    return [
      endpointRegionCriterion(metrics, context),
      ...(reference.requireProgressFromBeat1
        ? [endpointProgressCriterion(metrics, context)]
        : []),
      outerWristCriterion(metrics, context),
      ...detailedArmShapeCriteria,
      getHeightCriterion(metrics),
      context.expectedValueClass === "50"
        ? criterion({
            id: "center-hands-coherent",
            label: "Hands stay coherent in front",
            importance: "supporting",
            value: metrics.normalizedHandDistance,
            passed:
              metrics.normalizedHandDistance !== null &&
              metrics.normalizedHandDistance <= thresholds.handsTogetherMax,
            expectedRange: `<= ${thresholds.handsTogetherMax}`,
            feedbackCode: "END_AT_CENTER",
          })
        : null,
      torsoFacingCriterion(metrics),
      criterion({
        id: "constant-radius",
        label: "Movement radius stays stable",
        importance: "supporting",
        value: metrics.handRadiusFromTorso,
        passed: isInMovementRange(metrics.handRadiusFromTorso, {
          min: thresholds.radiusMin,
          max: thresholds.radiusMax,
        }),
        expectedRange: `${thresholds.radiusMin}..${thresholds.radiusMax}`,
      }),
    ].filter((item): item is AutumnCriterionResult => item !== null);
  }

  return [
    criterion({
      id: "hands-return-center",
      label: "Hands return toward chest center",
      importance: "essential",
      value: metrics.handCenterXOffset,
      passed:
        metrics.handCenterXOffset !== null &&
        Math.abs(metrics.handCenterXOffset) <= thresholds.centerMaxOffset,
      expectedRange: `abs <= ${thresholds.centerMaxOffset}`,
      feedbackCode: "RETURN_HANDS_TO_CENTER",
    }),
    getHeightCriterion(metrics),
    (() => {
      const feetClose = evaluateFeetClose(metrics, {
        maxNormalizedAnkleDistance: thresholds.closedFeetMax,
      });

      return criterion({
        id: "feet-close",
        label: "Feet return close together",
        importance: "supporting",
        value: feetClose.metrics.normalizedAnkleDistance,
        passed: feetClose.passed,
        expectedRange: `<= ${thresholds.closedFeetMax}`,
        feedbackCode: "RETURN_FEET_TOGETHER",
      });
    })(),
  ];
};

export const getAutumnCriteriaScore = (criteria: AutumnCriterionResult[]) =>
  getWeightedCriteriaScore(criteria);

export const getAutumnBeatFeedbackCode = (
  criteria: AutumnCriterionResult[],
): AutumnFeedbackCode | undefined => {
  const notEvaluable = criteria.find(
    (item) => item.importance === "essential" && item.status === "notEvaluable",
  );

  if (notEvaluable) return "FULL_BODY_NOT_VISIBLE";

  const priority = [
    "hands-start-side",
    "progress-from-start",
    "endpoint-value-range",
    "outer-arm-extension",
    "outer-wrist-endpoint-side",
    "inner-forearm-oriented-endpoint",
    "shared-arm-direction",
    "hands-chest-shoulder-height",
    "hands-return-center",
    "feet-close",
    "torso-facing-forward",
  ];
  const failedCriterion = getHighestPriorityFailedCriterion(
    criteria.filter(
      (item) => item.importance === "essential" || item.feedbackCode,
    ),
    priority,
  );

  if (failedCriterion) return failedCriterion.feedbackCode ?? "TRY_AGAIN";

  const failedEssential = criteria.find(
    (item) => item.importance === "essential" && item.status === "failed",
  );

  if (failedEssential) return failedEssential.feedbackCode ?? "TRY_AGAIN";

  return criteria.find(
    (item) => item.importance === "supporting" && item.status === "failed",
  )?.feedbackCode;
};
