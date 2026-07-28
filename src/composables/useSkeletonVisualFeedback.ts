import { computed, onBeforeUnmount, ref } from "vue";
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

export const useSkeletonVisualFeedback = () => {
  const nowMs = ref(0);
  const handledEvaluationIds = new Set<string>();
  const skeletonFeedbackState = ref<SkeletonFeedbackState>({
    mode: "neutral",
    pulseDurationMs: SKELETON_SUCCESS_PULSE_DURATION_MS,
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

    if (state.mode !== "successPulse" || state.pulseStartedAt === undefined) {
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
      skeletonFeedbackState.value.mode !== "successPulse" ||
      pulseProgress.value >= 1
    ) {
      setNeutral();
      return;
    }

    animationFrameId = requestAnimationFrame(tickPulse);
  };

  const triggerBeatSuccess = (event: BeatSkeletonFeedbackEvent) => {
    if (handledEvaluationIds.has(event.evaluationId)) return;

    handledEvaluationIds.add(event.evaluationId);

    if (event.result !== "passed") return;

    clearAnimationFrame();
    const startedAt = performance.now();

    nowMs.value = startedAt;
    skeletonFeedbackState.value = {
      mode: "successPulse",
      pulseStartedAt: startedAt,
      pulseDurationMs: SKELETON_SUCCESS_PULSE_DURATION_MS,
      sourceEvaluationId: event.evaluationId,
    };
    animationFrameId = requestAnimationFrame(tickPulse);
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

  onBeforeUnmount(() => {
    clearAnimationFrame();
  });

  return {
    skeletonFeedbackState,
    pulseProgress,
    triggerBeatSuccess,
    setTrackingLimited,
    resetSkeletonFeedback,
  };
};
