import type { MovementRange } from "~/utils/movement/core/range";
import type { Act4FeedbackSignal, Act4SelectedFeedback } from "~/types/act4";

export type SummerBeat = 1 | 2 | 3 | 4;
export type SummerIntensity = "100" | "60" | "30" | "10";
export type SummerDetectedIntensityClass = SummerIntensity | "unknown";
export type SummerStepSide = "left" | "right" | "none" | "unknown";
export type SummerCriterionImportance = "essential" | "supporting";
export type SummerCriterionDomain = "shape" | "intensity";
export type SummerCriterionStatus = "passed" | "failed" | "notEvaluable";
export type SummerFeedbackCode =
  | "SUCCESS"
  | "MOVE_HANDS_TO_CENTER"
  | "RAISE_ARMS_HIGHER"
  | "STRAIGHTEN_ARMS"
  | "STEP_WIDER"
  | "STEP_SMALLER"
  | "OPEN_ARMS_TO_SIDES"
  | "OPEN_ARMS_LESS"
  | "RETURN_FEET_TO_CENTER"
  | "LOWER_ARMS"
  | "BEND_ELBOWS_MORE"
  | "MOVEMENT_TOO_LARGE"
  | "MOVEMENT_TOO_SMALL"
  | "ALTERNATE_STEP_SIDE"
  | "FULL_BODY_NOT_VISIBLE"
  | "HANDS_NOT_VISIBLE"
  | "TRY_AGAIN";

export type SummerRecognitionResultState =
  "success" | "almostCorrect" | "retryRequired" | "trackingUnavailable";

export type SummerNeutralCalibration = {
  leftAnkleX: number;
  rightAnkleX: number;
  ankleDistance: number;
  sampleCount: number;
};

export type SummerRecognitionMetrics = {
  shoulderWidth: number | null;
  normalizedHandDistance: number | null;
  normalizedAnkleDistance: number | null;
  leftFootLateralOffset: number | null;
  rightFootLateralOffset: number | null;
  stepAmplitude: number | null;
  leftHandHeightFromShoulders: number | null;
  rightHandHeightFromShoulders: number | null;
  handRaiseAmplitude: number | null;
  leftElbowAngle: number | null;
  rightElbowAngle: number | null;
  averageElbowAngle: number | null;
  normalizedArmOpening: number | null;
  detectedStepSide: SummerStepSide;
  detectedIntensityClass: SummerDetectedIntensityClass;
  combinedAmplitude: number | null;
  landmarkConfidence: string;
};

export type SummerCriterionResult = {
  id: string;
  label: string;
  status: SummerCriterionStatus;
  passed: boolean;
  score: number;
  importance: SummerCriterionImportance;
  domain: SummerCriterionDomain;
  debugValue?: number | string;
  expectedRange?: string;
  failureDirection?: "tooLow" | "tooHigh";
  feedbackCode?: SummerFeedbackCode;
};

export type SummerBeatEvaluation = {
  beat: SummerBeat;
  measureIndex?: number | null;
  score: number;
  movementShapeScore: number;
  intensityMatchScore: number;
  overallScore: number;
  movementShapePassed: boolean;
  intensityMatched: boolean;
  passed: boolean;
  negativeFeedbackEligible?: boolean;
  trackingUnavailable: boolean;
  criteria: SummerCriterionResult[];
  timestamp: number;
  detectedStepSide: SummerStepSide;
  detectedIntensityClass: SummerDetectedIntensityClass;
  feedbackCode?: SummerFeedbackCode;
  feedbackSignals?: Act4FeedbackSignal<SummerFeedbackCode>[];
  metrics: SummerRecognitionMetrics;
};

export type SummerSequenceEvaluation = {
  passed: boolean;
  resultState: SummerRecognitionResultState;
  totalScore: number;
  beatEvaluations: SummerBeatEvaluation[];
  detectedStepSides: SummerStepSide[];
  feedbackCode?: SummerFeedbackCode;
  primaryFeedbackCode?: SummerFeedbackCode;
  selectedFeedback?: Act4SelectedFeedback<SummerFeedbackCode>;
};

export type SummerThresholds = {
  closedStanceMax: number;
  handsTogetherMax: number;
  handCenterMaxOffset: number;
  chestMinY: number;
  chestMaxY: number;
  handsAboveHeadMargin: number;
  armsRaisedAboveShoulders: number;
  overheadHandsTogetherMax: number;
  openHandsMin: number;
  shoulderHeightTolerance: number;
  handsLoweredMinY: number;
  returnExpansionRatio: number;
  straightElbowMinAngle: number;
  beatPassScore: number;
  essentialPassRatio: number;
  successScore: number;
  almostCorrectScore: number;
};

export type SummerRange = MovementRange;

export type SummerMeasureEvaluation = {
  movementShapeScore: number;
  intensityMatchScore: number;
  overallScore: number;
  movementShapePassed: boolean;
  intensityMatched: boolean;
};

export type SummerMovementReference = {
  label: string;
  shapePassScore: number;
  intensityPassScore: number;
  beat2: {
    handHeightClass:
      | "aboveHead"
      | "aboveHeadReduced"
      | "inFrontOfHead"
      | "upperBodyToShoulderLevel";
    elbowClass: "mostlyStraight" | "moderatelyBent" | "clearlyBent";
    handRaiseAmplitude: SummerRange;
    elbowAngle: SummerRange;
    handsAboveHeadRequired: boolean;
  };
  beat3: {
    armOpeningClass: "large" | "medium" | "small" | "minimal";
    handHeightClass: "shoulderLevel" | "aroundShoulderLevel";
    elbowClass: "mostlyStraight" | "moderatelyBent" | "clearlyBent";
    armOpening: SummerRange;
    elbowAngle: SummerRange;
    importance: "supporting";
  };
};
