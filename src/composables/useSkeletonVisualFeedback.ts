import { computed, getCurrentInstance, onBeforeUnmount, ref } from "vue";
import {
  SKELETON_SUCCESS_PULSE_DURATION_MS,
  type BeatSkeletonFeedbackEvent,
  type SkeletonVisualMode,
} from "~/utils/movement/skeletonVisualFeedback";

export type SkeletonFeedbackState = {
  mode: SkeletonVisualMode;
  pulseStartedAt?: number;
  pulseDurationMs: number;
  sourceEvaluationId?: string;
};

export const useSkeletonVisualFeedback = ({
  successPulseDurationMs = SKELETON_SUCCESS_PULSE_DURATION_MS,
}: {
  successPulseDurationMs?: number;
} = {}) => {
  const nowMs = ref(0);
  const handledEvaluationIds = new Set<string>();
  const skeletonFeedbackState = ref<SkeletonFeedbackState>({
    mode: "neutral",
    pulseDurationMs: successPulseDurationMs,
  });

  let animationFrameId = 0;

  const clearAnimationFrame = () => {
    if (!animationFrameId) return;

    cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  };

  const setNeutral = () => {
    clearAnimationFrame();
    skeletonFeedbackState.value = {
      mode: "neutral",
      pulseDurationMs: skeletonFeedbackState.value.pulseDurationMs,
    };
  };

  const pulseProgress = computed(() => {
    const state = skeletonFeedbackState.value;

    if (
      (state.mode !== "successPulse" && state.mode !== "missPulse") ||
      state.pulseStartedAt === undefined
    ) {
      return 1;
    }

    return Math.min(
      Math.max((nowMs.value - state.pulseStartedAt) / state.pulseDurationMs, 0),
      1,
    );
  });

  const tickPulse = () => {
    nowMs.value = performance.now();

    if (
      (skeletonFeedbackState.value.mode !== "successPulse" &&
        skeletonFeedbackState.value.mode !== "missPulse") ||
      pulseProgress.value >= 1
    ) {
      setNeutral();
      return;
    }

    animationFrameId = requestAnimationFrame(tickPulse);
  };

  const triggerBeatFeedback = (event: BeatSkeletonFeedbackEvent) => {
    if (handledEvaluationIds.has(event.evaluationId)) return;

    handledEvaluationIds.add(event.evaluationId);

    if (event.result === "notEvaluable") return;

    clearAnimationFrame();
    const startedAt = performance.now();
    const pulseDurationMs = event.pulseDurationMs ?? successPulseDurationMs;

    nowMs.value = startedAt;
    skeletonFeedbackState.value = {
      mode: event.result === "passed" ? "successPulse" : "missPulse",
      pulseStartedAt: startedAt,
      pulseDurationMs,
      sourceEvaluationId: event.evaluationId,
    };
    animationFrameId = requestAnimationFrame(tickPulse);
  };

  const triggerBeatSuccess = (event: BeatSkeletonFeedbackEvent) => {
    triggerBeatFeedback({
      ...event,
      result: event.result === "passed" ? "passed" : "notEvaluable",
    });
  };

  const setTrackingLimited = (isLimited: boolean) => {
    if (isLimited) {
      clearAnimationFrame();
      skeletonFeedbackState.value = {
        mode: "trackingLimited",
        pulseDurationMs: skeletonFeedbackState.value.pulseDurationMs,
      };
      return;
    }

    if (skeletonFeedbackState.value.mode === "trackingLimited") {
      setNeutral();
    }
  };

  const resetSkeletonFeedback = ({
    clearHandledEvents = true,
  }: {
    clearHandledEvents?: boolean;
  } = {}) => {
    if (clearHandledEvents) {
      handledEvaluationIds.clear();
    }

    setNeutral();
  };

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      clearAnimationFrame();
    });
  }

  return {
    skeletonFeedbackState,
    pulseProgress,
    triggerBeatFeedback,
    triggerBeatSuccess,
    setTrackingLimited,
    resetSkeletonFeedback,
  };
};
