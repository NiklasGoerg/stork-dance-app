export type SkeletonVisualMode = "neutral" | "successPulse" | "trackingLimited";

export type BeatSkeletonFeedbackResult = "passed" | "failed" | "notEvaluable";

export type BeatSkeletonFeedbackEvent = {
  evaluationId: string;
  flowId: string;
  flowStepId: string;
  measureIndex: number;
  beatIndex: number;
  result: BeatSkeletonFeedbackResult;
  pulseDurationMs?: number;
};

export const SKELETON_SUCCESS_PULSE_DURATION_MS = 450;

export const SKELETON_VISUAL_CONFIG = {
  innerColor: "#172033",
  innerSuccessColor: "#43d17a",
  outerNeutralColor: "#ffffff",
  outerLineWidth: 7,
  innerLineWidth: 4,
  outerJointRadius: 6,
  innerJointRadius: 4,
  outerHeadLineWidth: 5,
  innerHeadLineWidth: 3,
  pulseAdditionalLineWidth: 0.5,
  pulseAdditionalJointRadius: 0.35,
  pulseGlowBlur: 0,
  trackingLimitedOpacity: 0.48,
  successPulseDurationMs: SKELETON_SUCCESS_PULSE_DURATION_MS,
} as const;
