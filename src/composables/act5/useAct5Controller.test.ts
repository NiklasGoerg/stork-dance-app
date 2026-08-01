import { createPinia, setActivePinia } from "pinia";
import { computed, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAct5Controller } from "~/composables/act5/useAct5Controller";
import type { Act5Recognition } from "~/composables/act5/useAct5Recognition";
import type {
  Act5RecognitionSequenceEvaluation,
  Act5SequenceTarget,
} from "~/types/act5";
import type { NarrationResult } from "~/types/narration";
import type {
  SeasonalCycleConfig,
  SeasonalCyclePlaybackState,
  SeasonalCycleSeasonConfig,
} from "~/utils/seasonalCycle";

vi.mock("~/composables/useClimateSeasonData", () => ({
  useClimateSeasonData: () => ({
    dataset: ref(null),
    validationErrors: ref([]),
    loadClimateSeasonData: vi.fn(async () => ({ rows: [] })),
    getSeasonBaselineStep: vi.fn(() => null),
  }),
}));

vi.mock("~/composables/useStoryEngine", () => ({
  useStoryEngine: () => ({
    startAct: vi.fn(),
    stopStoryEngine: vi.fn(),
  }),
}));

type QueuedRestart = {
  beforeRestart?: () => void | Promise<void>;
  options?: {
    interludeDurationMs?: number;
    onInterludeStart?: () => void;
    restartSeasonIndex?: number;
  };
};

const createTarget = (
  overrides: Partial<Act5SequenceTarget> = {},
): Act5SequenceTarget => ({
  id: "spring-target",
  context: "climateStory",
  season: "spring",
  movementValue: 40,
  encoding: {
    id: "verticalArcExtent",
    tutorialTitleKey: "title",
    tutorialExplanationKey: "explanation",
    maximumExplanationKey: "maximum",
    minimumExplanationKey: "minimum",
    actionNounKey: "action",
  },
  rules: {
    measuresPerStep: 4,
    requiredSuccessfulMeasures: 2,
    retryUntilSuccess: true,
    feedbackInterludeBeats: 4,
  },
  ...overrides,
});

const createRecognition = () =>
  ({
    activeSeason: computed(() => "spring"),
    currentMeasureEvaluation: ref(null),
    currentEvaluation: ref(null),
    cycleEvaluations: ref([]),
    finalizedBeatEvaluations: ref([]),
    feedbackCode: ref("OPEN_ARMS_HIGHER"),
    debugSnapshots: ref({}),
    resetAll: vi.fn(),
    startTarget: vi.fn(),
    updateFrame: vi.fn(),
    dispose: vi.fn(),
  }) as unknown as Act5Recognition;

const createHarness = (
  narrationPlay: () => Promise<NarrationResult> = async () => ({
    status: "completed",
  }),
) => {
  setActivePinia(createPinia());

  const queuedRestarts: QueuedRestart[] = [];
  const target = createTarget();
  const narration = {
    play: vi.fn(narrationPlay),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    isSpeaking: ref(false),
    isPaused: ref(false),
  };
  const currentSeason = ref<SeasonalCycleSeasonConfig>({
    id: "spring",
    label: "Spring",
    date: "2023-03-01",
    movementUrl: "",
    audioUrl: "",
  });
  const cycle = {
    currentSeason,
    currentSeasonIndex: ref(0),
    playbackState: ref<SeasonalCyclePlaybackState>("playing"),
    seasonElapsedMs: ref(0),
    repetitionIndex: ref(0),
    isTransition: ref(false),
    evaluationEnabled: ref(true),
    initialize: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    pause: vi.fn(),
    play: vi.fn(async () => undefined),
    cleanup: vi.fn(),
    startCustomCycle: vi.fn(
      async (_config: SeasonalCycleConfig, _withCountdown?: boolean) =>
        undefined,
    ),
    queueSeasonIndexRestart: vi.fn(
      (
        _seasonIndex: number,
        _withCountdown?: boolean,
        beforeRestart?: () => void | Promise<void>,
        options?: QueuedRestart["options"],
      ) => {
        queuedRestarts.push({ beforeRestart, options });
      },
    ),
    queueSeasonIndexEndAction: vi.fn(),
  };
  const controller = useAct5Controller({
    cycle,
    recognition: createRecognition(),
    actId: "act-5",
    debugEnabled: computed(() => false),
    getRetryFeedbackText: () => "visible feedback",
    narration,
  });

  controller.store.startFlow("act5Story", [target]);
  controller.store.startTarget(0);

  return {
    controller,
    cycle,
    narration,
    queuedRestarts,
    target,
  };
};

const fail = (
  feedbackCode: string,
  overrides: Partial<Act5RecognitionSequenceEvaluation> = {},
): Act5RecognitionSequenceEvaluation => ({
  passed: false,
  resultState: "retryRequired",
  totalScore: 10,
  feedbackCode,
  ...overrides,
});

const createDeferredNarration = () => {
  let resolve: (result: NarrationResult) => void = () => undefined;
  const promise = new Promise<NarrationResult>((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve,
  };
};

describe("useAct5Controller narration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("plays one narration cue for one failed intensity attempt", async () => {
    const { controller, narration, queuedRestarts, target } = createHarness();

    controller.handleRecognitionResult(target, fail("OPEN_ARMS_HIGHER"));
    queuedRestarts[0]?.options?.onInterludeStart?.();
    await queuedRestarts[0]?.beforeRestart?.();

    expect(narration.play).toHaveBeenCalledTimes(1);
    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act5.narration.feedback.spring.openArmsHigher",
      { behavior: "replace" },
    );
  });

  it("does not narrate successful attempts", () => {
    const { controller, narration, target } = createHarness();

    controller.handleRecognitionResult(target, {
      passed: true,
      resultState: "success",
      totalScore: 100,
      feedbackCode: "SUCCESS",
    });

    expect(narration.play).not.toHaveBeenCalled();
  });

  it("narrates non-intensity retry feedback", () => {
    const { controller, narration, queuedRestarts, target } = createHarness();

    controller.handleRecognitionResult(target, fail("START_HANDS_LOW"));
    queuedRestarts[0]?.options?.onInterludeStart?.();

    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act5.narration.feedback.spring.startHandsLow",
      { behavior: "replace" },
    );
  });

  it("treats disabled narration as non-blocking", async () => {
    const { controller, queuedRestarts, target } = createHarness(async () => ({
      status: "disabled",
    }));

    controller.handleRecognitionResult(target, fail("OPEN_ARMS_HIGHER"));
    queuedRestarts[0]?.options?.onInterludeStart?.();
    await queuedRestarts[0]?.beforeRestart?.();

    expect(controller.store.sequenceStatus).toBe("performing");
    expect(controller.store.attempt.attemptNumber).toBe(2);
  });

  it("waits for active retry narration before starting the next attempt", async () => {
    const deferred = createDeferredNarration();
    const { controller, queuedRestarts, target } = createHarness(
      () => deferred.promise,
    );

    controller.handleRecognitionResult(target, fail("OPEN_ARMS_HIGHER"));
    queuedRestarts[0]?.options?.onInterludeStart?.();
    const restartPromise = queuedRestarts[0]?.beforeRestart?.();

    await Promise.resolve();

    expect(controller.store.sequenceStatus).toBe("retryInterlude");
    expect(controller.store.attempt.attemptNumber).toBe(1);

    deferred.resolve({ status: "completed" });
    await restartPromise;

    expect(controller.store.sequenceStatus).toBe("performing");
    expect(controller.store.attempt.attemptNumber).toBe(2);
  });

  it("stops narration on reset and dispose", async () => {
    const { controller, narration } = createHarness();

    await controller.reset();
    controller.dispose();

    expect(narration.stop).toHaveBeenCalledTimes(2);
  });

  it("allows the same feedback to play again on a later attempt", async () => {
    const { controller, narration, queuedRestarts, target } = createHarness();

    controller.handleRecognitionResult(target, fail("OPEN_ARMS_HIGHER"));
    queuedRestarts[0]?.options?.onInterludeStart?.();
    await queuedRestarts[0]?.beforeRestart?.();

    controller.handleRecognitionResult(target, fail("OPEN_ARMS_HIGHER"));
    queuedRestarts[1]?.options?.onInterludeStart?.();

    expect(narration.play).toHaveBeenCalledTimes(2);
  });

  it("does not replay duplicate updates from the same attempt", () => {
    const { controller, narration, queuedRestarts, target } = createHarness();

    controller.handleRecognitionResult(target, fail("OPEN_ARMS_HIGHER"));
    controller.handleRecognitionResult(
      target,
      fail("OPEN_ARMS_HIGHER", { totalScore: 11 }),
    );
    queuedRestarts.forEach((restart) => restart.options?.onInterludeStart?.());

    expect(narration.play).toHaveBeenCalledTimes(1);
  });

  it("pauses and resumes only speech paused by Act 5", async () => {
    const { controller, cycle, narration } = createHarness();

    narration.isSpeaking.value = true;
    controller.pause();
    await controller.resume();

    expect(narration.pause).toHaveBeenCalledTimes(1);
    expect(narration.resume).toHaveBeenCalledTimes(1);
    expect(cycle.pause).toHaveBeenCalledTimes(1);
    expect(cycle.play).toHaveBeenCalledTimes(1);
  });
});
