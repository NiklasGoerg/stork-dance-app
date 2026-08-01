import type { PoseLandmarkLike } from "~/types/pose";
import {
  summerCriterionFeedbackMetadata,
  summerFeedbackMetadata,
} from "~/utils/act5/feedback/catalog";
import { buildAct5BeatFeedbackSignals } from "~/utils/act5/feedback/signals";
import { selectAct5FinalFeedback } from "~/utils/act5/feedback/selectFinalFeedback";
import { getWeightedBeatEvaluationScore } from "~/utils/movement/core/criteria";
import { extractNormalizedBodyMetrics } from "~/utils/movement/core/bodyMetrics";
import { getMovementRangeFitScore } from "~/utils/movement/core/range";
import {
  buildSummerBeatCriteria,
  getSummerBeatFeedbackCode,
  getSummerCriteriaScore,
  getSummerEssentialPassRatio,
} from "~/utils/movement/acts/climate/summer/summerCriteria";
import {
  SUMMER_BEAT_WEIGHTS,
  SUMMER_MOVEMENT_REFERENCE,
  summerMovementConfig,
} from "~/utils/movement/acts/climate/summer/summerReference";
import type {
  SummerBeat,
  SummerBeatEvaluation,
  SummerDetectedIntensityClass,
  SummerFeedbackCode,
  SummerIntensity,
  SummerNeutralCalibration,
  SummerRecognitionMetrics,
  SummerRecognitionResultState,
  SummerSequenceEvaluation,
  SummerStepSide,
} from "~/utils/movement/acts/climate/summer/summerTypes";
import { averageValid } from "~/utils/pose/poseGeometry";

export * from "~/utils/movement/acts/climate/summer/summerReference";
export * from "~/utils/movement/acts/climate/summer/summerTypes";

type BeatContext = {
  expectedIntensity?: SummerIntensity;
  measureIndex?: number | null;
  expectedStepSide?: Exclude<SummerStepSide, "none" | "unknown"> | null;
  neutralCalibration?: SummerNeutralCalibration | null;
  expansionReference?: {
    normalizedAnkleDistance: number | null;
    lowestHandHeightFromShoulders: number | null;
  } | null;
  preparationReference?: {
    handRaiseAmplitude: number | null;
    normalizedArmOpening: number | null;
  } | null;
};

const classifyDetectedIntensity = (
  metrics: Omit<
    SummerRecognitionMetrics,
    "detectedIntensityClass" | "landmarkConfidence"
  >,
): SummerDetectedIntensityClass => {
  const rankedIntensities = (["100", "60", "30", "10"] as SummerIntensity[])
    .map((intensity) => {
      const reference = SUMMER_MOVEMENT_REFERENCE[intensity];
      const beat2 = reference.beat2;
      const beat3 = reference.beat3;
      const score =
        getMovementRangeFitScore(
          metrics.handRaiseAmplitude,
          beat2.handRaiseAmplitude,
        ) *
          0.54 +
        getMovementRangeFitScore(metrics.averageElbowAngle, beat2.elbowAngle) *
          0.29 +
        getMovementRangeFitScore(
          metrics.normalizedArmOpening,
          beat3.armOpening,
        ) *
          0.17;

      return { intensity, score };
    })
    .sort((a, b) => b.score - a.score);

  return rankedIntensities[0]?.score && rankedIntensities[0].score >= 0.42
    ? rankedIntensities[0].intensity
    : "unknown";
};

const createEmptyMetrics = (): SummerRecognitionMetrics => ({
  shoulderWidth: null,
  normalizedHandDistance: null,
  normalizedAnkleDistance: null,
  leftFootLateralOffset: null,
  rightFootLateralOffset: null,
  stepAmplitude: null,
  leftHandHeightFromShoulders: null,
  rightHandHeightFromShoulders: null,
  handRaiseAmplitude: null,
  leftElbowAngle: null,
  rightElbowAngle: null,
  averageElbowAngle: null,
  normalizedArmOpening: null,
  detectedStepSide: "unknown",
  detectedIntensityClass: "unknown",
  combinedAmplitude: null,
  landmarkConfidence: "missing-body-reference",
});

export const extractSummerRecognitionMetrics = (
  landmarks: PoseLandmarkLike[] | null | undefined,
  neutralCalibration?: SummerNeutralCalibration | null,
): SummerRecognitionMetrics => {
  if (!landmarks?.length) return createEmptyMetrics();

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

  if (!shoulderWidth || !shoulderCenter) return createEmptyMetrics();

  const torsoLength =
    hipCenter && bodyMetrics.leftTorsoLength && bodyMetrics.rightTorsoLength
      ? (bodyMetrics.torsoLength ?? shoulderWidth)
      : shoulderWidth;
  const leftFootLateralOffset =
    leftAnkle && neutralCalibration
      ? Math.abs(leftAnkle.x - neutralCalibration.leftAnkleX) / shoulderWidth
      : leftAnkle && hipCenter
        ? Math.abs(leftAnkle.x - hipCenter.x) / shoulderWidth
        : null;
  const rightFootLateralOffset =
    rightAnkle && neutralCalibration
      ? Math.abs(rightAnkle.x - neutralCalibration.rightAnkleX) / shoulderWidth
      : rightAnkle && hipCenter
        ? Math.abs(rightAnkle.x - hipCenter.x) / shoulderWidth
        : null;
  const stepAmplitude =
    averageValid([leftFootLateralOffset, rightFootLateralOffset]) === null
      ? null
      : Math.max(leftFootLateralOffset ?? 0, rightFootLateralOffset ?? 0);
  const detectedStepSide = getDetectedStepSide({
    leftFootLateralOffset,
    rightFootLateralOffset,
    normalizedAnkleDistance: bodyMetrics.normalizedAnkleDistance,
  });
  const leftHandHeightFromShoulders = leftWrist
    ? (leftWrist.y - shoulderCenter.y) / shoulderWidth
    : null;
  const rightHandHeightFromShoulders = rightWrist
    ? (rightWrist.y - shoulderCenter.y) / shoulderWidth
    : null;
  const leftHandRaiseAmplitude =
    leftWrist && torsoLength
      ? Math.max(0, (shoulderCenter.y - leftWrist.y) / torsoLength)
      : null;
  const rightHandRaiseAmplitude =
    rightWrist && torsoLength
      ? Math.max(0, (shoulderCenter.y - rightWrist.y) / torsoLength)
      : null;
  const handRaiseAmplitude = averageValid([
    leftHandRaiseAmplitude,
    rightHandRaiseAmplitude,
  ]);
  const leftElbowAngle = bodyMetrics.leftElbowAngle;
  const rightElbowAngle = bodyMetrics.rightElbowAngle;
  const averageElbowAngle = bodyMetrics.averageElbowAngle;
  const normalizedArmOpening = bodyMetrics.normalizedWristSpan;
  const combinedAmplitude = averageValid([
    stepAmplitude,
    handRaiseAmplitude,
    normalizedArmOpening,
  ]);
  const detectedIntensityClass = classifyDetectedIntensity({
    shoulderWidth,
    normalizedHandDistance: bodyMetrics.normalizedHandDistance,
    normalizedAnkleDistance: bodyMetrics.normalizedAnkleDistance,
    leftFootLateralOffset,
    rightFootLateralOffset,
    stepAmplitude,
    leftHandHeightFromShoulders,
    rightHandHeightFromShoulders,
    handRaiseAmplitude,
    leftElbowAngle,
    rightElbowAngle,
    averageElbowAngle,
    normalizedArmOpening,
    detectedStepSide,
    combinedAmplitude,
  });

  return {
    shoulderWidth,
    normalizedHandDistance: bodyMetrics.normalizedHandDistance,
    normalizedAnkleDistance: bodyMetrics.normalizedAnkleDistance,
    leftFootLateralOffset,
    rightFootLateralOffset,
    stepAmplitude,
    leftHandHeightFromShoulders,
    rightHandHeightFromShoulders,
    handRaiseAmplitude,
    leftElbowAngle,
    rightElbowAngle,
    averageElbowAngle,
    normalizedArmOpening,
    detectedStepSide,
    detectedIntensityClass,
    combinedAmplitude,
    landmarkConfidence: "ok",
  };
};

const getDetectedStepSide = ({
  leftFootLateralOffset,
  rightFootLateralOffset,
  normalizedAnkleDistance,
}: Pick<
  SummerRecognitionMetrics,
  "leftFootLateralOffset" | "rightFootLateralOffset" | "normalizedAnkleDistance"
>): SummerStepSide => {
  if (
    leftFootLateralOffset === null ||
    rightFootLateralOffset === null ||
    normalizedAnkleDistance === null
  ) {
    return "unknown";
  }

  const minStepSignal = 0.04;
  const minSideDominance = 0.015;
  const hasStepSignal =
    Math.max(leftFootLateralOffset, rightFootLateralOffset) >= minStepSignal ||
    normalizedAnkleDistance >= 0.7;

  if (!hasStepSignal) return "none";

  if (
    leftFootLateralOffset - rightFootLateralOffset >= minSideDominance ||
    (leftFootLateralOffset > rightFootLateralOffset &&
      leftFootLateralOffset >= minStepSignal)
  ) {
    return "left";
  }

  if (
    rightFootLateralOffset - leftFootLateralOffset >= minSideDominance ||
    (rightFootLateralOffset > leftFootLateralOffset &&
      rightFootLateralOffset >= minStepSignal)
  ) {
    return "right";
  }

  return "unknown";
};

export const evaluateSummerBeat = (
  landmarks: PoseLandmarkLike[] | null | undefined,
  beat: SummerBeat,
  timestamp: number,
  context: BeatContext = {},
): SummerBeatEvaluation => {
  const expectedIntensity = context.expectedIntensity ?? "100";
  const metrics = extractSummerRecognitionMetrics(
    landmarks,
    context.neutralCalibration,
  );
  const thresholds = summerMovementConfig[expectedIntensity].thresholds;
  const reference = SUMMER_MOVEMENT_REFERENCE[expectedIntensity];

  if (!landmarks?.length || metrics.shoulderWidth === null) {
    return {
      beat,
      measureIndex: context.measureIndex,
      score: 0,
      movementShapeScore: 0,
      intensityMatchScore: 0,
      overallScore: 0,
      movementShapePassed: false,
      intensityMatched: false,
      passed: false,
      trackingUnavailable: true,
      criteria: [],
      timestamp,
      detectedStepSide: "unknown",
      detectedIntensityClass: "unknown",
      feedbackCode: "FULL_BODY_NOT_VISIBLE",
      feedbackSignals: buildAct5BeatFeedbackSignals<SummerFeedbackCode>({
        season: "summer",
        beat,
        measureIndex: context.measureIndex ?? null,
        criteria: [],
        trackingUnavailable: true,
        fallbackCode: "FULL_BODY_NOT_VISIBLE",
        codeMetadata: summerFeedbackMetadata,
        criterionMetadata: summerCriterionFeedbackMetadata,
        missedBeatSample: !landmarks?.length,
        landmarkConfidence: metrics.landmarkConfidence,
      }),
      metrics,
    };
  }

  const criteria = buildSummerBeatCriteria(landmarks, beat, metrics, context);
  const shapeCriteria = criteria.filter((item) => item.domain === "shape");
  const intensityCriteria = criteria.filter(
    (item) => item.domain === "intensity",
  );
  const {
    essentialCriteria: shapeEssentialCriteria,
    evaluableEssentialCriteria,
    passRatio: shapeEssentialPassRatio,
  } = getSummerEssentialPassRatio(shapeCriteria);
  const trackingUnavailable =
    evaluableEssentialCriteria.length <
    Math.ceil(shapeEssentialCriteria.length / 2);
  const movementShapeScore = getSummerCriteriaScore(shapeCriteria);
  const intensityMatchScore = intensityCriteria.length
    ? getSummerCriteriaScore(intensityCriteria)
    : 100;
  const score = getSummerCriteriaScore(criteria);
  const intensityHasFailedEssential = intensityCriteria.some(
    (item) =>
      item.importance === "essential" &&
      (item.status === "failed" || item.status === "notEvaluable"),
  );
  const movementShapePassed =
    !trackingUnavailable &&
    shapeEssentialPassRatio >= thresholds.essentialPassRatio &&
    movementShapeScore >= reference.shapePassScore;
  const intensityMatched =
    !trackingUnavailable &&
    (!intensityCriteria.length ||
      (!intensityHasFailedEssential &&
        intensityMatchScore >= reference.intensityPassScore));
  const passed = movementShapePassed && intensityMatched;

  return {
    beat,
    measureIndex: context.measureIndex,
    score,
    movementShapeScore,
    intensityMatchScore,
    overallScore: score,
    movementShapePassed,
    intensityMatched,
    passed,
    trackingUnavailable,
    criteria,
    timestamp,
    detectedStepSide: metrics.detectedStepSide,
    detectedIntensityClass: metrics.detectedIntensityClass,
    feedbackCode: passed
      ? undefined
      : getSummerBeatFeedbackCode(beat, criteria),
    feedbackSignals: buildAct5BeatFeedbackSignals<SummerFeedbackCode>({
      season: "summer",
      beat,
      measureIndex: context.measureIndex ?? null,
      criteria,
      trackingUnavailable,
      fallbackCode: getSummerBeatFeedbackCode(beat, criteria),
      codeMetadata: summerFeedbackMetadata,
      criterionMetadata: summerCriterionFeedbackMetadata,
      landmarkConfidence: metrics.landmarkConfidence,
    }),
    metrics,
  };
};

export const evaluateSummerSequence = (
  beatEvaluations: SummerBeatEvaluation[],
  expectedIntensity: SummerIntensity = "100",
): SummerSequenceEvaluation => {
  const thresholds = summerMovementConfig[expectedIntensity].thresholds;
  const totalScore = getWeightedBeatEvaluationScore(
    beatEvaluations,
    SUMMER_BEAT_WEIGHTS,
  );
  const hasCentralFailure = beatEvaluations.some(
    (evaluation) =>
      (evaluation.beat === 2 || evaluation.beat === 4) && !evaluation.passed,
  );
  const selectedFeedback = selectAct5FinalFeedback<SummerFeedbackCode>({
    season: "summer",
    beatEvaluations,
    codeMetadata: summerFeedbackMetadata,
    criterionMetadata: summerCriterionFeedbackMetadata,
    fallbackCode: "TRY_AGAIN",
  });
  const passed =
    !(
      selectedFeedback.category === "tracking" &&
      selectedFeedback.evidence.severeTracking
    ) &&
    !hasCentralFailure &&
    totalScore >= thresholds.almostCorrectScore;
  const resultState: SummerRecognitionResultState =
    selectedFeedback.category === "tracking" &&
    selectedFeedback.evidence.severeTracking
      ? "trackingUnavailable"
      : totalScore >= thresholds.successScore && !hasCentralFailure
        ? "success"
        : passed
          ? "almostCorrect"
          : "retryRequired";

  return {
    passed,
    resultState,
    totalScore,
    beatEvaluations,
    detectedStepSides: beatEvaluations.map(
      (evaluation) => evaluation.detectedStepSide,
    ),
    feedbackCode: resultState === "success" ? "SUCCESS" : selectedFeedback.code,
    primaryFeedbackCode:
      resultState === "success" ? "SUCCESS" : selectedFeedback.code,
    selectedFeedback,
  };
};
