import { watch } from "vue";
import { useAct4Store } from "~/store/act4";
import { useSkeletonVisualFeedback } from "~/composables/useSkeletonVisualFeedback";
import type { Act4Recognition } from "~/composables/act4/useAct4Recognition";

export const useAct4SkeletonFeedback = ({
  recognition,
}: {
  recognition: Act4Recognition;
}) => {
  const store = useAct4Store();
  const {
    skeletonFeedbackState,
    pulseProgress,
    triggerBeatFeedback,
    setTrackingLimited,
    resetSkeletonFeedback,
  } = useSkeletonVisualFeedback();

  let processedBeatCount = 0;

  const stopWatchers = [
    watch(
      () => store.currentTarget?.id,
      () => {
        processedBeatCount = 0;
        resetSkeletonFeedback({ clearHandledEvents: false });
      },
    ),
    watch(recognition.finalizedBeatEvaluations, (evaluations) => {
      const target = store.currentTarget;
      const nextEvaluations = evaluations.slice(processedBeatCount);

      processedBeatCount = evaluations.length;

      if (!target) return;

      nextEvaluations.forEach((evaluation, index) => {
        triggerBeatFeedback({
          evaluationId: `${target.id}-${store.attempt.attemptNumber}-${evaluation.beat}-${processedBeatCount + index}`,
          flowId: store.flowId ?? "act4",
          flowStepId: target.climateData?.id ?? target.id,
          measureIndex:
            recognition.currentMeasureEvaluation.value?.measureIndex ?? 0,
          beatIndex: evaluation.beat,
          result: evaluation.trackingUnavailable
            ? "notEvaluable"
            : evaluation.negativeFeedbackEligible === false &&
                !evaluation.passed
              ? "notEvaluable"
              : evaluation.passed
                ? "passed"
                : "failed",
        });
      });
    }),
    watch(recognition.currentEvaluation, (evaluation) =>
      setTrackingLimited(evaluation?.trackingUnavailable ?? false),
    ),
  ];

  const triggerSkeletonPulseTest = () => {
    triggerBeatFeedback({
      evaluationId: `debug-skeleton-pulse-${Math.round(performance.now())}`,
      flowId: "debug",
      flowStepId: "debug-skeleton-pulse",
      measureIndex: 0,
      beatIndex: 1,
      result: "passed",
    });
  };

  const dispose = () => {
    stopWatchers.forEach((stop) => stop());
    resetSkeletonFeedback();
  };

  return {
    skeletonFeedbackState,
    pulseProgress,
    resetSkeletonFeedback,
    triggerSkeletonPulseTest,
    dispose,
  };
};
