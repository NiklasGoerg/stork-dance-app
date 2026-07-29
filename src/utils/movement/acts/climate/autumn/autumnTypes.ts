import type { MovementRange } from "~/utils/movement/core/range";

export type AutumnBeat = 1 | 2 | 3 | 4;
export type AutumnValueClass = "100" | "80" | "50" | "40" | "25";
export type AutumnDirection = "leftToRight" | "rightToLeft";
export type AutumnSide = "left" | "right" | "center" | "unknown";
export type AutumnDirectionResult =
  "matched" | "negativeProgress" | "insufficientProgress" | "unknown";
export type AutumnDirectionFailureReason =
  "wrongStartSide" | "negativeProgress" | "notDirectionFailure" | "unknown";
export type AutumnEndpointRegion =
  | "startSide"
  | "startSideDiagonal"
  | "nearCenterStartSide"
  | "centerFront"
  | "destinationSide"
  | "farDestinationSide"
  | "unknown";
export type AutumnEndpointErrorKind =
  "matched" | "tooShort" | "tooFar" | "wrongRegion" | "timing" | "unknown";
export type AutumnArmExtensionClass =
  "maximum" | "large" | "forward" | "compact" | "unknown";
export type AutumnCriterionImportance = "essential" | "supporting";
export type AutumnCriterionStatus = "passed" | "failed" | "notEvaluable";
export type AutumnFeedbackCode =
  | "SUCCESS"
  | "FULL_BODY_NOT_VISIBLE"
  | "HANDS_NOT_VISIBLE"
  | "START_LEFT"
  | "START_RIGHT"
  | "WRONG_SWEEP_DIRECTION"
  | "INSUFFICIENT_PROGRESS"
  | "SWEEP_RIGHT"
  | "SWEEP_LEFT"
  | "ENDPOINT_TOO_SHORT"
  | "ENDPOINT_TOO_FAR"
  | "ENDPOINT_REACHED_TOO_LATE"
  | "ENDPOINT_UNSTABLE"
  | "END_AT_DESTINATION_SIDE"
  | "END_AT_FAR_DESTINATION_SIDE"
  | "END_AT_CENTER"
  | "END_BEFORE_CENTER"
  | "END_AT_START_SIDE_DIAGONAL"
  | "ALIGN_BOTH_ARMS"
  | "EXTEND_OUTER_ARM"
  | "KEEP_HANDS_AT_CHEST_HEIGHT"
  | "KEEP_CHEST_FORWARD"
  | "RETURN_HANDS_TO_CENTER"
  | "RETURN_FEET_TOGETHER"
  | "TRY_AGAIN"
  // Legacy aliases kept so older UI/interlude mappings do not break while
  // Autumn feedback is migrated to the clearer endpoint vocabulary.
  | "START_ON_LEFT"
  | "START_ON_RIGHT"
  | "MOVE_HANDS_TOGETHER"
  | "KEEP_HANDS_CHEST_HEIGHT"
  | "SWEEP_FARTHER"
  | "SWEEP_LESS";

export type AutumnRecognitionResultState =
  "success" | "almostCorrect" | "retryRequired" | "trackingUnavailable";

export type AutumnMovementReference = {
  valueClass: AutumnValueClass;
  progressRange: MovementRange;
  label: string;
  endpointRegion: AutumnEndpointRegion;
  outerArmExtension: AutumnArmExtensionClass;
  requireOuterWristBeyondShoulder: boolean;
  requireProgressFromBeat1: boolean;
};

export type AutumnRecognitionMetrics = {
  shoulderWidth: number | null;
  normalizedHandDistance: number | null;
  normalizedAnkleDistance: number | null;
  expectedStartSide: AutumnSide;
  detectedStartSide: AutumnSide;
  startSidePassed: boolean | null;
  directionLocked: boolean;
  directionResult: AutumnDirectionResult;
  directionFailureReason: AutumnDirectionFailureReason;
  signedProgressFromBeat1: number | null;
  normalizedProgress: number | null;
  expectedProgressMin: number | null;
  expectedProgressMax: number | null;
  beat1HandCenterXOffset: number | null;
  beat1OuterWristXOffset: number | null;
  handCenterXOffset: number | null;
  handCenterYFromShoulders: number | null;
  handRadiusFromTorso: number | null;
  handTravelProgress: number | null;
  handCenterRegionProgress: number | null;
  detectedEndpointRegion: AutumnEndpointRegion;
  endpointErrorKind: AutumnEndpointErrorKind;
  outerWristRelativeToOuterShoulder: number | null;
  outerWristXOffset: number | null;
  outerWristProgressToCenter: number | null;
  outerElbowAngle: number | null;
  outerArmExtensionClass: AutumnArmExtensionClass;
  outerArmDirectionX: number | null;
  outerArmDirectionY: number | null;
  innerForearmDirectionX: number | null;
  innerForearmDirectionY: number | null;
  armDirectionSimilarity: number | null;
  torsoFacingScore: number | null;
  progressFromStartingPose: number | null;
  detectedValueClass: AutumnValueClass | "unknown";
  landmarkConfidence: string;
};

export type AutumnCriterionResult = {
  id: string;
  label: string;
  status: AutumnCriterionStatus;
  passed: boolean;
  score: number;
  importance: AutumnCriterionImportance;
  debugValue?: number | string;
  expectedRange?: string;
  feedbackCode?: AutumnFeedbackCode;
};

export type AutumnBeatEvaluation = {
  beat: AutumnBeat;
  score: number;
  passed: boolean;
  trackingUnavailable: boolean;
  criteria: AutumnCriterionResult[];
  timestamp: number;
  expectedDirection: AutumnDirection;
  expectedValueClass: AutumnValueClass;
  feedbackCode?: AutumnFeedbackCode;
  metrics: AutumnRecognitionMetrics;
};

export type AutumnSequenceEvaluation = {
  passed: boolean;
  resultState: AutumnRecognitionResultState;
  totalScore: number;
  beatEvaluations: AutumnBeatEvaluation[];
  feedbackCode?: AutumnFeedbackCode;
};

export type AutumnThresholds = {
  handsTogetherMax: number;
  startSideMinOffset: number;
  centerMaxOffset: number;
  chestMinY: number;
  chestMaxY: number;
  endpointTolerance: number;
  beat2ProgressMin: number;
  beat3ProgressMin: number;
  negativeProgressTolerance: number;
  outerWristBeyondShoulderMin: number;
  outerWristNearShoulderMin: number;
  outerWristAutumn80Min: number;
  outerElbowLargeMin: number;
  outerElbowMaximumMin: number;
  armDirectionSimilarityMin: number;
  innerForearmDestinationMin: number;
  torsoFacingMinScore: number;
  radiusMin: number;
  radiusMax: number;
  closedFeetMax: number;
  beatPassScore: number;
  successScore: number;
  almostCorrectScore: number;
};
