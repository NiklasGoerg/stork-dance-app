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

export type Act4FeedbackCategory =
  | "tracking"
  | "startPose"
  | "direction"
  | "intensity"
  | "form"
  | "returnPose"
  | "timing"
  | "generic";

export type Act4BodyRegion =
  "fullBody" | "upperBody" | "hands" | "lowerBody" | null;

export type Act4FeedbackSignal<TCode extends string = string> = {
  code: TCode;
  category: Act4FeedbackCategory;
  season: ClimateSeason;
  beat: number | null;
  measureIndex: number | null;
  criterionId: string | null;
  bodyRegion: Act4BodyRegion;
  essential: boolean;
  evaluable: boolean;
  confidence: number;
  severity: number;
  evidence?: Record<string, unknown>;
};

export type Act4SelectedFeedback<TCode extends string = string> = {
  code: TCode;
  category: Act4FeedbackCategory;
  season: ClimateSeason;
  bodyRegion: Act4BodyRegion;
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

export type Act4CriterionFeedbackMetadata = {
  category: Act4FeedbackCategory;
  bodyRegion: Act4BodyRegion;
  priority: number;
  trackingCode?: string;
  optionalLowerBody?: boolean;
};

export type Act4FeedbackCriterionLike<TCode extends string = string> = {
  id: string;
  status: "passed" | "failed" | "notEvaluable";
  passed: boolean;
  importance: "essential" | "supporting";
  feedbackCode?: TCode;
  debugValue?: number | string;
  expectedRange?: string;
};

export type Act4FeedbackBeatEvaluationLike<TCode extends string = string> = {
  beat: number;
  measureIndex?: number | null;
  score: number;
  passed: boolean;
  trackingUnavailable: boolean;
  criteria: Act4FeedbackCriterionLike<TCode>[];
  feedbackCode?: TCode;
  feedbackSignals?: Act4FeedbackSignal<TCode>[];
  metrics?: {
    landmarkConfidence?: string;
  };
};

export type Act4FeedbackSelectionOptions<TCode extends string = string> = {
  season: ClimateSeason;
  beatEvaluations: Act4FeedbackBeatEvaluationLike<TCode>[];
  codeMetadata: Partial<Record<TCode | string, Act4CriterionFeedbackMetadata>>;
  criterionMetadata?: Partial<Record<string, Act4CriterionFeedbackMetadata>>;
  fallbackCode: TCode;
};

export type Act4LifecycleStatus =
  "idle" | "initializing" | "running" | "paused" | "completed" | "error";

export type Act4Phase = "tutorial" | "climateStory" | "completed";
export type Act4DisplayPhase = Act4Phase | "idle";
export type Act4FlowId = "act4Full" | "act4Story" | "act4TutorialDebug";
export type Act4FlowContext = "tutorial" | "climateStory";
export type Act4TutorialTarget = "maximum" | "minimum";
export type Act4EncodingId =
  "circleRadius" | "horizontalArcExtent" | "bodyHeight" | "verticalArcExtent";

export type Act4SequenceStatus =
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
  id: Act4EncodingId;
  tutorialTitleKey: string;
  tutorialExplanationKey: string;
  maximumExplanationKey: string;
  minimumExplanationKey: string;
  actionNounKey: string;
};

export type Act4SequenceTarget = {
  id: string;
  context: Act4FlowContext;
  season: ClimateSeason;
  movementValue: number;
  target?: Act4TutorialTarget;
  interval?: string;
  climateData?: ClimateMovementFlowStep;
  encoding: MovementEncodingDefinition;
  rules: MovementAttemptRules;
};

export type Act4SeasonStep = Act4SequenceTarget & {
  type: "season";
};

export type Act4PeriodTransition = {
  previousPeriod: string;
  nextPeriod: string;
};

export type Act4PeriodTransitionStep = {
  id: string;
  type: "periodTransition";
  context: "climateStory";
  transition: Act4PeriodTransition;
};

export type Act4CompletionStep = {
  id: "act4-completion";
  type: "completion";
};

export type Act4SequenceStep =
  Act4SeasonStep | Act4PeriodTransitionStep | Act4CompletionStep;

export type Act4AttemptState = {
  attemptNumber: number;
  handledEvaluationKey: string;
  retryPreviewFeedbackText: string;
};

export type Act4TutorialNarrationState = {
  cueId: string | null;
  textKey: string;
  targetIndex: number | null;
  params: Record<string, string | number>;
};

export type Act4StoryNarrationPhase =
  | "idle"
  | "story-intro"
  | "target-preview"
  | "reference-preview"
  | "reference-complete";

export type Act4StoryNarrationState = {
  phase: Act4StoryNarrationPhase;
  cueId: string | null;
  textKey: string;
  targetIndex: number | null;
  params: Record<string, string | number>;
};

export type Act4FeedbackState = {
  visibleMeasureFeedbackId: string | null;
  visibleMeasureResult: MovementMeasureResult | null;
  visibleFeedbackCode: string | null;
  visibleFeedbackText: string;
  visibleMeasureIndex: number | null;
};

export type Act4DebugState = {
  enabled: boolean;
  autoProgressEnabled: boolean;
  feedbackSelection: Act4SelectedFeedback | null;
  feedbackSignals: Act4FeedbackSignal[];
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

export type Act4RecognitionSequenceEvaluation = {
  passed: boolean;
  resultState: string;
  totalScore: number;
  feedbackCode?: string;
  primaryFeedbackCode?: string;
  selectedFeedback?: Act4SelectedFeedback;
};

export type Act4RecognitionFrame = {
  landmarks: PoseLandmarkLike[] | null;
  playbackState: "idle" | "countdown" | "playing" | "paused" | "completed";
  seasonId: string;
  seasonElapsedMs: number;
  repetitionIndex: number | null;
  isTransition: boolean;
  evaluationEnabled?: boolean;
  autoProgressEnabled?: boolean;
};

export type Act4RecognitionMeasureEvaluation = MovementMeasureEvaluation<
  MovementBeatEvaluationLike,
  string
>;

export type Act4InfoInstruction = {
  beat: number;
  text: string;
  active: boolean;
};

export type Act4InfoTone =
  "instruction" | "neutral" | "excellent" | "success" | "error" | "warning";

export type Act4InfoCardMode =
  | "seasonPreview"
  | "tutorialExplanation"
  | "storyNarration"
  | "activeMovement"
  | "periodTransition"
  | "completed";

export type Act4InfoCardModel = {
  mode: Act4InfoCardMode;
  seasonLabel: string;
  movementPercentLabel: string;
  periodLabel: string;
  temperature: {
    valueLabel: string;
    baselineLabel?: string;
    isBaseline: boolean;
  };
  instructions: Act4InfoInstruction[];
  feedback?: {
    text: string;
    tone: Act4InfoTone;
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

export type Act4ClimateChartSequenceStatus = Act4SequenceStatus;

export type Act4ClimateChartPeriodTransition = {
  previousPeriod: string;
  nextPeriod: string;
};

export type Act4ClimateChartMeasureEvaluation = {
  measureIndex: number;
  result: MovementMeasureResult;
};

export type Act4ClimateProgressChartProps = {
  rows: ClimateSeasonDataRow[];
  phase: Act4Phase | "idle";
  flowId: Act4FlowId | null;
  sequenceStatus: Act4ClimateChartSequenceStatus;
  activeStep: ClimateMovementFlowStep | null;
  activeTargetIndex: number;
  attemptNumber: number;
  completedStepIds: string[];
  periodTransition: Act4ClimateChartPeriodTransition | null;
  measureEvaluations: Act4ClimateChartMeasureEvaluation[];
  requiredSuccessfulRepetitions: number;
};
