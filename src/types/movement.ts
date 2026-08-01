import type {
  PoseLandmark,
  RecordedMovement,
  RecordedPoseFrame,
} from "~/story/types";
import type { PoseLandmarkLike } from "~/types/pose";

export type AvatarSourceMode = "live-camera" | "recorded-motion";

export type MovementStageLandmark = PoseLandmark;

export type LandmarkFrame = RecordedPoseFrame;

export type MovementRecording = RecordedMovement;

export type MovementRecognitionPhase =
  | "idle"
  | "demonstrating"
  | "preparing"
  | "performing"
  | "evaluating"
  | "showingFeedback"
  | "retrying"
  | "completed";

export type MovementCriterionStatus = "passed" | "failed" | "notEvaluable";
export type MovementCriterionImportance = "essential" | "supporting";

export type MovementCriterionLike<TFeedback extends string = string> = {
  id: string;
  label: string;
  status: MovementCriterionStatus;
  passed: boolean;
  importance: MovementCriterionImportance;
  feedbackCode?: TFeedback;
};

export type MovementBeatEvaluationLike<
  TBeat extends number = number,
  TMetrics = unknown,
  TFeedback extends string = string,
> = {
  beat: TBeat;
  measureIndex?: number | null;
  score: number;
  passed: boolean;
  trackingUnavailable: boolean;
  criteria: MovementCriterionLike<TFeedback>[];
  timestamp: number;
  feedbackCode?: TFeedback;
  feedbackSignals?: unknown[];
  metrics: TMetrics;
};

export type MovementMeasureResult =
  | "success"
  | "almostCorrect"
  | "failed"
  | "trackingUnavailable"
  | "autoProgress";

export type MovementMeasureEvaluation<
  TBeatEvaluation extends MovementBeatEvaluationLike,
  TFeedback extends string,
> = {
  measureIndex: number;
  cycleIndex: number;
  result: MovementMeasureResult;
  score: number;
  beatEvaluations: TBeatEvaluation[];
  primaryFeedbackCode?: TFeedback;
};

export type BeatWindowAttemptRules = {
  measuresPerValue?: number;
  requiredSuccessfulMeasures?: number;
};

export type MovementSequenceEvaluationLike<
  TBeatEvaluation extends MovementBeatEvaluationLike,
  TFeedback extends string,
> = {
  passed: boolean;
  resultState: string;
  totalScore: number;
  beatEvaluations: TBeatEvaluation[];
  feedbackCode?: TFeedback;
  primaryFeedbackCode?: TFeedback;
};

export type UseBeatWindowMovementRecognitionOptions<
  TBeat extends number,
  TValue extends string,
  TMetrics,
  TFeedback extends string,
  TBeatEvaluation extends MovementBeatEvaluationLike<
    TBeat,
    TMetrics,
    TFeedback
  >,
  TSequenceEvaluation extends MovementSequenceEvaluationLike<
    TBeatEvaluation,
    TFeedback
  >,
> = {
  seasonId: string;
  defaultValue: TValue;
  beatTargetsMs: Record<TBeat, number>;
  beats: TBeat[];
  evaluationWindowMs: number;
  variationDurationMs: number;
  measuresPerValue: number;
  requiredSuccessfulMeasures?: number;
  createEmptyMetrics: () => TMetrics;
  evaluateBeat: (params: {
    landmarks: PoseLandmarkLike[] | null;
    beat: TBeat;
    timestamp: number;
    measureIndex: number;
    value: TValue;
  }) => TBeatEvaluation;
  evaluateSequence: (
    beatEvaluations: TBeatEvaluation[],
    value: TValue,
  ) => TSequenceEvaluation;
  getMeasureResult: (evaluation: TSequenceEvaluation) => MovementMeasureResult;
  getPrimaryMeasureFeedbackCode: (
    beatEvaluations: TBeatEvaluation[],
    fallbackCode?: TFeedback,
  ) => TFeedback | undefined;
  isMeasureSuccessfulForStreak?: (
    result: MovementMeasureResult,
    evaluation: TSequenceEvaluation,
  ) => boolean;
  onPreparationFrame?: (landmarks: PoseLandmarkLike[] | null) => void;
  onBeforeAttemptReset?: () => void;
  onBeatFinalized?: (evaluation: TBeatEvaluation, measureIndex: number) => void;
  adaptFinalSequenceEvaluation?: (params: {
    evaluation: TSequenceEvaluation;
    reachedRequiredStreak: boolean;
  }) => TSequenceEvaluation;
};
