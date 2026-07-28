import type { MovementRange } from "~/utils/movement/core/range";

export type WinterBeat = 1 | 2 | 3 | 4;
export type WinterValue = "100" | "50" | "20" | "-10";
export type WinterContractionClass =
  | "upright"
  | "medium"
  | "deep"
  | "extreme"
  | "unknown";
export type WinterCriterionImportance = "essential" | "supporting";
export type WinterCriterionStatus = "passed" | "failed" | "notEvaluable";
export type WinterFeedbackCode =
  | "SUCCESS"
  | "FULL_BODY_NOT_VISIBLE"
  | "UPPER_BODY_NOT_VISIBLE"
  | "LOWER_BODY_NOT_VISIBLE"
  | "OPEN_ARMS_WIDER"
  | "RAISE_ARMS_TO_SHOULDERS"
  | "STRAIGHTEN_ARMS_MORE"
  | "CROSS_ARMS_IN_FRONT"
  | "REACH_OPPOSITE_SHOULDERS"
  | "KEEP_ARMS_CROSSED"
  | "STAY_UPRIGHT"
  | "BEND_KNEES_MORE"
  | "STAY_HIGHER"
  | "CONTRACT_MORE"
  | "KEEP_BODY_COMPACT"
  | "PROTECT_HEAD"
  | "LOWER_BODY_AND_PROTECT_HEAD"
  | "RETURN_TO_UPRIGHT"
  | "LOWER_ARMS"
  | "TRY_AGAIN";

export type WinterRecognitionResultState =
  | "success"
  | "almostCorrect"
  | "retryRequired"
  | "trackingUnavailable";

export type WinterNeutralReference = {
  headY: number | null;
  shoulderCenterY: number | null;
  hipCenterY: number | null;
  bodyHeight: number | null;
  torsoLength: number | null;
  ankleDistance: number | null;
  sampleCount: number;
};

export type WinterMovementReference = {
  value: WinterValue;
  label: string;
  contractionRange: MovementRange;
  kneeAngleRange: MovementRange;
  requiresHeadProtection?: boolean;
};

export type WinterRecognitionMetrics = {
  shoulderWidth: number | null;
  torsoLength: number | null;
  neutralReferenceAvailable: boolean;
  neutralShoulderCenterY: number | null;
  neutralHipCenterY: number | null;
  neutralBodyHeight: number | null;
  neutralAnkleDistance: number | null;
  neutralHeadY: number | null;
  headY: number | null;
  shoulderCenterY: number | null;
  hipCenterY: number | null;
  bodyHeight: number | null;
  headDrop: number | null;
  shoulderDrop: number | null;
  hipDrop: number | null;
  bodyHeightRatio: number | null;
  leftKneeAngle: number | null;
  rightKneeAngle: number | null;
  averageKneeAngle: number | null;
  torsoForwardLean: number | null;
  compactnessScore: number | null;
  expectedContractionClass: WinterContractionClass;
  detectedContractionClass: WinterContractionClass;
  normalizedHandDistance: number | null;
  normalizedAnkleDistance: number | null;
  handOpeningWidth: number | null;
  leftHandHeightFromShoulders: number | null;
  rightHandHeightFromShoulders: number | null;
  handsAtShoulderHeight: boolean | null;
  armsOpenSideways: boolean | null;
  elbowsMostlyStraight: boolean | null;
  armsCrossed: boolean | null;
  handsCenteredForHug: boolean | null;
  handsCompactForHug: boolean | null;
  leftHandOnRightSide: boolean | null;
  rightHandOnLeftSide: boolean | null;
  selfHugDetected: boolean | null;
  handsNearOppositeShoulders: boolean | null;
  handsNearHead: boolean | null;
  handsAboveHead: boolean | null;
  headProtectionExpected: boolean;
  headProtectionDetected: boolean | null;
  returnToUprightDetected: boolean | null;
  armsReleased: boolean | null;
  feetStable: boolean | null;
  landmarkConfidence: string;
};

export type WinterCriterionResult = {
  id: string;
  label: string;
  status: WinterCriterionStatus;
  passed: boolean;
  score: number;
  importance: WinterCriterionImportance;
  debugValue?: number | string;
  expectedRange?: string;
  feedbackCode?: WinterFeedbackCode;
};

export type WinterBeatEvaluation = {
  beat: WinterBeat;
  score: number;
  passed: boolean;
  trackingUnavailable: boolean;
  criteria: WinterCriterionResult[];
  timestamp: number;
  expectedValue: WinterValue;
  feedbackCode?: WinterFeedbackCode;
  metrics: WinterRecognitionMetrics;
};

export type WinterSequenceEvaluation = {
  passed: boolean;
  resultState: WinterRecognitionResultState;
  totalScore: number;
  beatEvaluations: WinterBeatEvaluation[];
  feedbackCode?: WinterFeedbackCode;
};

export type WinterThresholds = {
  openArmWidthMin: number;
  shoulderHeightTolerance: number;
  elbowStraightMin: number;
  selfHugHeightMin: number;
  selfHugHeightMax: number;
  selfHugCenterMaxOffset: number;
  selfHugHandDistanceMax: number;
  oppositeShoulderDistanceMax: number;
  feetStableMaxDelta: number;
  uprightDropMax: number;
  uprightKneeAngleMin: number;
  returnHandDistanceMin: number;
  returnDropMax: number;
  beatPassScore: number;
  successScore: number;
  almostCorrectScore: number;
};
