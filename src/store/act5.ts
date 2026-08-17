import { defineStore } from "pinia";
import type {
  Act5AttemptState,
  Act5DebugState,
  Act5DisplayPhase,
  Act5FeedbackState,
  Act5FlowId,
  Act5SequenceStatus,
  Act5LifecycleStatus,
  Act5PeriodTransition,
  Act5SequenceTarget,
  Act5StoryNarrationPhase,
  Act5StoryNarrationState,
  Act5TutorialNarrationState,
} from "~/types/act5";

type Act5State = {
  lifecycleStatus: Act5LifecycleStatus;
  sequenceStatus: Act5SequenceStatus;
  flowId: Act5FlowId | null;
  targets: Act5SequenceTarget[];
  currentTargetIndex: number;
  completedStepIds: string[];
  periodTransition: Act5PeriodTransition | null;
  tutorialNarration: Act5TutorialNarrationState;
  storyNarration: Act5StoryNarrationState;
  attempt: Act5AttemptState;
  feedback: Act5FeedbackState;
  debug: Act5DebugState;
  errorMessage: string;
};

const getInitialAttemptState = (): Act5AttemptState => ({
  attemptNumber: 0,
  handledEvaluationKey: "",
  retryPreviewFeedbackText: "",
});

const getInitialFeedbackState = (): Act5FeedbackState => ({
  visibleMeasureFeedbackId: null,
  visibleMeasureResult: null,
  visibleFeedbackCode: null,
  visibleFeedbackText: "",
  visibleMeasureIndex: null,
});

const getInitialTutorialNarrationState = (): Act5TutorialNarrationState => ({
  cueId: null,
  textKey: "",
  targetIndex: null,
  params: {},
});

const getInitialStoryNarrationState = (): Act5StoryNarrationState => ({
  phase: "idle",
  cueId: null,
  textKey: "",
  targetIndex: null,
  params: {},
});

const getInitialDebugState = (): Act5DebugState => ({
  enabled: false,
  autoProgressEnabled: false,
  feedbackSelection: null,
  feedbackSignals: [],
});

const getInitialState = (): Act5State => ({
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

export const useAct5Store = defineStore("act5", {
  state: getInitialState,
  getters: {
    currentTarget: (state) => state.targets[state.currentTargetIndex] ?? null,
    currentSeason: (state) =>
      state.targets[state.currentTargetIndex]?.season ?? null,
    phase: (state): Act5DisplayPhase => {
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
    }: Pick<Act5DebugState, "feedbackSelection" | "feedbackSignals">) {
      this.debug.feedbackSelection = feedbackSelection;
      this.debug.feedbackSignals = feedbackSignals;
    },
    startFlow(flowId: Act5FlowId, targets: Act5SequenceTarget[]) {
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
    setLifecycleStatus(status: Act5LifecycleStatus) {
      this.lifecycleStatus = status;
    },
    setSequenceStatus(status: Act5SequenceStatus) {
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
      phase: Act5StoryNarrationPhase;
      status: Extract<
        Act5SequenceStatus,
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
      result: Act5FeedbackState["visibleMeasureResult"];
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
    enterPeriodTransition(transition: Act5PeriodTransition) {
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
