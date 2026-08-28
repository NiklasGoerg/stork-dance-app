import { afterEach, describe, expect, it, vi } from "vitest";
import { useSkeletonVisualFeedback } from "~/composables/useSkeletonVisualFeedback";

describe("skeleton visual feedback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pulses green for finalized success and amber for finalized movement miss", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);

    const feedback = useSkeletonVisualFeedback();

    feedback.triggerBeatFeedback({
      evaluationId: "success-window",
      flowId: "test",
      flowStepId: "step",
      measureIndex: 0,
      beatIndex: 1,
      result: "passed",
    });

    expect(feedback.skeletonFeedbackState.value).toMatchObject({
      mode: "successPulse",
      sourceEvaluationId: "success-window",
    });

    feedback.triggerBeatFeedback({
      evaluationId: "miss-window",
      flowId: "test",
      flowStepId: "step",
      measureIndex: 0,
      beatIndex: 2,
      result: "failed",
    });

    expect(feedback.skeletonFeedbackState.value).toMatchObject({
      mode: "missPulse",
      sourceEvaluationId: "miss-window",
    });
  });

  it("does not turn tracking or duplicate terminal results into movement misses", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);

    const feedback = useSkeletonVisualFeedback();

    feedback.triggerBeatFeedback({
      evaluationId: "tracking-window",
      flowId: "test",
      flowStepId: "step",
      measureIndex: 0,
      beatIndex: 1,
      result: "notEvaluable",
    });

    expect(feedback.skeletonFeedbackState.value.mode).toBe("neutral");

    feedback.triggerBeatFeedback({
      evaluationId: "deduped-window",
      flowId: "test",
      flowStepId: "step",
      measureIndex: 0,
      beatIndex: 1,
      result: "failed",
    });
    feedback.triggerBeatFeedback({
      evaluationId: "deduped-window",
      flowId: "test",
      flowStepId: "step",
      measureIndex: 0,
      beatIndex: 1,
      result: "passed",
    });

    expect(feedback.skeletonFeedbackState.value).toMatchObject({
      mode: "missPulse",
      sourceEvaluationId: "deduped-window",
    });
  });
});
