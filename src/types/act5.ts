import type {
  ClimateMovementFlowStep,
  ClimateSeason,
  ClimateSeasonDataRow,
} from "~/types/climate";
import type {
  MovementBeatEvaluationLike,
  MovementMeasureEvaluation,
  MovementMeasureResult,
} from "~/types/movement";
import type { PoseLandmarkLike } from "~/types/pose";

export type Act5FeedbackCategory =
  | "tracking"
  | "startPose"
  | "direction"
  | "intensity"
  | "form"
  | "returnPose"
  | "timing"
  | "generic";

export type Act5BodyRegion =
  "fullBody" | "upperBody" | "hands" | "lowerBody" | null;

export type Act5FeedbackSignal<TCode extends string = string> = {
  code: TCode;
  category: Act5FeedbackCategory;
  season: ClimateSeason;
  beat: number | null;
  measureIndex: number | null;
  criterionId: string | null;
  bodyRegion: Act5BodyRegion;
  essential: boolean;
  evaluable: boolean;
  confidence: number;
  severity: number;
  evidence?: Record<string, unknown>;
};

export type Act5SelectedFeedback<TCode extends string = string> = {
  code: TCode;
  category: Act5FeedbackCategory;
  season: ClimateSeason;
  bodyRegion: Act5BodyRegion;
  narrationCue: string | null;
  evidence: {
    measureCount: number;
    beatCount: number;
    confidence: number;
    severity: number;
    criterionIds: readonly string[];
    severeTracking: boolean;
  };
};

export type Act5CriterionFeedbackMetadata = {
  category: Act5FeedbackCategory;
  bodyRegion: Act5BodyRegion;
  priority: number;
  trackingCode?: string;
  optionalLowerBody?: boolean;
};

export type Act5FeedbackCriterionLike<TCode extends string = string> = {
  id: string;
  status: "passed" | "failed" | "notEvaluable";
  passed: boolean;
  importance: "essential" | "supporting";
  feedbackCode?: TCode;
  debugValue?: number | string;
  expectedRange?: string;
};

export type Act5FeedbackBeatEvaluationLike<TCode extends string = string> = {
  beat: number;
  measureIndex?: number | null;
  score: number;
  passed: boolean;
  trackingUnavailable: boolean;
  criteria: Act5FeedbackCriterionLike<TCode>[];
  feedbackCode?: TCode;
  feedbackSignals?: Act5FeedbackSignal<TCode>[];
  metrics?: {
    landmarkConfidence?: string;
  };
};

export type Act5FeedbackSelectionOptions<TCode extends string = string> = {
  season: ClimateSeason;
  beatEvaluations: Act5FeedbackBeatEvaluationLike<TCode>[];
  codeMetadata: Partial<Record<TCode | string, Act5CriterionFeedbackMetadata>>;
  criterionMetadata?: Partial<Record<string, Act5CriterionFeedbackMetadata>>;
  fallbackCode: TCode;
};

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
  | "tutorialExplanation"
  | "tutorialCompleted"
  | "storyIntro"
  | "storyReferencePreview"
  | "storyReferenceComplete"
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

export type Act5TutorialNarrationState = {
  cueId: string | null;
  textKey: string;
  targetIndex: number | null;
  params: Record<string, string | number>;
};

export type Act5StoryNarrationPhase =
  | "idle"
  | "story-intro"
  | "target-preview"
  | "reference-preview"
  | "reference-complete";

export type Act5StoryNarrationState = {
  phase: Act5StoryNarrationPhase;
  cueId: string | null;
  textKey: string;
  targetIndex: number | null;
  params: Record<string, string | number>;
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
  feedbackSelection: Act5SelectedFeedback | null;
  feedbackSignals: Act5FeedbackSignal[];
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
  primaryFeedbackCode?: string;
  selectedFeedback?: Act5SelectedFeedback;
};

export type Act5RecognitionFrame = {
  landmarks: PoseLandmarkLike[] | null;
  playbackState: "idle" | "countdown" | "playing" | "paused" | "completed";
  seasonId: string;
  seasonElapsedMs: number;
  repetitionIndex: number | null;
  isTransition: boolean;
  evaluationEnabled?: boolean;
  autoProgressEnabled?: boolean;
};

export type Act5RecognitionMeasureEvaluation = MovementMeasureEvaluation<
  MovementBeatEvaluationLike,
  string
>;

export type Act5InfoInstruction = {
  beat: number;
  text: string;
  active: boolean;
};

export type Act5InfoTone =
  "instruction" | "neutral" | "excellent" | "success" | "error" | "warning";

export type Act5InfoCardMode =
  | "seasonPreview"
  | "tutorialExplanation"
  | "storyNarration"
  | "activeMovement"
  | "periodTransition"
  | "completed";

export type Act5InfoCardModel = {
  mode: Act5InfoCardMode;
  seasonLabel: string;
  movementPercentLabel: string;
  periodLabel: string;
  temperature: {
    valueLabel: string;
    baselineLabel?: string;
    isBaseline: boolean;
  };
  instructions: Act5InfoInstruction[];
  feedback?: {
    text: string;
    tone: Act5InfoTone;
  };
  subtitle?: string;
  completion?: {
    title: string;
    subtitle?: string;
  };
  periodTransition?: {
    previousPeriod: string;
    nextPeriod: string;
  };
};

export type Act5ClimateChartSequenceStatus = Act5SequenceStatus;

export type Act5ClimateChartPeriodTransition = {
  previousPeriod: string;
  nextPeriod: string;
};

export type Act5ClimateChartMeasureEvaluation = {
  measureIndex: number;
  result: MovementMeasureResult;
};

export type Act5ClimateProgressChartProps = {
  rows: ClimateSeasonDataRow[];
  phase: Act5Phase | "idle";
  flowId: Act5FlowId | null;
  sequenceStatus: Act5ClimateChartSequenceStatus;
  activeStep: ClimateMovementFlowStep | null;
  activeTargetIndex: number;
  attemptNumber: number;
  completedStepIds: string[];
  periodTransition: Act5ClimateChartPeriodTransition | null;
  measureEvaluations: Act5ClimateChartMeasureEvaluation[];
  requiredSuccessfulRepetitions: number;
};
