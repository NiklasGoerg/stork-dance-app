import { defineStore } from "pinia";
import {
  getStoryGestureDefinition,
  type GestureAttemptDecision,
  type GestureCheckpoint,
  type GestureInteractionState,
  type StoryGestureId,
} from "~/story/gestures";
import { useAudioStore } from "~/store/audioStore";
import { useStoryPlaybackStore } from "~/store/storyPlayback";
import type {
  PoseCalibrationState,
  PoseConditionResult,
  StablePoseResult,
  StoryPoseId,
} from "~/types/pose";
import { getPoseDefinition } from "~/utils/pose/poseDefinitionRegistry";

type GestureMovementPlaybackSource = "none" | "recorded";
export type StoryGestureResult = "completed" | "cancelled" | "error";

type PoseSnapshot = {
  stableResults: Record<StoryPoseId, StablePoseResult | null>;
  hasPoseInput: boolean;
  calibration?: PoseCalibrationState;
};

type GestureInteractionSession = {
  activeGestureId: StoryGestureId | null;
  state: GestureInteractionState;
  attemptCount: number;
  completedCheckpointIds: string[];
  startedAt: number | null;
  shouldResumeStoryPlayback: boolean;
  isStoryPaused: boolean;
  movementPlaybackSource: GestureMovementPlaybackSource;
  movementPlaybackKey: number;
  movementLoaded: boolean;
  movementLoadError: string | null;
  leadInTransportTimeMs: number | null;
  attemptStartTransportTimeMs: number | null;
  currentTransportTimeMs: number;
  currentSourceTimeMs: number;
  currentCheckpointIndex: number;
  decision: GestureAttemptDecision;
  lastPoseEvaluationAt: number | null;
  hasPoseInput: boolean;
  branchFeedbackText: string | null;
  branchFeedbackUntilSourceMs: number;
};

const storyGesturePauseReason = "story-gesture";
const leadInBeat = 4;
const poseEvaluationIntervalMs = 80;
const retryFeedbackDurationMs = 650;
const retryFeedbackLeadMs = 500;
const countdownMaxBeats = 3;
const poseDebugLogIntervalMs = 500;
const checkpointLateGraceMs = 160;

let scheduledLeadInCancel: (() => void) | null = null;
let lastPoseDebugLogAt = Number.NEGATIVE_INFINITY;
let lastPoseDebugCheckpointId: string | null = null;
let gestureCompletionResolver: ((result: StoryGestureResult) => void) | null =
  null;

const getInitialSession = (): GestureInteractionSession => ({
  activeGestureId: null,
  state: "inactive",
  attemptCount: 0,
  completedCheckpointIds: [],
  startedAt: null,
  shouldResumeStoryPlayback: false,
  isStoryPaused: false,
  movementPlaybackSource: "none",
  movementPlaybackKey: 0,
  movementLoaded: false,
  movementLoadError: null,
  leadInTransportTimeMs: null,
  attemptStartTransportTimeMs: null,
  currentTransportTimeMs: 0,
  currentSourceTimeMs: 0,
  currentCheckpointIndex: 0,
  decision: "pending",
  lastPoseEvaluationAt: null,
  hasPoseInput: false,
  branchFeedbackText: null,
  branchFeedbackUntilSourceMs: 0,
});

const logStoryGesture = (message: string, details?: unknown) => {
  if (!import.meta.dev) return;

  if (details === undefined) {
    console.info(`[StoryGesture] ${message}`);
    return;
  }

  console.info(`[StoryGesture] ${message}`, details);
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown movement load error.";

const translateStoryText = (
  key: string,
  params: Record<string, string | number> = {},
) => String(useNuxtApp().$i18n.t(key, params));

const translateOptionalStoryText = (
  key: string | undefined,
  fallback: string,
) => (key ? translateStoryText(key) : fallback);

const clearScheduledLeadIn = () => {
  if (!scheduledLeadInCancel) return;

  scheduledLeadInCancel();
  scheduledLeadInCancel = null;
};

const getCheckpointWindow = (checkpoint: GestureCheckpoint) => ({
  start: checkpoint.targetMovementTimeMs - checkpoint.windowBeforeMs,
  end: checkpoint.targetMovementTimeMs + checkpoint.windowAfterMs,
});

const getRequiredStableMs = (checkpoint: GestureCheckpoint) =>
  checkpoint.requiredStableMs ??
  getPoseDefinition(checkpoint.poseId).stabilityMs;

const hasCompletedRequiredCheckpoints = (
  checkpoints: GestureCheckpoint[],
  completedCheckpointIds: string[],
) =>
  checkpoints
    .filter((checkpoint) => checkpoint.required)
    .every((checkpoint) => completedCheckpointIds.includes(checkpoint.id));

const resetPoseDebugLog = () => {
  lastPoseDebugLogAt = Number.NEGATIVE_INFINITY;
  lastPoseDebugCheckpointId = null;
};

const resolveGestureCompletion = (result: StoryGestureResult) => {
  gestureCompletionResolver?.(result);
  gestureCompletionResolver = null;
};

const formatDebugValue = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }

  return Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(2);
};

const formatConditionExpectation = (condition: PoseConditionResult) => {
  if (condition.threshold.operator === "lessThanOrEqual") {
    return `<= ${formatDebugValue(condition.threshold.value)}`;
  }

  if (condition.threshold.operator === "greaterThanOrEqual") {
    return `>= ${formatDebugValue(condition.threshold.value)}`;
  }

  return `${formatDebugValue(condition.threshold.min)}..${formatDebugValue(
    condition.threshold.max,
  )}`;
};

const getConditionReason = (condition: PoseConditionResult) => {
  if (condition.matched) return "ok";

  if (!condition.evaluable || condition.value === null) {
    return "feature unavailable: landmark visibility/calibration missing";
  }

  if (
    condition.threshold.operator === "lessThanOrEqual" &&
    typeof condition.threshold.value === "number"
  ) {
    return `${formatDebugValue(condition.value)} is above max ${formatDebugValue(
      condition.threshold.value,
    )}`;
  }

  if (
    condition.threshold.operator === "greaterThanOrEqual" &&
    typeof condition.threshold.value === "number"
  ) {
    return `${formatDebugValue(condition.value)} is below min ${formatDebugValue(
      condition.threshold.value,
    )}`;
  }

  if (
    condition.threshold.operator === "between" &&
    typeof condition.threshold.min === "number" &&
    typeof condition.threshold.max === "number"
  ) {
    return `${formatDebugValue(condition.value)} is outside ${formatDebugValue(
      condition.threshold.min,
    )}..${formatDebugValue(condition.threshold.max)}`;
  }

  return "threshold not met";
};

// Emits a compact, rate-limited snapshot of the active pose checkpoint.
const logPoseDetection = ({
  gestureLabel,
  attemptCount,
  checkpoint,
  sourceTimeMs,
  stableResult,
  requiredStableMs,
  hasPoseInput,
  calibration,
  reason,
}: {
  gestureLabel: string;
  attemptCount: number;
  checkpoint: GestureCheckpoint;
  sourceTimeMs: number;
  stableResult: StablePoseResult | null | undefined;
  requiredStableMs: number;
  hasPoseInput: boolean;
  calibration?: PoseCalibrationState;
  reason: "scanning" | "accepted" | "missed-window";
}) => {
  if (!import.meta.dev) return;

  const isNewCheckpoint = lastPoseDebugCheckpointId !== checkpoint.id;
  const shouldLog =
    reason !== "scanning" ||
    isNewCheckpoint ||
    sourceTimeMs - lastPoseDebugLogAt >= poseDebugLogIntervalMs;

  if (!shouldLog) return;

  lastPoseDebugLogAt = sourceTimeMs;
  lastPoseDebugCheckpointId = checkpoint.id;

  const evaluation = stableResult?.evaluation ?? null;
  const conditionRows =
    evaluation?.conditionResults.map((condition) => ({
      marker: condition.id,
      feature: condition.feature,
      ok: condition.matched,
      required: condition.required,
      value: formatDebugValue(condition.value),
      expected: formatConditionExpectation(condition),
      reason: getConditionReason(condition),
    })) ?? [];

  console.info(
    `[PoseDetection] ${gestureLabel} A${attemptCount} ${checkpoint.poseId} @ ${Math.round(
      sourceTimeMs,
    )}ms`,
    {
      status: reason,
      checkpoint: checkpoint.id,
      windowMs: getCheckpointWindow(checkpoint),
      poseRawMatched: evaluation?.matched ?? false,
      poseStableMatched: stableResult?.stableMatched ?? false,
      stableDurationMs: Math.round(stableResult?.stableDurationMs ?? 0),
      requiredStableMs,
      score: formatDebugValue(evaluation?.score),
      matchedConditions: evaluation
        ? `${evaluation.matchedConditionCount}/${evaluation.evaluableConditionCount}`
        : "0/0",
      requiredConditionsMatched: evaluation?.requiredConditionsMatched ?? false,
      hasPoseInput,
      calibrationReady: calibration?.calibrated ?? false,
      calibrationSamples: calibration?.sampleCount ?? 0,
      neutralBodySpan: formatDebugValue(calibration?.neutralBodySpan),
      neutralHipHeight: formatDebugValue(calibration?.neutralHipHeight),
    },
  );

  console.info(
    `[PoseDetection] ${checkpoint.poseId} markers`,
    conditionRows.length
      ? conditionRows
      : [
          {
            marker: "pose-evaluation",
            ok: false,
            reason: hasPoseInput
              ? "no pose evaluation available yet"
              : "no camera pose landmarks available",
          },
        ],
  );
};

export const useStoryGestureStore = defineStore("storyGesture", {
  state: getInitialSession,
  getters: {
    isActive: (state) => state.state !== "inactive",
    activeGesture: (state) =>
      state.activeGestureId
        ? getStoryGestureDefinition(state.activeGestureId)
        : null,
    currentCheckpoint: (state) => {
      if (!state.activeGestureId || state.decision !== "pending") return null;

      return (
        getStoryGestureDefinition(state.activeGestureId).checkpoints[
          state.currentCheckpointIndex
        ] ?? null
      );
    },
    completedCheckpointCount: (state) => state.completedCheckpointIds.length,
    requiredCheckpointCount: (state) =>
      state.activeGestureId
        ? getStoryGestureDefinition(state.activeGestureId).checkpoints.filter(
            (checkpoint) => checkpoint.required,
          ).length
        : 0,
    feedbackText: (state) => {
      if (!state.activeGestureId) return "";

      const gesture = getStoryGestureDefinition(state.activeGestureId);
      const gestureLabel = translateOptionalStoryText(
        gesture.labelKey,
        gesture.label,
      );

      if (state.state === "loading-movement") {
        return translateStoryText("gestures.feedback.loading");
      }

      if (state.state === "waiting-for-lead-in") {
        if (state.leadInTransportTimeMs === null) {
          return translateStoryText("gestures.feedback.ready", {
            gesture: gestureLabel,
          });
        }

        const audioStore = useAudioStore();
        const msUntilLeadIn = Math.max(
          state.leadInTransportTimeMs - state.currentTransportTimeMs,
          0,
        );
        const beatsUntilLeadIn = Math.max(
          1,
          Math.ceil(msUntilLeadIn / audioStore.getBeatDurationMs()),
        );

        return translateStoryText("gestures.feedback.countdown", {
          gesture: gestureLabel,
          count: Math.min(countdownMaxBeats, beatsUntilLeadIn),
        });
      }

      if (
        state.branchFeedbackText &&
        state.currentSourceTimeMs <= state.branchFeedbackUntilSourceMs
      ) {
        return translateStoryText(state.branchFeedbackText);
      }

      if (
        state.state === "retry-scheduled" &&
        state.currentSourceTimeMs >=
          gesture.timing.branchPointMs - retryFeedbackLeadMs
      ) {
        return translateStoryText("gestures.feedback.tryAgain");
      }

      if (state.state === "success-exit" || state.state === "completed") {
        return translateStoryText("gestures.feedback.recognized");
      }

      if (
        state.state === "attempt-playing" ||
        state.state === "retry-scheduled"
      ) {
        return (() => {
          const cue = gesture.beatCues.find(
            (cue) =>
              state.currentSourceTimeMs >= cue.sourceStartMs &&
              state.currentSourceTimeMs < cue.sourceEndMs,
          );

          return cue ? translateOptionalStoryText(cue.textKey, cue.text) : "";
        })();
      }

      return "";
    },
  },
  actions: {
    // Starts a gesture session and pauses the story while the base beat keeps running.
    async startGesture(id: StoryGestureId): Promise<StoryGestureResult> {
      if (this.state !== "inactive") {
        logStoryGesture(`Ignored ${id}; another gesture is active.`);
        return "error";
      }

      const gesture = getStoryGestureDefinition(id);
      const audioStore = useAudioStore();
      const storyPlaybackStore = useStoryPlaybackStore();
      const completionPromise = new Promise<StoryGestureResult>((resolve) => {
        gestureCompletionResolver = resolve;
      });
      const shouldResumeStoryPlayback = storyPlaybackStore.pauseStoryPlayback(
        storyGesturePauseReason,
      );

      logStoryGesture(`${gesture.label} requested`);
      clearScheduledLeadIn();

      this.$patch({
        ...getInitialSession(),
        activeGestureId: id,
        state: "loading-movement",
        startedAt: Date.now(),
        shouldResumeStoryPlayback,
        isStoryPaused: true,
      });

      if (!audioStore.baseRhythmLoop.isPlaying) {
        await audioStore.startBaseRhythmLoop(
          audioStore.baseRhythmLoop.currentOffsetSeconds,
        );
      }

      this.currentTransportTimeMs = audioStore.getBaseRhythmTransportTimeMs();

      return completionPromise;
    },
    // Arms the loaded avatar movement on the next musically useful lead-in beat.
    async markMovementLoaded(source: GestureMovementPlaybackSource) {
      if (this.state !== "loading-movement") return;

      const audioStore = useAudioStore();

      if (!audioStore.baseRhythmLoop.isPlaying) {
        await audioStore.startBaseRhythmLoop(
          audioStore.baseRhythmLoop.currentOffsetSeconds,
        );
      }

      if (this.state !== "loading-movement") return;

      const msUntilLeadIn = audioStore.getMsUntilNextBaseRhythmBeat(leadInBeat);

      this.currentTransportTimeMs = audioStore.getBaseRhythmTransportTimeMs();
      this.leadInTransportTimeMs = this.currentTransportTimeMs + msUntilLeadIn;
      this.movementLoaded = true;
      this.movementPlaybackSource = source;
      this.state = "waiting-for-lead-in";

      logStoryGesture("Waiting for lead-in beat", {
        leadInBeat,
        msUntilLeadIn,
      });

      clearScheduledLeadIn();
      scheduledLeadInCancel = audioStore.scheduleAtNextBaseRhythmBeat(
        leadInBeat,
        () => {
          scheduledLeadInCancel = null;
          this.beginAttempt(audioStore.getBaseRhythmTransportTimeMs());
        },
      );
    },
    abortGestureSetup(error: unknown) {
      if (this.state === "inactive") return;

      this.movementLoadError = getErrorMessage(error);
      console.error("[StoryGesture] Gesture setup aborted.", error);
      this.finishGesture("error");
    },
    // Resets checkpoint progress and starts one synchronized user attempt.
    beginAttempt(transportTimeMs: number, feedbackText: string | null = null) {
      if (!this.activeGesture) return;

      clearScheduledLeadIn();
      this.state = "attempt-playing";
      this.attemptCount = Math.max(1, this.attemptCount + 1);
      this.completedCheckpointIds = [];
      this.currentCheckpointIndex = 0;
      this.currentTransportTimeMs = transportTimeMs;
      this.attemptStartTransportTimeMs = transportTimeMs;
      this.currentSourceTimeMs = this.activeGesture.timing.leadInStartMs;
      this.decision = "pending";
      this.lastPoseEvaluationAt = null;
      this.branchFeedbackText = feedbackText;
      this.branchFeedbackUntilSourceMs = feedbackText
        ? retryFeedbackDurationMs
        : 0;
      this.movementPlaybackKey++;
      resetPoseDebugLog();

      logStoryGesture("Gesture attempt started", {
        attempt: this.attemptCount,
        transportTimeMs,
      });
    },
    lockDecision(decision: Exclude<GestureAttemptDecision, "pending">) {
      if (this.decision !== "pending") return;

      this.decision = decision;
      this.state = decision === "retry" ? "retry-scheduled" : "attempt-playing";

      logStoryGesture("Gesture decision locked", {
        decision,
        sourceTimeMs: this.currentSourceTimeMs,
      });
    },
    // Drives the gesture state machine from the shared base-rhythm transport.
    updateTransportTime(transportTimeMs: number) {
      this.currentTransportTimeMs = transportTimeMs;

      if (!this.activeGesture) return;

      if (this.state === "waiting-for-lead-in") return;

      if (
        this.state !== "attempt-playing" &&
        this.state !== "retry-scheduled" &&
        this.state !== "success-exit"
      ) {
        return;
      }

      if (this.attemptStartTransportTimeMs === null) return;

      const timing = this.activeGesture.timing;

      this.currentSourceTimeMs = Math.max(
        timing.leadInStartMs,
        transportTimeMs - this.attemptStartTransportTimeMs,
      );

      if (
        (this.state === "attempt-playing" ||
          this.state === "retry-scheduled") &&
        this.currentSourceTimeMs >= timing.decisionDeadlineMs &&
        this.decision === "pending"
      ) {
        this.lockDecision(
          hasCompletedRequiredCheckpoints(
            this.activeGesture.checkpoints,
            this.completedCheckpointIds,
          )
            ? "success"
            : "retry",
        );
      }

      if (
        (this.state === "attempt-playing" ||
          this.state === "retry-scheduled") &&
        this.currentSourceTimeMs >= timing.branchPointMs
      ) {
        if (this.decision === "pending") {
          this.lockDecision(
            hasCompletedRequiredCheckpoints(
              this.activeGesture.checkpoints,
              this.completedCheckpointIds,
            )
              ? "success"
              : "retry",
          );
        }

        if (this.decision === "retry") {
          this.beginAttempt(transportTimeMs, "gestures.feedback.tryAgain");
          return;
        }

        this.state = "success-exit";
        this.branchFeedbackText = null;
      }

      if (
        this.state === "success-exit" &&
        this.currentSourceTimeMs >= timing.successEndMs
      ) {
        this.state = "completed";
        this.finishGesture("completed");
      }
    },
    markGestureSuccessful() {
      if (
        this.state !== "attempt-playing" &&
        this.state !== "retry-scheduled"
      ) {
        return;
      }

      const checkpointIds = this.activeGesture?.checkpoints.map(
        (checkpoint) => checkpoint.id,
      );

      logStoryGesture("Movement recognized manually");
      this.completedCheckpointIds = checkpointIds ?? [];
      this.currentCheckpointIndex = this.activeGesture?.checkpoints.length ?? 0;
      this.lockDecision("success");
    },
    repeatAttempt() {
      if (
        this.state !== "attempt-playing" &&
        this.state !== "retry-scheduled"
      ) {
        return;
      }

      this.lockDecision("retry");
    },
    // Accepts only the current checkpoint, inside its time window, after stable pose matching.
    handlePoseSnapshot({
      stableResults,
      hasPoseInput,
      calibration,
    }: PoseSnapshot) {
      this.hasPoseInput = hasPoseInput;

      if (
        !this.activeGesture ||
        this.decision !== "pending" ||
        this.state !== "attempt-playing"
      ) {
        return;
      }

      const timing = this.activeGesture.timing;

      if (this.currentSourceTimeMs > timing.decisionDeadlineMs) return;

      const lastEvaluationAt = this.lastPoseEvaluationAt ?? 0;

      if (
        this.currentSourceTimeMs - lastEvaluationAt <
        poseEvaluationIntervalMs
      ) {
        return;
      }

      this.lastPoseEvaluationAt = this.currentSourceTimeMs;

      const checkpoint = this.currentCheckpoint;

      if (!checkpoint) {
        this.lockDecision("success");
        return;
      }

      const window = getCheckpointWindow(checkpoint);

      if (this.currentSourceTimeMs < window.start) return;

      const stableResult = stableResults[checkpoint.poseId];
      const requiredStableMs = getRequiredStableMs(checkpoint);
      const checkpointAccepted =
        stableResult?.stableMatched &&
        stableResult.stableDurationMs >= requiredStableMs;

      if (this.currentSourceTimeMs > window.end) {
        if (
          checkpointAccepted &&
          this.currentSourceTimeMs <= window.end + checkpointLateGraceMs
        ) {
          logPoseDetection({
            gestureLabel: this.activeGesture.label,
            attemptCount: this.attemptCount,
            checkpoint,
            sourceTimeMs: this.currentSourceTimeMs,
            stableResult,
            requiredStableMs,
            hasPoseInput,
            calibration,
            reason: "accepted",
          });
          this.completedCheckpointIds.push(checkpoint.id);
          this.currentCheckpointIndex++;
          resetPoseDebugLog();

          if (
            this.currentCheckpointIndex >= this.activeGesture.checkpoints.length
          ) {
            this.lockDecision("success");
          }

          return;
        }

        logPoseDetection({
          gestureLabel: this.activeGesture.label,
          attemptCount: this.attemptCount,
          checkpoint,
          sourceTimeMs: this.currentSourceTimeMs,
          stableResult,
          requiredStableMs,
          hasPoseInput,
          calibration,
          reason: "missed-window",
        });
        this.lockDecision("retry");
        return;
      }

      logPoseDetection({
        gestureLabel: this.activeGesture.label,
        attemptCount: this.attemptCount,
        checkpoint,
        sourceTimeMs: this.currentSourceTimeMs,
        stableResult,
        requiredStableMs,
        hasPoseInput,
        calibration,
        reason: checkpointAccepted ? "accepted" : "scanning",
      });

      if (checkpointAccepted) {
        this.completedCheckpointIds.push(checkpoint.id);
        this.currentCheckpointIndex++;
        resetPoseDebugLog();

        if (
          this.currentCheckpointIndex >= this.activeGesture.checkpoints.length
        ) {
          this.lockDecision("success");
        }
      }
    },
    cancelGesture() {
      if (this.state === "inactive") return;

      logStoryGesture("Cancelled");
      clearScheduledLeadIn();
      this.state = "cancelled";
      this.finishGesture("cancelled");
    },
    // Restores story playback ownership and clears the transient gesture session.
    finishGesture(result: StoryGestureResult = "completed") {
      const storyPlaybackStore = useStoryPlaybackStore();
      const shouldResumeStoryPlayback = this.shouldResumeStoryPlayback;

      clearScheduledLeadIn();

      if (shouldResumeStoryPlayback) {
        storyPlaybackStore.resumeStoryPlayback(storyGesturePauseReason);
      } else {
        storyPlaybackStore.releaseStoryPlaybackPause(storyGesturePauseReason);
      }

      logStoryGesture("Story resumed");
      resolveGestureCompletion(result);
      this.$patch(getInitialSession());
    },
    setMovementPlaybackSource(source: GestureMovementPlaybackSource) {
      this.movementPlaybackSource = source;
    },
    cleanupGesture() {
      if (this.state === "inactive") return;

      this.finishGesture("cancelled");
    },
  },
});
