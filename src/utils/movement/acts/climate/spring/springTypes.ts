import type { MovementRange } from "~/utils/movement/core/range";
import type { Act4FeedbackSignal, Act4SelectedFeedback } from "~/types/act4";

export type SpringBeat = 1 | 2 | 3 | 4;
export type SpringValue = "100" | "40" | "30" | "20";
export type SpringKneeSide = "left" | "right" | "none" | "unknown";
export type SpringHandHeightRegion =
  "low" | "waist" | "chest" | "shoulder" | "overhead" | "unknown";
export type SpringCriterionImportance = "essential" | "supporting";
export type SpringCriterionStatus = "passed" | "failed" | "notEvaluable";
export type SpringFeedbackCode =
  | "SUCCESS"
  | "FULL_BODY_NOT_VISIBLE"
  | "HANDS_NOT_VISIBLE"
  | "OPEN_ARMS_TO_BEGIN"
  | "START_HANDS_LOW"
  | "KEEP_HANDS_CLOSE_TO_BODY"
  | "OPEN_ARMS_HIGHER"
  | "KEEP_BLOOM_LOWER"
  | "REACH_ABOVE_HEAD"
  | "GATHER_HANDS_IN_FRONT"
  | "LOWER_AND_RETURN"
  | "LIFT_OTHER_KNEE"
  | "MATCH_BOTH_HANDS"
  | "TRY_AGAIN";

export type SpringRecognitionResultState =
  "success" | "almostCorrect" | "retryRequired" | "trackingUnavailable";

export type SpringMovementReference = {
  value: SpringValue;
  label: string;
  maxBeat: 3;
  handHeightRange: MovementRange;
  handOpeningMin?: number;
  wristOutsideShoulderMin?: number;
};

export type SpringPreparationReference = {
  leftHandLateralOffset: number | null;
  rightHandLateralOffset: number | null;
  lowerHandHeight: number | null;
  sampleCount: number;
};

export type SpringRecognitionMetrics = {
  shoulderWidth: number | null;
  torsoLength: number | null;
  normalizedHandDistance: number | null;
  normalizedAnkleDistance: number | null;
  leftHandHeight: number | null;
  rightHandHeight: number | null;
  averageHandHeight: number | null;
  lowerHandHeight: number | null;
  handHeightDifference: number | null;
  detectedHandHeightRegion: SpringHandHeightRegion;
  expectedHandHeightMin: number | null;
  expectedHandHeightMax: number | null;
  leftHandLateralOffset: number | null;
  rightHandLateralOffset: number | null;
  handCenterXOffset: number | null;
  handCenterHeight: number | null;
  handOpeningWidth: number | null;
  leftWristOutsideShoulder: number | null;
  rightWristOutsideShoulder: number | null;
  handsGathered: boolean | null;
  handsOpen: boolean | null;
  handsLow: boolean | null;
  handsReturnedToPrayer: boolean | null;
  overheadBloom: boolean | null;
  leftElbowAngle: number | null;
  rightElbowAngle: number | null;
  averageElbowAngle: number | null;
  openingImpulse: number | null;
  leftOutwardImpulse: number | null;
  rightOutwardImpulse: number | null;
  expectedKneeSide: SpringKneeSide;
  detectedKneeSide: SpringKneeSide;
  kneeLiftSignal: number | null;
  landmarkConfidence: string;
};

export type SpringCriterionResult = {
  id: string;
  label: string;
  status: SpringCriterionStatus;
  passed: boolean;
  score: number;
  importance: SpringCriterionImportance;
  debugValue?: number | string;
  expectedRange?: string;
  feedbackCode?: SpringFeedbackCode;
};

export type SpringBeatEvaluation = {
  beat: SpringBeat;
  measureIndex?: number | null;
  score: number;
  passed: boolean;
  trackingUnavailable: boolean;
  criteria: SpringCriterionResult[];
  timestamp: number;
  expectedValue: SpringValue;
  expectedKneeSide: SpringKneeSide;
  feedbackCode?: SpringFeedbackCode;
  feedbackSignals?: Act4FeedbackSignal<SpringFeedbackCode>[];
  metrics: SpringRecognitionMetrics;
};

export type SpringSequenceEvaluation = {
  passed: boolean;
  resultState: SpringRecognitionResultState;
  totalScore: number;
  beatEvaluations: SpringBeatEvaluation[];
  feedbackCode?: SpringFeedbackCode;
  primaryFeedbackCode?: SpringFeedbackCode;
  selectedFeedback?: Act4SelectedFeedback<SpringFeedbackCode>;
};

export type SpringThresholds = {
  handsLowMax: number;
  returnHeightMin: number;
  returnHeightMax: number;
  handsGatheredMax: number;
  overheadHandsGatheredMax: number;
  handsOpenMin: number;
  handsCloseToBodyMax: number;
  startCenterMaxOffset: number;
  overheadHandHeightMin: number;
  overheadCenterMaxOffset: number;
  wristOutsideShoulderMin: number;
  elbowExtendedMin: number;
  centerMaxOffset: number;
  openingImpulseMin: number;
  symmetryMaxDifference: number;
  kneeLiftMin: number;
  beatPassScore: number;
  successScore: number;
  almostCorrectScore: number;
};
