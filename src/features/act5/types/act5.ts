import type {
  ClimateMovementFlowStep,
  ClimateSeason,
} from "~/utils/movement/acts/climate/climateSeasonData";
import type {
  MovementMeasureResult,
  MovementMeasureEvaluation,
  MovementBeatEvaluationLike,
} from "~/composables/useBeatWindowMovementRecognition";

export type Act5LifecycleStatus =
  "idle" | "initializing" | "running" | "paused" | "completed" | "error";

export type Act5Phase = "tutorial" | "climateStory" | "completed";
export type Act5DisplayPhase = Act5Phase | "idle";
export type Act5FlowId = "act5Full" | "act5Story" | "act5TutorialDebug";
export type Act5FlowContext = "tutorial" | "climateStory";
export type Act5TutorialTarget = "maximum" | "minimum";
export type Act5EncodingId =
  "circleRadius" | "horizontalArcExtent" | "bodyHeight" | "verticalArcExtent";

export type Act5SequenceStatus =
  | "idle"
  | "countdown"
  | "preview"
  | "performing"
  | "evaluating"
  | "retryInterlude"
  | "periodTransition"
  | "completed";

export type MovementAttemptRules = {
  measuresPerStep: number;
  requiredSuccessfulMeasures: number;
  retryUntilSuccess: boolean;
  feedbackInterludeBeats: number;
};

export type MovementEncodingDefinition = {
  id: Act5EncodingId;
  tutorialTitleKey: string;
  tutorialExplanationKey: string;
  maximumExplanationKey: string;
  minimumExplanationKey: string;
  actionNounKey: string;
};

export type Act5SequenceTarget = {
  id: string;
  context: Act5FlowContext;
  season: ClimateSeason;
  movementValue: number;
  target?: Act5TutorialTarget;
  interval?: string;
  climateData?: ClimateMovementFlowStep;
  encoding: MovementEncodingDefinition;
  rules: MovementAttemptRules;
};

export type Act5SeasonStep = Act5SequenceTarget & {
  type: "season";
};

export type Act5PeriodTransition = {
  previousPeriod: string;
  nextPeriod: string;
};

export type Act5PeriodTransitionStep = {
  id: string;
  type: "periodTransition";
  context: "climateStory";
  transition: Act5PeriodTransition;
};

export type Act5CompletionStep = {
  id: "act5-completion";
  type: "completion";
};

export type Act5SequenceStep =
  Act5SeasonStep | Act5PeriodTransitionStep | Act5CompletionStep;

export type Act5AttemptState = {
  attemptNumber: number;
  handledEvaluationKey: string;
  retryPreviewFeedbackText: string;
};

export type Act5FeedbackState = {
  visibleMeasureFeedbackId: string | null;
  visibleMeasureResult: MovementMeasureResult | null;
  visibleFeedbackCode: string | null;
  visibleFeedbackText: string;
  visibleMeasureIndex: number | null;
};

export type Act5DebugState = {
  enabled: boolean;
  autoProgressEnabled: boolean;
};

export type MovementCriterionResult<TFeedbackCode extends string = string> = {
  id: string;
  label: string;
  status: "passed" | "failed" | "notEvaluable";
  passed: boolean;
  score: number;
  importance: "essential" | "supporting";
  feedbackCode?: TFeedbackCode;
};

export type MovementRecognitionResult<TFeedbackCode extends string = string> = {
  passed: boolean;
  score: number;
  status:
    | "success"
    | "almostCorrect"
    | "failed"
    | "trackingUnavailable"
    | "autoProgress";
  feedbackCode: TFeedbackCode | null;
  criteria: MovementCriterionResult<TFeedbackCode>[];
};

export type Act5RecognitionSequenceEvaluation = {
  passed: boolean;
  resultState: string;
  totalScore: number;
  feedbackCode?: string;
};

export type Act5RecognitionMeasureEvaluation = MovementMeasureEvaluation<
  MovementBeatEvaluationLike,
  string
>;
