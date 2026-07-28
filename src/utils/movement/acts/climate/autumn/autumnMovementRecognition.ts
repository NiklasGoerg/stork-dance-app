import type { PoseLandmarkLike } from "~/types/pose";
import {
  getBeatPassState,
  getWeightedBeatEvaluationScore,
} from "~/utils/movement/core/criteria";
import { extractNormalizedBodyMetrics } from "~/utils/movement/core/bodyMetrics";
import {
  buildAutumnBeatCriteria,
  getAutumnBeatFeedbackCode,
  getAutumnCriteriaScore,
} from "~/utils/movement/acts/climate/autumn/autumnCriteria";
import {
  AUTUMN_BEAT_WEIGHTS,
  AUTUMN_ENDPOINT_ZONES,
  AUTUMN_MOVEMENT_REFERENCE,
  autumnMovementConfig,
} from "~/utils/movement/acts/climate/autumn/autumnReference";
import type {
  AutumnBeat,
  AutumnBeatEvaluation,
  AutumnArmExtensionClass,
  AutumnDirection,
  AutumnDirectionFailureReason,
  AutumnDirectionResult,
  AutumnEndpointErrorKind,
  AutumnEndpointRegion,
  AutumnRecognitionMetrics,
  AutumnRecognitionResultState,
  AutumnSequenceEvaluation,
  AutumnValueClass,
} from "~/utils/movement/acts/climate/autumn/autumnTypes";
import {
  calculateJointAngle,
  distance2D,
  toPosePoint,
  type PosePoint,
} from "~/utils/pose/poseGeometry";
import { POSE_LANDMARK } from "~/utils/pose/poseLandmarks";

export * from "~/utils/movement/acts/climate/autumn/autumnReference";
export * from "~/utils/movement/acts/climate/autumn/autumnTypes";

type BeatContext = {
  expectedDirection?: AutumnDirection;
  expectedValueClass?: AutumnValueClass;
  startReference?: AutumnStartReference | null;
};

export type AutumnStartReference = {
  handCenterXOffset: number | null;
  outerWristXOffset: number | null;
  normalizedProgress: number | null;
  detectedStartSide: AutumnRecognitionMetrics["detectedStartSide"];
  startSidePassed: boolean;
};

const getExpectedDirectionForRepetition = (
  repetitionIndex: number | null | undefined,
): AutumnDirection =>
  repetitionIndex === 0 || repetitionIndex === 1
    ? "leftToRight"
    : "rightToLeft";

const destinationSignForDirection = (direction: AutumnDirection) =>
  direction === "leftToRight" ? 1 : -1;

const getExpectedStartSide = (
  direction: AutumnDirection,
): AutumnRecognitionMetrics["expectedStartSide"] =>
  direction === "leftToRight" ? "left" : "right";

const getDetectedSide = (
  handCenterXOffset: number | null,
): AutumnRecognitionMetrics["detectedStartSide"] => {
  if (handCenterXOffset === null || !Number.isFinite(handCenterXOffset)) {
    return "unknown";
  }

  if (
    Math.abs(handCenterXOffset) <
    autumnMovementConfig.thresholds.startSideMinOffset
  ) {
    return "center";
  }

  return handCenterXOffset < 0 ? "left" : "right";
};

const getStartSidePassed = (
  detectedStartSide: AutumnRecognitionMetrics["detectedStartSide"],
  expectedStartSide: AutumnRecognitionMetrics["expectedStartSide"],
) =>
  (expectedStartSide === "left" || expectedStartSide === "right") &&
  detectedStartSide === expectedStartSide;

const getSignedProgressFromBeat1 = ({
  currentHandCenterXOffset,
  startReference,
  direction,
}: {
  currentHandCenterXOffset: number | null;
  startReference?: AutumnStartReference | null;
  direction: AutumnDirection;
}) => {
  if (
    currentHandCenterXOffset === null ||
    startReference?.handCenterXOffset === null ||
    startReference?.handCenterXOffset === undefined ||
    !startReference.startSidePassed
  ) {
    return null;
  }

  const destinationSign = destinationSignForDirection(direction);

  return (
    (currentHandCenterXOffset - startReference.handCenterXOffset) *
    destinationSign
  );
};

const getProgressFromStartToCenter = (
  currentOffset: number | null,
  startOffset: number | null | undefined,
) => {
  if (
    currentOffset === null ||
    startOffset === null ||
    startOffset === undefined
  ) {
    return null;
  }

  const distanceToCenter = -startOffset;

  if (Math.abs(distanceToCenter) < 0.05) return null;

  return (currentOffset - startOffset) / distanceToCenter;
};

const getDirectionResult = (
  signedProgressFromBeat1: number | null,
): AutumnDirectionResult => {
  if (signedProgressFromBeat1 === null) return "unknown";

  if (
    signedProgressFromBeat1 <
    -autumnMovementConfig.thresholds.negativeProgressTolerance
  ) {
    return "negativeProgress";
  }

  if (
    signedProgressFromBeat1 < autumnMovementConfig.thresholds.beat3ProgressMin
  ) {
    return "insufficientProgress";
  }

  return "matched";
};

const getDirectionFailureReason = ({
  startSidePassed,
  directionResult,
}: {
  startSidePassed: boolean | null;
  directionResult: AutumnDirectionResult;
}): AutumnDirectionFailureReason => {
  if (startSidePassed === false) return "wrongStartSide";
  if (directionResult === "negativeProgress") return "negativeProgress";
  if (
    directionResult === "matched" ||
    directionResult === "insufficientProgress"
  ) {
    return "notDirectionFailure";
  }

  return "unknown";
};

const classifyEndpointRegion = (
  progress: number | null,
): AutumnEndpointRegion => {
  if (progress === null || !Number.isFinite(progress)) return "unknown";

  if (progress < AUTUMN_ENDPOINT_ZONES.startSideDiagonal.min) {
    return "startSide";
  }
  if (progress < AUTUMN_ENDPOINT_ZONES.nearCenterStartSide.min) {
    return "startSideDiagonal";
  }
  if (progress < AUTUMN_ENDPOINT_ZONES.centerFront.min) {
    return "nearCenterStartSide";
  }
  if (progress < AUTUMN_ENDPOINT_ZONES.destinationSide.min) {
    return "centerFront";
  }
  if (progress < AUTUMN_ENDPOINT_ZONES.farDestinationSide.min) {
    return "destinationSide";
  }

  return "farDestinationSide";
};

const classifyAutumnValue = (
  endpointRegion: AutumnEndpointRegion,
): AutumnValueClass | "unknown" => {
  if (endpointRegion === "startSideDiagonal") return "25";
  if (endpointRegion === "nearCenterStartSide") return "40";
  if (endpointRegion === "centerFront") return "50";
  if (endpointRegion === "destinationSide") return "80";
  if (endpointRegion === "farDestinationSide") return "100";

  return "unknown";
};

const endpointRegionOrder: Record<AutumnEndpointRegion, number> = {
  unknown: -1,
  startSide: 0,
  startSideDiagonal: 1,
  nearCenterStartSide: 2,
  centerFront: 3,
  destinationSide: 4,
  farDestinationSide: 5,
};

const getEndpointErrorKind = (
  detectedRegion: AutumnEndpointRegion,
  expectedRegion: AutumnEndpointRegion,
): AutumnEndpointErrorKind => {
  if (detectedRegion === "unknown") return "unknown";
  if (detectedRegion === expectedRegion) return "matched";

  return endpointRegionOrder[detectedRegion] <
    endpointRegionOrder[expectedRegion]
    ? "tooShort"
    : "tooFar";
};

const getLandmarkPoint = (landmarks: PoseLandmarkLike[], index: number) =>
  toPosePoint(landmarks[index]);

const vectorFrom = (from: PosePoint | null, to: PosePoint | null) =>
  from && to
    ? {
        x: to.x - from.x,
        y: to.y - from.y,
      }
    : null;

const normalizeVector = (vector: { x: number; y: number } | null) => {
  if (!vector) return null;

  const magnitude = Math.hypot(vector.x, vector.y);

  if (magnitude <= 0) return null;

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
};

const cosineSimilarity = (
  a: { x: number; y: number } | null,
  b: { x: number; y: number } | null,
) => (a && b ? a.x * b.x + a.y * b.y : null);

const classifyOuterArmExtension = (
  outerElbowAngle: number | null,
  outerWristRelativeToOuterShoulder: number | null,
): AutumnArmExtensionClass => {
  if (outerElbowAngle === null || outerWristRelativeToOuterShoulder === null) {
    return "unknown";
  }

  if (outerElbowAngle >= 142 && outerWristRelativeToOuterShoulder >= 0.18) {
    return "maximum";
  }
  if (outerElbowAngle >= 124 && outerWristRelativeToOuterShoulder >= -0.04) {
    return "large";
  }
  if (outerElbowAngle >= 82) return "forward";

  return "compact";
};

const createEmptyMetrics = (): AutumnRecognitionMetrics => ({
  shoulderWidth: null,
  normalizedHandDistance: null,
  normalizedAnkleDistance: null,
  expectedStartSide: "unknown",
  detectedStartSide: "unknown",
  startSidePassed: null,
  directionLocked: false,
  directionResult: "unknown",
  directionFailureReason: "unknown",
  signedProgressFromBeat1: null,
  normalizedProgress: null,
  expectedProgressMin: null,
  expectedProgressMax: null,
  beat1HandCenterXOffset: null,
  beat1OuterWristXOffset: null,
  handCenterXOffset: null,
  handCenterYFromShoulders: null,
  handRadiusFromTorso: null,
  handTravelProgress: null,
  handCenterRegionProgress: null,
  detectedEndpointRegion: "unknown",
  endpointErrorKind: "unknown",
  outerWristRelativeToOuterShoulder: null,
  outerWristXOffset: null,
  outerWristProgressToCenter: null,
  outerElbowAngle: null,
  outerArmExtensionClass: "unknown",
  outerArmDirectionX: null,
  outerArmDirectionY: null,
  innerForearmDirectionX: null,
  innerForearmDirectionY: null,
  armDirectionSimilarity: null,
  torsoFacingScore: null,
  progressFromStartingPose: null,
  detectedValueClass: "unknown",
  landmarkConfidence: "missing-body-reference",
});

export const extractAutumnRecognitionMetrics = (
  landmarks: PoseLandmarkLike[] | null | undefined,
  direction: AutumnDirection = "leftToRight",
  context: {
    beat?: AutumnBeat;
    startReference?: AutumnStartReference | null;
    expectedValueClass?: AutumnValueClass;
  } = {},
): AutumnRecognitionMetrics => {
  if (!landmarks?.length) return createEmptyMetrics();

  const bodyMetrics = extractNormalizedBodyMetrics(landmarks);
  const {
    shoulderWidth,
    shoulderCenter,
    hipCenter,
    torsoCenter,
    handCenter,
    leftWrist,
    rightWrist,
  } = bodyMetrics;

  if (!shoulderWidth || !shoulderCenter || !handCenter || !torsoCenter) {
    return createEmptyMetrics();
  }

  const destinationSign = destinationSignForDirection(direction);
  const handCenterXOffset = (handCenter.x - shoulderCenter.x) / shoulderWidth;
  const handCenterYFromShoulders =
    (handCenter.y - shoulderCenter.y) / shoulderWidth;
  const handRadiusFromTorso =
    distance2D(handCenter, torsoCenter) !== null
      ? distance2D(handCenter, torsoCenter)! / shoulderWidth
      : null;
  const startOffset = -0.95 * destinationSign;
  const destinationOffset = 0.95 * destinationSign;
  const handTravelProgress =
    (handCenterXOffset - startOffset) / (destinationOffset - startOffset);
  const expectedStartSide = getExpectedStartSide(direction);
  const detectedStartSide = getDetectedSide(handCenterXOffset);
  const startSidePassed = getStartSidePassed(
    detectedStartSide,
    expectedStartSide,
  );
  const signedProgressFromBeat1 = getSignedProgressFromBeat1({
    currentHandCenterXOffset: handCenterXOffset,
    startReference: context.startReference,
    direction,
  });
  const directionLocked = Boolean(
    context.startReference?.startSidePassed &&
    context.startReference.handCenterXOffset !== null,
  );
  const directionResult = directionLocked
    ? getDirectionResult(signedProgressFromBeat1)
    : "unknown";
  const directionFailureReason = getDirectionFailureReason({
    startSidePassed: directionLocked
      ? (context.startReference?.startSidePassed ?? null)
      : context.beat === 1
        ? startSidePassed
        : null,
    directionResult,
  });
  const reference =
    context.expectedValueClass !== undefined
      ? AUTUMN_MOVEMENT_REFERENCE[context.expectedValueClass]
      : null;
  const detectedEndpointRegion = classifyEndpointRegion(handTravelProgress);
  const detectedValueClass = classifyAutumnValue(detectedEndpointRegion);
  const leftShoulder = getLandmarkPoint(landmarks, POSE_LANDMARK.LEFT_SHOULDER);
  const rightShoulder = getLandmarkPoint(
    landmarks,
    POSE_LANDMARK.RIGHT_SHOULDER,
  );
  const leftElbow = getLandmarkPoint(landmarks, POSE_LANDMARK.LEFT_ELBOW);
  const rightElbow = getLandmarkPoint(landmarks, POSE_LANDMARK.RIGHT_ELBOW);
  const leftArmIsOuter =
    leftShoulder !== null &&
    rightShoulder !== null &&
    leftShoulder.x * destinationSign > rightShoulder.x * destinationSign;
  const outerShoulder = leftArmIsOuter ? leftShoulder : rightShoulder;
  const outerElbow = leftArmIsOuter ? leftElbow : rightElbow;
  const outerWrist = leftArmIsOuter ? leftWrist : rightWrist;
  const innerElbow = leftArmIsOuter ? rightElbow : leftElbow;
  const innerWrist = leftArmIsOuter ? rightWrist : leftWrist;
  const outerWristRelativeToOuterShoulder =
    outerWrist && outerShoulder
      ? ((outerWrist.x - outerShoulder.x) * destinationSign) / shoulderWidth
      : null;
  const outerWristXOffset = outerWrist
    ? (outerWrist.x - shoulderCenter.x) / shoulderWidth
    : null;
  const outerWristProgressToCenter = getProgressFromStartToCenter(
    outerWristXOffset,
    context.startReference?.outerWristXOffset,
  );
  const outerElbowAngle = calculateJointAngle(
    outerShoulder,
    outerElbow,
    outerWrist,
  );
  const outerArmDirection = normalizeVector(
    vectorFrom(outerShoulder, outerWrist),
  );
  const innerForearmDirection = normalizeVector(
    vectorFrom(innerElbow, innerWrist),
  );
  const armDirectionSimilarity = cosineSimilarity(
    outerArmDirection,
    innerForearmDirection,
  );
  const outerArmExtensionClass = classifyOuterArmExtension(
    outerElbowAngle,
    outerWristRelativeToOuterShoulder,
  );
  const torsoCenterOffset =
    hipCenter && shoulderCenter
      ? Math.abs(hipCenter.x - shoulderCenter.x) / shoulderWidth
      : null;
  const torsoFacingScore =
    torsoCenterOffset === null ? null : Math.max(0, 1 - torsoCenterOffset);
  const endpointErrorKind = getEndpointErrorKind(
    detectedEndpointRegion,
    "unknown",
  );

  return {
    shoulderWidth,
    normalizedHandDistance: bodyMetrics.normalizedHandDistance,
    normalizedAnkleDistance: bodyMetrics.normalizedAnkleDistance,
    expectedStartSide,
    detectedStartSide,
    startSidePassed,
    directionLocked,
    directionResult,
    directionFailureReason,
    signedProgressFromBeat1,
    normalizedProgress: handTravelProgress,
    expectedProgressMin: reference?.progressRange.min ?? null,
    expectedProgressMax:
      reference && Number.isFinite(reference.progressRange.max)
        ? reference.progressRange.max
        : null,
    beat1HandCenterXOffset: context.startReference?.handCenterXOffset ?? null,
    beat1OuterWristXOffset: context.startReference?.outerWristXOffset ?? null,
    handCenterXOffset,
    handCenterYFromShoulders,
    handRadiusFromTorso,
    handTravelProgress,
    handCenterRegionProgress: handTravelProgress,
    detectedEndpointRegion,
    endpointErrorKind,
    outerWristRelativeToOuterShoulder,
    outerWristXOffset,
    outerWristProgressToCenter,
    outerElbowAngle,
    outerArmExtensionClass,
    outerArmDirectionX: outerArmDirection?.x ?? null,
    outerArmDirectionY: outerArmDirection?.y ?? null,
    innerForearmDirectionX: innerForearmDirection?.x ?? null,
    innerForearmDirectionY: innerForearmDirection?.y ?? null,
    armDirectionSimilarity,
    torsoFacingScore,
    progressFromStartingPose: Math.max(
      0,
      signedProgressFromBeat1 ?? handTravelProgress,
    ),
    detectedValueClass,
    landmarkConfidence: "ok",
  };
};

export const evaluateAutumnBeat = (
  landmarks: PoseLandmarkLike[] | null | undefined,
  beat: AutumnBeat,
  timestamp: number,
  context: BeatContext = {},
): AutumnBeatEvaluation => {
  const expectedDirection = context.expectedDirection ?? "leftToRight";
  const expectedValueClass = context.expectedValueClass ?? "100";
  const metrics = extractAutumnRecognitionMetrics(
    landmarks,
    expectedDirection,
    {
      beat,
      expectedValueClass,
      startReference: context.startReference,
    },
  );
  const endpointErrorKind = getEndpointErrorKind(
    metrics.detectedEndpointRegion,
    AUTUMN_MOVEMENT_REFERENCE[expectedValueClass].endpointRegion,
  );
  const metricsWithContext = {
    ...metrics,
    endpointErrorKind,
  };

  if (!landmarks?.length || metricsWithContext.shoulderWidth === null) {
    return {
      beat,
      score: 0,
      passed: false,
      trackingUnavailable: true,
      criteria: [],
      timestamp,
      expectedDirection,
      expectedValueClass,
      feedbackCode: "FULL_BODY_NOT_VISIBLE",
      metrics: metricsWithContext,
    };
  }

  const criteria = buildAutumnBeatCriteria(beat, metricsWithContext, {
    expectedDirection,
    expectedValueClass,
  });
  const score = getAutumnCriteriaScore(criteria);
  const { passed, trackingUnavailable } = getBeatPassState({
    criteria,
    score,
    passScore: autumnMovementConfig.thresholds.beatPassScore,
  });

  return {
    beat,
    score,
    passed,
    trackingUnavailable,
    criteria,
    timestamp,
    expectedDirection,
    expectedValueClass,
    feedbackCode: passed ? undefined : getAutumnBeatFeedbackCode(criteria),
    metrics: metricsWithContext,
  };
};

const hasFailedCriterion = (
  evaluation: AutumnBeatEvaluation,
  criterionIds: string[],
) =>
  evaluation.criteria.some(
    (criterion) =>
      criterionIds.includes(criterion.id) && criterion.status === "failed",
  );

const findAutumnProblemByBeatAndCriteria = (
  beatEvaluations: AutumnBeatEvaluation[],
  beat: AutumnBeat,
  criterionIds: string[],
) =>
  beatEvaluations.find(
    (evaluation) =>
      evaluation.beat === beat &&
      !evaluation.passed &&
      evaluation.feedbackCode &&
      hasFailedCriterion(evaluation, criterionIds),
  );

export const getPrioritizedAutumnProblemEvaluation = (
  beatEvaluations: AutumnBeatEvaluation[],
) => {
  const trackingProblem = beatEvaluations.find(
    (evaluation) => evaluation.trackingUnavailable,
  );

  if (trackingProblem) return trackingProblem;

  return (
    findAutumnProblemByBeatAndCriteria(beatEvaluations, 1, [
      "hands-start-side",
    ]) ??
    findAutumnProblemByBeatAndCriteria(beatEvaluations, 3, [
      "endpoint-value-range",
      "progress-from-start",
      "outer-arm-extension",
      "outer-wrist-endpoint-side",
      "inner-forearm-oriented-endpoint",
      "shared-arm-direction",
      "hands-chest-shoulder-height",
    ]) ??
    findAutumnProblemByBeatAndCriteria(beatEvaluations, 4, [
      "hands-return-center",
      "feet-close",
    ]) ??
    beatEvaluations.find(
      (evaluation) =>
        evaluation.beat === 2 && !evaluation.passed && evaluation.feedbackCode,
    ) ??
    beatEvaluations.find(
      (evaluation) => !evaluation.passed && evaluation.feedbackCode,
    )
  );
};

export const evaluateAutumnSequence = (
  beatEvaluations: AutumnBeatEvaluation[],
): AutumnSequenceEvaluation => {
  const totalScore = getWeightedBeatEvaluationScore(
    beatEvaluations,
    AUTUMN_BEAT_WEIGHTS,
  );
  const hasTrackingUnavailable = beatEvaluations.some(
    (evaluation) => evaluation.trackingUnavailable,
  );
  const hasCentralFailure = beatEvaluations.some(
    (evaluation) =>
      (evaluation.beat === 1 ||
        evaluation.beat === 3 ||
        evaluation.beat === 4) &&
      !evaluation.passed,
  );
  const passed =
    !hasTrackingUnavailable &&
    !hasCentralFailure &&
    totalScore >= autumnMovementConfig.thresholds.almostCorrectScore;
  const resultState: AutumnRecognitionResultState = hasTrackingUnavailable
    ? "trackingUnavailable"
    : totalScore >= autumnMovementConfig.thresholds.successScore &&
        !hasCentralFailure
      ? "success"
      : passed
        ? "almostCorrect"
        : "retryRequired";
  const prioritizedProblem =
    getPrioritizedAutumnProblemEvaluation(beatEvaluations);

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

export const getAutumnDirectionForRepetition =
  getExpectedDirectionForRepetition;
