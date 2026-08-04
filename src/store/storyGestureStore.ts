import { defineStore } from "pinia";
import {
  getStoryGestureDefinition,
  type GestureInteractionState,
  type StoryGestureId,
} from "~/story/gestures";
import type { MigrationGestureEvaluationResult } from "~/types/migrationAct";

type GestureMovementPlaybackSource = "none" | "recorded";
export type StoryGestureResult =
  "completed" | "continued" | "cancelled" | "error";

export type GestureSessionDiagnostics = {
  audioTransportTimeMs: number;
  movementScheduledStartMs: number | null;
  movementSourceTimeMs: number;
  recognitionSourceTimeMs: number;
  currentCheckpointId: string | null;
  checkpointTargetSourceTimeMs: number | null;
  checkpointWindowStartMs: number | null;
  checkpointWindowEndMs: number | null;
  poseSampleTimestampMs: number | null;
  samplesInWindow: number;
  validSamplesInWindow: number;
  selectedBestSampleTimestampMs: number | null;
  baselineShoulderCenterY: number | null;
  baselineHipCenterY: number | null;
  baselineTorsoLength: number | null;
};

type GestureControlRequest = "success" | "retry" | null;

const emptyDiagnostics = (): GestureSessionDiagnostics => ({
  audioTransportTimeMs: 0,
  movementScheduledStartMs: null,
  movementSourceTimeMs: 0,
  recognitionSourceTimeMs: 0,
  currentCheckpointId: null,
  checkpointTargetSourceTimeMs: null,
  checkpointWindowStartMs: null,
  checkpointWindowEndMs: null,
  poseSampleTimestampMs: null,
  samplesInWindow: 0,
  validSamplesInWindow: 0,
  selectedBestSampleTimestampMs: null,
  baselineShoulderCenterY: null,
  baselineHipCenterY: null,
  baselineTorsoLength: null,
});

const initialState = () => ({
  activeGestureId: null as StoryGestureId | null,
  state: "inactive" as GestureInteractionState,
  attemptCount: 0,
  startedAt: null as number | null,
  movementPlaybackSource: "none" as GestureMovementPlaybackSource,
  movementLoaded: false,
  movementLoadError: null as string | null,
  currentSourceTimeMs: 0,
  countdownNumber: null as number | null,
  latestEvaluationResult: null as MigrationGestureEvaluationResult | null,
  canContinue: false,
  controlRequest: null as GestureControlRequest,
  diagnostics: emptyDiagnostics(),
});

let completionResolver: ((result: StoryGestureResult) => void) | null = null;

const translate = (key: string, params: Record<string, string | number> = {}) =>
  String(useNuxtApp().$i18n.t(key, params));

export const useStoryGestureStore = defineStore("storyGesture", {
  state: initialState,
  getters: {
    isActive: (state) => state.state !== "inactive",
    activeGesture: (state) =>
      state.activeGestureId
        ? getStoryGestureDefinition(state.activeGestureId)
        : null,
    gesturePhase: (state): "countdown" | "attempt" | "feedback" | "idle" => {
      if (state.state === "waiting-for-lead-in") return "countdown";
      if (state.state === "attempt-playing") return "attempt";
      if (state.state === "retry-scheduled" || state.state === "success-exit") {
        return "feedback";
      }
      return "idle";
    },
    isEvaluationFeedbackVisible: (state) =>
      Boolean(state.latestEvaluationResult) &&
      (state.state === "retry-scheduled" || state.state === "success-exit"),
    feedbackText: (state) => {
      if (!state.activeGestureId) return "";
      if (state.state === "loading-movement") {
        return translate("gestures.feedback.loading");
      }
      if (state.state === "waiting-for-lead-in") {
        return translate("gestures.feedback.countdown", {
          gesture: translate(`gestures.${state.activeGestureId}.label`),
          count: state.countdownNumber ?? 4,
        });
      }
      if (state.state === "retry-scheduled") {
        return translate("gestures.feedback.tryAgain");
      }
      if (state.state === "success-exit") {
        return translate("gestures.feedback.recognized");
      }
      return state.state === "attempt-playing"
        ? translate(
            `story.migrationPanel.gestures.${state.activeGestureId}.instruction`,
          )
        : "";
    },
  },
  actions: {
    startGesture(id: StoryGestureId): Promise<StoryGestureResult> {
      if (this.state !== "inactive") return Promise.resolve("error");
      Object.assign(this, initialState(), {
        activeGestureId: id,
        state: "loading-movement",
        startedAt: Date.now(),
      });
      return new Promise((resolve) => {
        completionResolver = resolve;
      });
    },
    setSessionState(patch: Partial<ReturnType<typeof initialState>>) {
      Object.assign(this, patch);
    },
    setDiagnostics(patch: Partial<GestureSessionDiagnostics>) {
      Object.assign(this.diagnostics, patch);
    },
    requestControl(request: Exclude<GestureControlRequest, null>) {
      this.controlRequest = request;
    },
    consumeControlRequest() {
      const request = this.controlRequest;
      this.controlRequest = null;
      return request;
    },
    markGestureSuccessful() {
      this.requestControl("success");
    },
    repeatAttempt() {
      this.requestControl("retry");
    },
    continueGesture() {
      this.finishGesture("continued");
    },
    cancelGesture() {
      this.finishGesture("cancelled");
    },
    finishGesture(result: StoryGestureResult) {
      completionResolver?.(result);
      completionResolver = null;
      Object.assign(this, initialState());
    },
    cleanupGesture() {
      if (this.state !== "inactive") this.finishGesture("cancelled");
    },
  },
});
