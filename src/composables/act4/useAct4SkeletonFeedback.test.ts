import { nextTick, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAct4SkeletonFeedback } from "~/composables/act4/useAct4SkeletonFeedback";
import { useAct4Store } from "~/store/act4";
import type { Act4Recognition } from "~/composables/act4/useAct4Recognition";
import type { Act4SequenceTarget } from "~/types/act4";
import type { MovementBeatEvaluationLike } from "~/types/movement";

type TestBeatEvaluation = MovementBeatEvaluationLike<
  number,
  Record<string, never>,
  string
>;

const target: Act4SequenceTarget = {
  id: "winter-test",
  context: "tutorial",
  season: "winter",
  movementValue: 50,
  encoding: {
    id: "bodyHeight",
    tutorialTitleKey: "",
    tutorialExplanationKey: "",
    maximumExplanationKey: "",
    minimumExplanationKey: "",
    actionNounKey: "",
  },
  rules: {
    measuresPerStep: 1,
    requiredSuccessfulMeasures: 1,
    retryUntilSuccess: true,
    feedbackInterludeBeats: 1,
  },
};

const beat = ({
  passed,
  trackingUnavailable = false,
  negativeFeedbackEligible,
}: {
  passed: boolean;
  trackingUnavailable?: boolean;
  negativeFeedbackEligible?: boolean;
}): TestBeatEvaluation => ({
  beat: 1,
  measureIndex: 0,
  score: passed ? 1 : 0,
  passed,
  negativeFeedbackEligible,
  trackingUnavailable,
  criteria: [],
  timestamp: 0,
  metrics: {},
});

const createRecognition = () => {
  const finalizedBeatEvaluations = ref<TestBeatEvaluation[]>([]);
  const recognition = {
    finalizedBeatEvaluations,
    currentMeasureEvaluation: ref({ measureIndex: 0 }),
    currentEvaluation: ref(null),
  } as unknown as Act4Recognition;

  return {
    finalizedBeatEvaluations,
    recognition,
  };
};

describe("Act 4 skeleton feedback", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const store = useAct4Store();
    store.startFlow("act4Full", [target]);
    store.startTarget(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps finalized climate beat success, failure, and tracking results to terminal pulse semantics", async () => {
    const { finalizedBeatEvaluations, recognition } = createRecognition();
    const feedback = useAct4SkeletonFeedback({ recognition });

    finalizedBeatEvaluations.value = [beat({ passed: false })];
    await nextTick();

    expect(feedback.skeletonFeedbackState.value.mode).toBe("missPulse");

    feedback.resetSkeletonFeedback();
    finalizedBeatEvaluations.value = [
      beat({ passed: false }),
      beat({ passed: true }),
    ];
    await nextTick();

    expect(feedback.skeletonFeedbackState.value.mode).toBe("successPulse");

    feedback.resetSkeletonFeedback();
    finalizedBeatEvaluations.value = [
      beat({ passed: false }),
      beat({ passed: true }),
      beat({ passed: false, trackingUnavailable: true }),
    ];
    await nextTick();

    expect(feedback.skeletonFeedbackState.value.mode).toBe("neutral");

    feedback.dispose();
  });

  it("does not pulse amber for finalized optional climate beat misses", async () => {
    const { finalizedBeatEvaluations, recognition } = createRecognition();
    const feedback = useAct4SkeletonFeedback({ recognition });

    finalizedBeatEvaluations.value = [
      beat({ passed: false, negativeFeedbackEligible: false }),
    ];
    await nextTick();

    expect(feedback.skeletonFeedbackState.value.mode).toBe("neutral");

    finalizedBeatEvaluations.value = [
      beat({ passed: false, negativeFeedbackEligible: false }),
      beat({ passed: true, negativeFeedbackEligible: false }),
    ];
    await nextTick();

    expect(feedback.skeletonFeedbackState.value.mode).toBe("successPulse");

    feedback.dispose();
  });
});
