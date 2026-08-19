import { defineStore } from "pinia";
import type {
  Act4AttemptState,
  Act4DebugState,
  Act4DisplayPhase,
  Act4FeedbackState,
  Act4FlowId,
  Act4SequenceStatus,
  Act4LifecycleStatus,
  Act4PeriodTransition,
  Act4SequenceTarget,
  Act4StoryNarrationPhase,
  Act4StoryNarrationState,
  Act4TutorialNarrationState,
} from "~/types/act4";

type Act4State = {
  lifecycleStatus: Act4LifecycleStatus;
  sequenceStatus: Act4SequenceStatus;
  flowId: Act4FlowId | null;
  targets: Act4SequenceTarget[];
  currentTargetIndex: number;
  completedStepIds: string[];
  periodTransition: Act4PeriodTransition | null;
  tutorialNarration: Act4TutorialNarrationState;
  storyNarration: Act4StoryNarrationState;
  attempt: Act4AttemptState;
  feedback: Act4FeedbackState;
  debug: Act4DebugState;
  errorMessage: string;
};

const getInitialAttemptState = (): Act4AttemptState => ({
  attemptNumber: 0,
  handledEvaluationKey: "",
  retryPreviewFeedbackText: "",
});

const getInitialFeedbackState = (): Act4FeedbackState => ({
  visibleMeasureFeedbackId: null,
  visibleMeasureResult: null,
  visibleFeedbackCode: null,
  visibleFeedbackText: "",
  visibleMeasureIndex: null,
});

const getInitialTutorialNarrationState = (): Act4TutorialNarrationState => ({
  cueId: null,
  textKey: "",
  targetIndex: null,
  params: {},
});

const getInitialStoryNarrationState = (): Act4StoryNarrationState => ({
  phase: "idle",
  cueId: null,
  textKey: "",
  targetIndex: null,
  params: {},
});

const getInitialDebugState = (): Act4DebugState => ({
  enabled: false,
  autoProgressEnabled: false,
  feedbackSelection: null,
  feedbackSignals: [],
});

const getInitialState = (): Act4State => ({
  lifecycleStatus: "idle",
  sequenceStatus: "idle",
  flowId: null,
  targets: [],
  currentTargetIndex: 0,
  completedStepIds: [],
  periodTransition: null,
  tutorialNarration: getInitialTutorialNarrationState(),
  storyNarration: getInitialStoryNarrationState(),
  attempt: getInitialAttemptState(),
  feedback: getInitialFeedbackState(),
  debug: getInitialDebugState(),
  errorMessage: "",
});

export const useAct4Store = defineStore("act4", {
  state: getInitialState,
  getters: {
    currentTarget: (state) => state.targets[state.currentTargetIndex] ?? null,
    currentSeason: (state) =>
      state.targets[state.currentTargetIndex]?.season ?? null,
    phase: (state): Act4DisplayPhase => {
      if (state.sequenceStatus === "completed") return "completed";

      const target = state.targets[state.currentTargetIndex] ?? null;

      return target?.context ?? "idle";
    },
    isCompleted: (state) =>
      state.lifecycleStatus === "completed" ||
      state.sequenceStatus === "completed",
    isFlowActive: (state) => state.flowId !== null,
    currentRequiredSuccessfulMeasures: (state) =>
      state.targets[state.currentTargetIndex]?.rules
        .requiredSuccessfulMeasures ?? 2,
    completedStepIdSet: (state) => new Set(state.completedStepIds),
    climateCompletedStepIds: (state) =>
      state.completedStepIds.filter((stepId) =>
        state.targets.some(
          (target) =>
            target.context === "climateStory" &&
            (target.climateData?.id ?? target.id) === stepId,
        ),
      ),
  },
  actions: {
    setDebugEnabled(enabled: boolean) {
      this.debug.enabled = enabled;
      if (!enabled) this.debug.autoProgressEnabled = false;
    },
    setAutoProgressEnabled(enabled: boolean) {
      this.debug.autoProgressEnabled = this.debug.enabled && enabled;
    },
    setFeedbackDiagnostics({
      feedbackSelection,
      feedbackSignals,
    }: Pick<Act4DebugState, "feedbackSelection" | "feedbackSignals">) {
      this.debug.feedbackSelection = feedbackSelection;
      this.debug.feedbackSignals = feedbackSignals;
    },
    startFlow(flowId: Act4FlowId, targets: Act4SequenceTarget[]) {
      this.lifecycleStatus = "running";
      this.sequenceStatus = "countdown";
      this.flowId = flowId;
      this.targets = targets;
      this.currentTargetIndex = 0;
      this.completedStepIds = [];
      this.periodTransition = null;
      this.tutorialNarration = getInitialTutorialNarrationState();
      this.storyNarration = getInitialStoryNarrationState();
      this.attempt = getInitialAttemptState();
      this.feedback = getInitialFeedbackState();
      this.debug.feedbackSelection = null;
      this.debug.feedbackSignals = [];
      this.errorMessage = "";
    },
    startTarget(targetIndex: number) {
      this.currentTargetIndex = targetIndex;
      this.sequenceStatus = "performing";
      this.periodTransition = null;
      this.tutorialNarration = getInitialTutorialNarrationState();
      this.storyNarration = getInitialStoryNarrationState();
      this.attempt.attemptNumber += 1;
      this.attempt.handledEvaluationKey = "";
      this.feedback = getInitialFeedbackState();
      this.debug.feedbackSelection = null;
      this.debug.feedbackSignals = [];
    },
    setLifecycleStatus(status: Act4LifecycleStatus) {
      this.lifecycleStatus = status;
    },
    setSequenceStatus(status: Act4SequenceStatus) {
      this.sequenceStatus = status;
    },
    enterTutorialExplanation({
      targetIndex,
      cueId,
      textKey,
      params = {},
    }: {
      targetIndex: number;
      cueId: string;
      textKey: string;
      params?: Record<string, string | number>;
    }) {
      this.currentTargetIndex = targetIndex;
      this.sequenceStatus = "tutorialExplanation";
      this.periodTransition = null;
      this.tutorialNarration = {
        cueId,
        textKey,
        targetIndex,
        params,
      };
      this.feedback = getInitialFeedbackState();
    },
    clearTutorialNarration() {
      this.tutorialNarration = getInitialTutorialNarrationState();
    },
    enterStoryNarration({
      phase,
      status,
      targetIndex,
      cueId,
      textKey,
      params = {},
    }: {
      phase: Act4StoryNarrationPhase;
      status: Extract<
        Act4SequenceStatus,
        "storyIntro" | "storyReferencePreview" | "storyReferenceComplete"
      >;
      targetIndex: number | null;
      cueId: string;
      textKey: string;
      params?: Record<string, string | number>;
    }) {
      if (targetIndex !== null) {
        this.currentTargetIndex = targetIndex;
      }
      this.sequenceStatus = status;
      this.periodTransition = null;
      this.storyNarration = {
        phase,
        cueId,
        textKey,
        targetIndex,
        params,
      };
      this.feedback = getInitialFeedbackState();
    },
    setTargetStoryNarration({
      targetIndex,
      cueId,
      textKey,
      params = {},
    }: {
      targetIndex: number;
      cueId: string;
      textKey: string;
      params?: Record<string, string | number>;
    }) {
      if (targetIndex !== this.currentTargetIndex) return;

      this.storyNarration = {
        phase: "target-preview",
        cueId,
        textKey,
        targetIndex,
        params,
      };
    },
    clearStoryNarration() {
      this.storyNarration = getInitialStoryNarrationState();
    },
    markCurrentTargetCompleted() {
      const target = this.targets[this.currentTargetIndex] ?? null;
      const completedStepId = target?.climateData?.id ?? target?.id;

      if (!completedStepId || this.completedStepIds.includes(completedStepId)) {
        return;
      }

      this.completedStepIds = [...this.completedStepIds, completedStepId];
    },
    markAllClimateTargetsCompleted() {
      this.completedStepIds = [
        ...new Set([
          ...this.completedStepIds,
          ...this.targets
            .filter((target) => target.context === "climateStory")
            .map((target) => target.climateData?.id ?? target.id),
        ]),
      ];
    },
    setHandledEvaluationKey(key: string) {
      this.attempt.handledEvaluationKey = key;
    },
    setRetryPreviewFeedbackText(text: string) {
      this.attempt.retryPreviewFeedbackText = text;
    },
    setMeasureFeedback({
      measureId,
      measureIndex,
      result,
      feedbackCode,
      text,
    }: {
      measureId: string;
      measureIndex: number;
      result: Act4FeedbackState["visibleMeasureResult"];
      feedbackCode: string | null;
      text: string;
    }) {
      this.feedback = {
        visibleMeasureFeedbackId: measureId,
        visibleMeasureIndex: measureIndex,
        visibleMeasureResult: result,
        visibleFeedbackCode: feedbackCode,
        visibleFeedbackText: text,
      };
    },
    clearFeedback() {
      this.feedback = getInitialFeedbackState();
    },
    enterPeriodTransition(transition: Act4PeriodTransition) {
      this.sequenceStatus = "periodTransition";
      this.periodTransition = transition;
      this.storyNarration = getInitialStoryNarrationState();
      this.attempt.handledEvaluationKey = "";
      this.feedback = getInitialFeedbackState();
    },
    completeFlow() {
      this.lifecycleStatus = "completed";
      this.sequenceStatus = "completed";
      this.periodTransition = null;
      this.tutorialNarration = getInitialTutorialNarrationState();
      this.storyNarration = getInitialStoryNarrationState();
      this.attempt.retryPreviewFeedbackText = "";
      this.feedback = getInitialFeedbackState();
      this.markAllClimateTargetsCompleted();
    },
    pause() {
      if (this.lifecycleStatus === "running") {
        this.lifecycleStatus = "paused";
      }
    },
    resume() {
      if (this.lifecycleStatus === "paused") {
        this.lifecycleStatus = "running";
      }
    },
    resetFlowState() {
      const debug = {
        ...this.debug,
        feedbackSelection: null,
        feedbackSignals: [],
      };

      Object.assign(this, getInitialState(), {
        debug,
      });
    },
    setError(message: string) {
      this.lifecycleStatus = "error";
      this.errorMessage = message;
    },
  },
});
