import { createPinia, setActivePinia } from "pinia";
import { computed, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAct4Controller } from "~/composables/act4/useAct4Controller";
import type { Act4Recognition } from "~/composables/act4/useAct4Recognition";
import {
  act4StoryCompletionCueIds,
  act4StoryNarrationCatalog,
  act4StoryTargetCueIds,
} from "~/utils/act4/storyNarration";
import type {
  Act4RecognitionSequenceEvaluation,
  Act4SequenceTarget,
} from "~/types/act4";
import type {
  ClimateMovementFlowStep,
  ClimateSeason,
  ClimateSeasonDataRow,
} from "~/types/climate";
import type { NarrationResult } from "~/types/narration";
import type {
  SeasonalCycleConfig,
  SeasonalCyclePlaybackState,
  SeasonalCycleSeasonConfig,
} from "~/utils/seasonalCycle";

const mockClimateRows = vi.hoisted<ClimateSeasonDataRow[]>(() => {
  const createRow = ({
    intervalOrder,
    interval,
    intervalStart,
    intervalEnd,
    seasonOrder,
    season,
    absoluteValue,
    displayValue,
    displayValueType,
    normalizedValue,
    movementPercent,
    isBaseline,
  }: ClimateSeasonDataRow): ClimateSeasonDataRow => ({
    intervalOrder,
    interval,
    intervalStart,
    intervalEnd,
    seasonOrder,
    season,
    absoluteValue,
    displayValue,
    displayValueType,
    displayUnit: "degC",
    normalizedValue,
    movementPercent,
    isBaseline,
  });

  return [
    createRow({
      intervalOrder: 1,
      interval: "1995-1999",
      intervalStart: 1995,
      intervalEnd: 1999,
      seasonOrder: 1,
      season: "winter",
      absoluteValue: 0.9,
      displayValue: 0.9,
      displayValueType: "absolute_temperature",
      displayUnit: "degC",
      normalizedValue: 0,
      movementPercent: null,
      isBaseline: true,
    }),
    createRow({
      intervalOrder: 1,
      interval: "1995-1999",
      intervalStart: 1995,
      intervalEnd: 1999,
      seasonOrder: 2,
      season: "spring",
      absoluteValue: 8.35,
      displayValue: 8.35,
      displayValueType: "absolute_temperature",
      displayUnit: "degC",
      normalizedValue: 0,
      movementPercent: null,
      isBaseline: true,
    }),
    createRow({
      intervalOrder: 1,
      interval: "1995-1999",
      intervalStart: 1995,
      intervalEnd: 1999,
      seasonOrder: 3,
      season: "summer",
      absoluteValue: 17.01,
      displayValue: 17.01,
      displayValueType: "absolute_temperature",
      displayUnit: "degC",
      normalizedValue: 0,
      movementPercent: null,
      isBaseline: true,
    }),
    createRow({
      intervalOrder: 1,
      interval: "1995-1999",
      intervalStart: 1995,
      intervalEnd: 1999,
      seasonOrder: 4,
      season: "autumn",
      absoluteValue: 8.67,
      displayValue: 8.67,
      displayValueType: "absolute_temperature",
      displayUnit: "degC",
      normalizedValue: 0,
      movementPercent: null,
      isBaseline: true,
    }),
    ...[
      ["2000-2004", 2, 2000, 2004, [20, 30, 30, 25]],
      ["2005-2009", 3, 2005, 2009, [20, 30, 10, 50]],
      ["2010-2014", 4, 2010, 2014, [-10, 20, 10, 40]],
      ["2015-2019", 5, 2015, 2019, [50, 40, 60, 50]],
      ["2020-2024", 6, 2020, 2024, [100, 30, 60, 80]],
    ].flatMap(([interval, intervalOrder, intervalStart, intervalEnd, values]) =>
      (["winter", "spring", "summer", "autumn"] as const).map((season, index) =>
        createRow({
          intervalOrder: intervalOrder as number,
          interval: interval as string,
          intervalStart: intervalStart as number,
          intervalEnd: intervalEnd as number,
          seasonOrder: index + 1,
          season,
          absoluteValue: 1 + Number(intervalOrder) + index,
          displayValue:
            interval === "2010-2014" && season === "winter"
              ? -0.32
              : interval === "2020-2024" && season === "winter"
                ? 2.33
                : 0.2 + Number(intervalOrder) / 10 + index / 10,
          displayValueType: "difference_from_1995_1999",
          displayUnit: "degC",
          normalizedValue:
            interval === "2020-2024" && season === "winter" ? 1 : 0.2,
          movementPercent: (values as number[])[index] ?? 0,
          isBaseline: false,
        }),
      ),
    ),
  ];
});

vi.mock("~/composables/useClimateSeasonData", () => ({
  useClimateSeasonData: () => ({
    dataset: ref({
      sourceId: "temperature-seasons",
      sourcePath: "src/assets/climate_data/temperature_seasons_data.csv",
      rows: mockClimateRows,
    }),
    validationErrors: ref([]),
    loadClimateSeasonData: vi.fn(async () => ({
      sourceId: "temperature-seasons",
      sourcePath: "src/assets/climate_data/temperature_seasons_data.csv",
      rows: mockClimateRows,
    })),
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
    preserveBaseRhythm?: boolean;
    afterRestart?: () => void | Promise<void>;
  };
};

const createTarget = (
  overrides: Partial<Act4SequenceTarget> = {},
): Act4SequenceTarget => ({
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

const createClimateData = ({
  season,
  interval = "1995-1999",
  intervalOrder = 1,
  movementValue = 100,
  isBaseline = true,
}: {
  season: ClimateSeason;
  interval?: string;
  intervalOrder?: number;
  movementValue?: number;
  isBaseline?: boolean;
}): ClimateMovementFlowStep => {
  const sourceRow: ClimateSeasonDataRow = {
    intervalOrder,
    interval,
    intervalStart: Number(interval.slice(0, 4)),
    intervalEnd: Number(interval.slice(5, 9)),
    seasonOrder: ["winter", "spring", "summer", "autumn"].indexOf(season) + 1,
    season,
    absoluteValue: 1,
    displayValue: isBaseline ? 1 : 0.5,
    displayValueType: isBaseline
      ? "absolute_temperature"
      : "difference_from_1995_1999",
    displayUnit: "degC",
    normalizedValue: isBaseline ? 0 : 0.2,
    movementPercent: isBaseline ? null : movementValue,
    isBaseline,
  };

  return {
    id: `${interval}:${season}`,
    movementDefinitionId: `${season}-${movementValue}`,
    sourceRow,
    season,
    intervalOrder,
    interval,
    intervalStart: sourceRow.intervalStart,
    intervalEnd: sourceRow.intervalEnd,
    movementValue,
    resolutionReason: isBaseline ? "baseline-reference" : "movement-percent",
    absoluteValue: sourceRow.absoluteValue,
    displayValue: sourceRow.displayValue,
    displayValueType: sourceRow.displayValueType,
    displayUnit: sourceRow.displayUnit,
    normalizedValue: sourceRow.normalizedValue,
    rawMovementPercent: sourceRow.movementPercent,
    isBaseline,
  };
};

const createReferenceTarget = (season: ClimateSeason) =>
  createTarget({
    id: `climateStory-1995-1999-${season}-100`,
    season,
    movementValue: 100,
    interval: "1995-1999",
    climateData: createClimateData({ season }),
  });

const createTutorialAutumnMinimumTarget = () =>
  createTarget({
    id: "tutorial-autumn-25",
    context: "tutorial",
    season: "autumn",
    movementValue: 25,
    target: "minimum",
    interval: undefined,
    climateData: undefined,
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
  }) as unknown as Act4Recognition;

const createHarness = (
  narrationPlay: (
    cueKey: string,
    options?: {
      behavior?: string;
      params?: Record<string, string | number>;
      debugLabel?: string;
    },
  ) => Promise<NarrationResult> = async () => ({
    status: "completed",
  }),
  options: { preparedCycleSetsPreview?: boolean } = {},
) => {
  setActivePinia(createPinia());

  const queuedRestarts: QueuedRestart[] = [];
  const queuedEndActions: Array<() => void> = [];
  const target = createTarget();
  const narration = {
    play: vi.fn(
      async (
        cueKey: string,
        options?: {
          behavior?: string;
          params?: Record<string, string | number>;
          debugLabel?: string;
        },
      ) => narrationPlay(cueKey, options),
    ),
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
  const currentSeasonIndex = ref(0);
  const playbackState = ref<SeasonalCyclePlaybackState>("idle");
  const currentBar = ref<number | null>(null);
  const seasonPhase = ref<"preview" | "performance" | "transition">(
    "transition",
  );
  const cycle = {
    currentSeason,
    currentSeasonIndex,
    playbackState,
    currentBar,
    seasonPhase,
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
    prepareCustomCycle: vi.fn(
      async (_config: SeasonalCycleConfig) => undefined,
    ),
    startExplanationPreview: vi.fn(async (seasonIndex: number) => {
      currentSeasonIndex.value = seasonIndex;
      playbackState.value = "previewing";
      currentBar.value = 1;
      seasonPhase.value = "preview";
    }),
    waitForExplanationPreviewBars: vi.fn(async (_bars?: number) => undefined),
    startPreparedCycleFromIndex: vi.fn(
      async (seasonIndex: number, _withCountdown?: boolean) => {
        currentSeasonIndex.value = seasonIndex;
        playbackState.value = "playing";
        if (options.preparedCycleSetsPreview !== false) {
          currentBar.value = 1;
          seasonPhase.value = "preview";
        } else {
          currentBar.value = null;
          seasonPhase.value = "transition";
        }
      },
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
    queueSeasonIndexEndAction: vi.fn(
      (_seasonIndex: number, onSeasonEnd: () => void) => {
        queuedEndActions.push(onSeasonEnd);
      },
    ),
  };
  const recognition = createRecognition();
  const controller = useAct4Controller({
    cycle,
    recognition,
    actId: "act-4",
    debugEnabled: computed(() => false),
    getRetryFeedbackText: () => "visible feedback",
    narration,
  });

  controller.store.startFlow("act4Story", [target]);
  controller.store.startTarget(0);

  return {
    controller,
    cycle,
    narration,
    recognition,
    queuedEndActions,
    queuedRestarts,
    target,
  };
};

const fail = (
  feedbackCode: string,
  overrides: Partial<Act4RecognitionSequenceEvaluation> = {},
): Act4RecognitionSequenceEvaluation => ({
  passed: false,
  resultState: "retryRequired",
  totalScore: 10,
  feedbackCode,
  ...overrides,
});

const success = (
  overrides: Partial<Act4RecognitionSequenceEvaluation> = {},
): Act4RecognitionSequenceEvaluation => ({
  passed: true,
  resultState: "success",
  totalScore: 100,
  feedbackCode: "SUCCESS",
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

const flushTargetNarrationWatcher = async () => {
  await nextTick();
  await Promise.resolve();
};

const enterTargetPreview = async (
  cycle: ReturnType<typeof createHarness>["cycle"],
  targetIndex: number,
) => {
  cycle.currentSeasonIndex.value = targetIndex;
  cycle.playbackState.value = "playing";
  cycle.currentBar.value = 1;
  cycle.seasonPhase.value = "preview";
  await flushTargetNarrationWatcher();
};

const advanceToTargetIndex = async (
  harness: ReturnType<typeof createHarness>,
  targetIndex: number,
) => {
  const { controller, queuedRestarts, cycle } = harness;

  while (controller.store.currentTargetIndex < targetIndex) {
    const nextTargetIndex = controller.store.currentTargetIndex + 1;

    controller.handleRecognitionResult(
      controller.store.currentTarget!,
      success(),
    );
    await queuedRestarts.at(-1)?.beforeRestart?.();
    await enterTargetPreview(cycle, nextTargetIndex);
  }
};

describe("useAct4Controller narration", () => {
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
      "story.acts.act4.narration.feedback.spring.openArmsHigher",
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
      "story.acts.act4.narration.feedback.spring.startHandsLow",
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

  it("pauses and resumes only speech paused by Act 4", async () => {
    const { controller, cycle, narration } = createHarness();

    narration.isSpeaking.value = true;
    controller.pause();
    await controller.resume();

    expect(narration.pause).toHaveBeenCalledTimes(1);
    expect(narration.resume).toHaveBeenCalledTimes(1);
    expect(cycle.pause).toHaveBeenCalledTimes(1);
    expect(cycle.play).toHaveBeenCalledTimes(1);
  });

  it("plays the full tutorial introduction before the first tutorial target", async () => {
    const { controller, cycle, narration, recognition } = createHarness();

    await controller.startTutorialFlow();

    expect(cycle.prepareCustomCycle).toHaveBeenCalledTimes(1);
    expect(cycle.startExplanationPreview).toHaveBeenCalledWith(0);
    const rhythmCueCallOrder = narration.play.mock.invocationCallOrder[5];
    const previewCallOrder =
      cycle.startExplanationPreview.mock.invocationCallOrder[0];

    expect(rhythmCueCallOrder).toBeDefined();
    expect(previewCallOrder).toBeDefined();
    expect(rhythmCueCallOrder!).toBeLessThan(previewCallOrder!);
    expect(narration.play).toHaveBeenNthCalledWith(
      1,
      "story.acts.act4.narration.tutorial.intro.context",
      { behavior: "replace", params: { value: "20" } },
    );
    expect(narration.play).toHaveBeenNthCalledWith(
      2,
      "story.acts.act4.narration.tutorial.intro.encoding",
      { behavior: "replace", params: { value: "20" } },
    );
    expect(narration.play).toHaveBeenNthCalledWith(
      3,
      "story.acts.act4.narration.tutorial.intro.scale",
      { behavior: "replace", params: { value: "20" } },
    );
    expect(narration.play).toHaveBeenNthCalledWith(
      4,
      "story.acts.act4.narration.tutorial.intro.range",
      { behavior: "replace", params: { value: "20" } },
    );
    expect(narration.play).toHaveBeenNthCalledWith(
      5,
      "story.acts.act4.narration.tutorial.intro.measureLength",
      { behavior: "replace", params: { value: "20" } },
    );
    expect(narration.play).toHaveBeenNthCalledWith(
      6,
      "story.acts.act4.narration.tutorial.intro.watchThenMove",
      { behavior: "replace", params: { value: "20" } },
    );
    expect(narration.play).toHaveBeenNthCalledWith(
      7,
      "story.acts.act4.narration.tutorial.winter.encoding",
      { behavior: "replace", params: { value: "20" } },
    );
    expect(narration.play).toHaveBeenNthCalledWith(
      8,
      "story.acts.act4.narration.tutorial.winter.example",
      { behavior: "replace", params: { value: "20" } },
    );
    const winterEncodingCallOrder = narration.play.mock.invocationCallOrder[6];
    const winterCueCallOrder = narration.play.mock.invocationCallOrder[7];

    expect(winterEncodingCallOrder).toBeDefined();
    expect(winterCueCallOrder).toBeDefined();
    expect(previewCallOrder!).toBeLessThan(winterEncodingCallOrder!);
    expect(cycle.waitForExplanationPreviewBars).toHaveBeenNthCalledWith(1, 1);
    expect(cycle.waitForExplanationPreviewBars).toHaveBeenNthCalledWith(2, 2);
    expect(narration.play.mock.invocationCallOrder[6]).toBeLessThan(
      cycle.waitForExplanationPreviewBars.mock.invocationCallOrder[0]!,
    );
    expect(
      cycle.waitForExplanationPreviewBars.mock.invocationCallOrder[0],
    ).toBeLessThan(winterCueCallOrder!);
    expect(
      cycle.waitForExplanationPreviewBars.mock.invocationCallOrder[1],
    ).toBeLessThan(
      vi.mocked(recognition.startTarget).mock.invocationCallOrder[0]!,
    );
    expect(recognition.startTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "tutorial",
        season: "winter",
        movementValue: 20,
      }),
      { keepCalibration: false, manual: true },
    );
    expect(cycle.startPreparedCycleFromIndex).toHaveBeenCalledWith(0, false);
    expect(controller.store.sequenceStatus).toBe("performing");
  });

  it("preserves the preview beat for the next tutorial performance", async () => {
    const { controller, cycle, narration, queuedRestarts } = createHarness();

    await controller.startTutorialFlow();
    const winterMaximum = controller.store.currentTarget;

    expect(winterMaximum).not.toBeNull();
    controller.handleRecognitionResult(winterMaximum!, success());
    const winterEncodingCallCount = narration.play.mock.calls.filter(
      ([cueKey]) =>
        cueKey === "story.acts.act4.narration.tutorial.winter.encoding",
    ).length;

    expect(cycle.queueSeasonIndexRestart).toHaveBeenCalledWith(
      0,
      false,
      expect.any(Function),
      expect.objectContaining({
        restartSeasonIndex: 1,
        preserveBaseRhythm: true,
      }),
    );

    await queuedRestarts[0]?.beforeRestart?.();

    expect(cycle.startExplanationPreview).toHaveBeenLastCalledWith(1);
    expect(
      narration.play.mock.calls.filter(
        ([cueKey]) =>
          cueKey === "story.acts.act4.narration.tutorial.winter.encoding",
      ),
    ).toHaveLength(winterEncodingCallCount);
    expect(cycle.startPreparedCycleFromIndex).toHaveBeenCalledTimes(1);
  });

  it("suppresses recognition during tutorial explanation", async () => {
    const { controller } = createHarness();

    await controller.startTutorialFlow();
    controller.store.enterTutorialExplanation({
      targetIndex: 0,
      cueId: "act4.tutorial.winter.maximum",
      textKey: "story.acts.act4.narration.tutorial.winter.maximum",
      params: { value: "100" },
    });

    expect(controller.isRecognitionSuppressed.value).toBe(true);
  });

  it("starts story-only flow with story intro and winter reference narration", async () => {
    const { controller, narration, cycle } = createHarness();

    await controller.startStoryFlow();

    expect(cycle.prepareCustomCycle).toHaveBeenCalledTimes(1);
    expect(cycle.startExplanationPreview).toHaveBeenNthCalledWith(1, 0);
    expect(narration.play).toHaveBeenNthCalledWith(
      1,
      "story.acts.act4.narration.story.intro.chart",
      { behavior: "replace", params: {} },
    );
    expect(narration.play).toHaveBeenNthCalledWith(
      2,
      "story.acts.act4.narration.story.intro.reference",
      { behavior: "replace", params: {} },
    );
    expect(cycle.startPreparedCycleFromIndex).toHaveBeenCalledWith(0, false);

    await flushTargetNarrationWatcher();

    expect(narration.play).toHaveBeenNthCalledWith(
      3,
      "story.acts.act4.narration.story.reference.winter",
      expect.objectContaining({
        behavior: "replace",
        params: expect.objectContaining({
          period: "1995-1999",
          movementValue: "100",
        }),
      }),
    );
    expect(
      cycle.startPreparedCycleFromIndex.mock.invocationCallOrder[0],
    ).toBeLessThan(narration.play.mock.invocationCallOrder[2]!);
    expect(
      narration.play.mock.calls.some(([cueKey]) =>
        String(cueKey).includes("tutorial"),
      ),
    ).toBe(false);
    expect(cycle.waitForExplanationPreviewBars).toHaveBeenNthCalledWith(1, 1);
    expect(cycle.waitForExplanationPreviewBars).toHaveBeenCalledTimes(1);
    expect(controller.store.sequenceStatus).toBe("performing");
    expect(controller.store.currentTarget?.climateData?.isBaseline).toBe(true);
  });

  it("requests target story narration from target start even before preview refs update", async () => {
    const { controller, narration, cycle } = createHarness(undefined, {
      preparedCycleSetsPreview: false,
    });

    await controller.startStoryFlow();

    expect(cycle.startPreparedCycleFromIndex).toHaveBeenCalledWith(0, false);
    expect(cycle.currentBar.value).toBeNull();
    expect(cycle.seasonPhase.value).toBe("transition");
    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act4.narration.story.reference.winter",
      expect.objectContaining({
        behavior: "replace",
        params: expect.objectContaining({
          period: "1995-1999",
          movementValue: "100",
        }),
      }),
    );
  });

  it("plays all reference target cues once before the semantic switch", async () => {
    const { controller, narration, queuedRestarts, cycle } = createHarness();

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();

    for (const expectedSeason of ["winter", "spring", "summer"] as const) {
      const target = controller.store.currentTarget;
      const nextTargetIndex = controller.store.currentTargetIndex + 1;

      expect(target?.season).toBe(expectedSeason);
      controller.handleRecognitionResult(target!, success());
      await queuedRestarts.at(-1)?.beforeRestart?.();
      await enterTargetPreview(cycle, nextTargetIndex);
    }

    expect(controller.store.currentTarget?.season).toBe("autumn");
    controller.handleRecognitionResult(
      controller.store.currentTarget!,
      success(),
    );
    await queuedRestarts.at(-1)?.beforeRestart?.();
    await enterTargetPreview(cycle, 4);

    expect(narration.play.mock.calls.map(([cueKey]) => cueKey)).toEqual([
      "story.acts.act4.narration.story.intro.chart",
      "story.acts.act4.narration.story.intro.reference",
      "story.acts.act4.narration.story.reference.winter",
      "story.acts.act4.narration.story.reference.spring",
      "story.acts.act4.narration.story.reference.summer",
      "story.acts.act4.narration.story.reference.autumn",
      "story.acts.act4.narration.story.referenceComplete.summary",
      "story.acts.act4.narration.story.referenceComplete.scale",
      "story.acts.act4.narration.story.2000_2004.winter",
    ]);
    expect(cycle.startExplanationPreview).toHaveBeenNthCalledWith(2, 4);
    expect(controller.store.currentTarget?.interval).toBe("2000-2004");
    expect(controller.store.currentTarget?.season).toBe("winter");
  });

  it("plays every authored story target cue exactly once in a successful story run", async () => {
    const { controller, narration, queuedRestarts, cycle } = createHarness();

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();

    while (
      controller.store.currentTargetIndex <
      controller.store.targets.length - 1
    ) {
      const nextTargetIndex = controller.store.currentTargetIndex + 1;

      controller.handleRecognitionResult(
        controller.store.currentTarget!,
        success(),
      );
      await queuedRestarts.at(-1)?.beforeRestart?.();
      await enterTargetPreview(cycle, nextTargetIndex);
    }

    const targetCueKeys = act4StoryTargetCueIds.map(
      (cueId) => act4StoryNarrationCatalog[cueId].textKey,
    );
    const playedTargetCueKeys = narration.play.mock.calls
      .map(([cueKey]) => String(cueKey))
      .filter((cueKey) => targetCueKeys.includes(cueKey));

    expect(playedTargetCueKeys).toEqual(targetCueKeys);
    expect(new Set(playedTargetCueKeys).size).toBe(24);
  });

  it("plays every authored comparison target cue exactly once in a successful story run", async () => {
    const { controller, narration, queuedRestarts, cycle } = createHarness();

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();

    while (
      controller.store.currentTargetIndex <
      controller.store.targets.length - 1
    ) {
      const nextTargetIndex = controller.store.currentTargetIndex + 1;

      controller.handleRecognitionResult(
        controller.store.currentTarget!,
        success(),
      );
      await queuedRestarts.at(-1)?.beforeRestart?.();
      await enterTargetPreview(cycle, nextTargetIndex);
    }

    const comparisonCueKeys = act4StoryTargetCueIds
      .filter((cueId) => !cueId.includes(".reference."))
      .map((cueId) => act4StoryNarrationCatalog[cueId].textKey);
    const playedComparisonCueKeys = narration.play.mock.calls
      .map(([cueKey]) => String(cueKey))
      .filter((cueKey) => comparisonCueKeys.includes(cueKey));

    expect(comparisonCueKeys).toHaveLength(20);
    expect(playedComparisonCueKeys).toEqual(comparisonCueKeys);
    expect(new Set(playedComparisonCueKeys).size).toBe(20);
  });

  it("speaks comparison target cues on bar 1 without showing story text", async () => {
    const harness = createHarness();
    const { controller, narration } = harness;

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();
    await advanceToTargetIndex(harness, 4);

    expect(controller.store.currentTarget?.interval).toBe("2000-2004");
    expect(controller.store.currentTarget?.season).toBe("winter");
    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act4.narration.story.2000_2004.winter",
      expect.objectContaining({
        behavior: "replace",
        params: expect.objectContaining({
          period: "2000-2004",
          movementValue: "20",
        }),
      }),
    );
    expect(controller.store.storyNarration.phase).toBe("idle");
    expect(controller.isRecognitionSuppressed.value).toBe(false);
  });

  it("resolves and speaks the key comparison winter landmarks", async () => {
    const harness = createHarness();
    const { controller, narration } = harness;

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();
    await advanceToTargetIndex(harness, 12);

    expect(controller.store.currentTarget?.interval).toBe("2010-2014");
    expect(controller.store.currentTarget?.season).toBe("winter");
    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act4.narration.story.2010_2014.winter",
      expect.objectContaining({
        behavior: "replace",
        params: expect.objectContaining({
          deltaAbs: "point three",
          deltaAbsSpoken: "point three",
          movementValue: "minus 10",
        }),
      }),
    );

    await advanceToTargetIndex(harness, 20);

    expect(controller.store.currentTarget?.interval).toBe("2020-2024");
    expect(controller.store.currentTarget?.season).toBe("winter");
    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act4.narration.story.2020_2024.winter",
      expect.objectContaining({
        behavior: "replace",
        params: expect.objectContaining({
          delta: "two point three",
          deltaSpoken: "two point three",
          movementValue: "100",
        }),
      }),
    );
  });

  it("starts the next period winter cue on bar 1 instead of during transition", async () => {
    const harness = createHarness();
    const { controller, narration, queuedRestarts, cycle } = harness;

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();
    await advanceToTargetIndex(harness, 7);

    expect(controller.store.currentTarget?.interval).toBe("2000-2004");
    expect(controller.store.currentTarget?.season).toBe("autumn");

    controller.handleRecognitionResult(
      controller.store.currentTarget!,
      success(),
    );
    queuedRestarts.at(-1)?.options?.onInterludeStart?.();

    expect(queuedRestarts.at(-1)?.options?.interludeDurationMs).toBe(8_000);
    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act4.narration.story.transition.2000_2004",
      { behavior: "replace" },
    );
    expect(
      narration.play.mock.calls.some(
        ([cueKey]) =>
          cueKey === "story.acts.act4.narration.story.2005_2009.winter",
      ),
    ).toBe(false);

    await queuedRestarts.at(-1)?.beforeRestart?.();
    await enterTargetPreview(cycle, 8);

    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act4.narration.story.2005_2009.winter",
      expect.objectContaining({
        behavior: "replace",
        params: expect.objectContaining({ period: "2005-2009" }),
      }),
    );
  });

  it("plays period transitions once per completed comparison period", async () => {
    const harness = createHarness();
    const { controller, narration, queuedRestarts } = harness;

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();

    for (const targetIndex of [7, 11, 15, 19]) {
      await advanceToTargetIndex(harness, targetIndex);

      controller.handleRecognitionResult(
        controller.store.currentTarget!,
        success(),
      );
      queuedRestarts.at(-1)?.options?.onInterludeStart?.();
      queuedRestarts.at(-1)?.options?.onInterludeStart?.();

      if (targetIndex < 19) {
        await queuedRestarts.at(-1)?.beforeRestart?.();
        await enterTargetPreview(harness.cycle, targetIndex + 1);
      }
    }

    const transitionCueKeys = [
      "story.acts.act4.narration.story.transition.2000_2004",
      "story.acts.act4.narration.story.transition.2005_2009",
      "story.acts.act4.narration.story.transition.2010_2014",
      "story.acts.act4.narration.story.transition.2015_2019",
    ];
    const playedTransitionCueKeys = narration.play.mock.calls
      .map(([cueKey]) => String(cueKey))
      .filter((cueKey) => transitionCueKeys.includes(cueKey));

    expect(playedTransitionCueKeys).toEqual(transitionCueKeys);
  });

  it("awaits final climate story completion cues before completing the act", async () => {
    const completionOrder: string[] = [];
    const harness = createHarness(async (cueKey) => {
      completionOrder.push(cueKey);
      return { status: "completed" };
    });
    const { controller, cycle, narration, queuedEndActions } = harness;

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();
    await advanceToTargetIndex(harness, 23);

    expect(controller.store.currentTarget?.interval).toBe("2020-2024");
    expect(controller.store.currentTarget?.season).toBe("autumn");

    controller.handleRecognitionResult(
      controller.store.currentTarget!,
      success(),
    );
    queuedEndActions.at(-1)?.();

    for (let index = 0; index < 20; index += 1) {
      await Promise.resolve();
    }

    const completionCueKeys = act4StoryCompletionCueIds.map(
      (cueId) => act4StoryNarrationCatalog[cueId].textKey,
    );
    const playedCompletionCueKeys = narration.play.mock.calls
      .map(([cueKey]) => String(cueKey))
      .filter((cueKey) => completionCueKeys.includes(cueKey));

    expect(playedCompletionCueKeys).toEqual(completionCueKeys);
    expect(completionOrder.slice(-completionCueKeys.length)).toEqual(
      completionCueKeys,
    );
    expect(
      narration.play.mock.calls.some(
        ([cueKey]) =>
          cueKey === "story.acts.act4.narration.story.transition.2020_2024",
      ),
    ).toBe(false);
    expect(cycle.complete).toHaveBeenCalledTimes(1);
  });

  it("plays the real climate outro directly from debug idle state", async () => {
    const completionOrder: string[] = [];
    const { controller, cycle, narration, recognition } = createHarness(
      async (cueKey) => {
        completionOrder.push(cueKey);
        return { status: "completed" };
      },
    );

    await controller.playDebugOutro();

    const completionCueKeys = act4StoryCompletionCueIds.map(
      (cueId) => act4StoryNarrationCatalog[cueId].textKey,
    );

    expect(completionOrder).toEqual(completionCueKeys);
    expect(narration.stop).toHaveBeenCalledTimes(1);
    expect(recognition.resetAll).toHaveBeenCalledTimes(1);
    expect(cycle.complete).toHaveBeenCalledTimes(1);
    expect(controller.store.sequenceStatus).toBe("completed");
    expect(controller.store.flowId).toBe("act4Story");
    expect(controller.store.climateCompletedStepIds).toHaveLength(24);
  });

  it("cancels active target narration before playing debug outro", async () => {
    const deferred = createDeferredNarration();
    const completionOrder: string[] = [];
    const { controller, narration, recognition } = createHarness(
      async (cueKey) => {
        if (cueKey === "story.acts.act4.narration.story.reference.winter") {
          return deferred.promise;
        }

        completionOrder.push(cueKey);
        return { status: "completed" };
      },
    );

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();
    narration.stop.mockClear();
    vi.mocked(recognition.resetAll).mockClear();

    await controller.playDebugOutro();

    const completionCueKeys = act4StoryCompletionCueIds.map(
      (cueId) => act4StoryNarrationCatalog[cueId].textKey,
    );

    expect(narration.stop).toHaveBeenCalledTimes(1);
    expect(recognition.resetAll).toHaveBeenCalledTimes(1);
    expect(completionOrder.slice(-completionCueKeys.length)).toEqual(
      completionCueKeys,
    );

    deferred.resolve({ status: "cancelled" });
    await deferred.promise;
  });

  it("does not replay reference narration on retry", async () => {
    const { controller, narration, queuedRestarts, cycle } = createHarness();

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();

    controller.handleRecognitionResult(
      controller.store.currentTarget!,
      success(),
    );
    await queuedRestarts.at(-1)?.beforeRestart?.();
    await enterTargetPreview(cycle, 1);
    controller.handleRecognitionResult(
      controller.store.currentTarget!,
      success(),
    );
    await queuedRestarts.at(-1)?.beforeRestart?.();
    await enterTargetPreview(cycle, 2);

    const summerTarget = controller.store.currentTarget;

    expect(summerTarget?.season).toBe("summer");

    controller.handleRecognitionResult(
      summerTarget!,
      fail("RAISE_ARMS_HIGHER"),
    );
    queuedRestarts.at(-1)?.options?.onInterludeStart?.();
    await queuedRestarts.at(-1)?.beforeRestart?.();
    await enterTargetPreview(cycle, 2);

    controller.handleRecognitionResult(
      summerTarget!,
      fail("RAISE_ARMS_HIGHER"),
    );
    queuedRestarts.at(-1)?.options?.onInterludeStart?.();

    const summerReferenceCueCount = narration.play.mock.calls.filter(
      ([cueKey]) =>
        cueKey === "story.acts.act4.narration.story.reference.summer",
    ).length;

    expect(summerReferenceCueCount).toBe(1);
    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act4.narration.feedback.summer.raiseArmsHigher",
      { behavior: "replace" },
    );
  });

  it("does not replay comparison narration on retry", async () => {
    const harness = createHarness();
    const { controller, narration, queuedRestarts, cycle } = harness;

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();
    await advanceToTargetIndex(harness, 4);

    const comparisonTarget = controller.store.currentTarget;

    expect(comparisonTarget?.interval).toBe("2000-2004");
    expect(comparisonTarget?.season).toBe("winter");

    controller.handleRecognitionResult(
      comparisonTarget!,
      fail("CONTRACT_MORE"),
    );
    queuedRestarts.at(-1)?.options?.onInterludeStart?.();
    await queuedRestarts.at(-1)?.beforeRestart?.();
    await enterTargetPreview(cycle, 4);

    controller.handleRecognitionResult(
      comparisonTarget!,
      fail("CONTRACT_MORE"),
    );
    queuedRestarts.at(-1)?.options?.onInterludeStart?.();

    const comparisonCueCount = narration.play.mock.calls.filter(
      ([cueKey]) =>
        cueKey === "story.acts.act4.narration.story.2000_2004.winter",
    ).length;

    expect(comparisonCueCount).toBe(1);
    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act4.narration.feedback.winter.contractMore",
      { behavior: "replace" },
    );
  });

  it("lets target story narration continue when recognition starts in bar 2", async () => {
    const deferred = createDeferredNarration();
    const { controller, narration, cycle } = createHarness(async (cueKey) =>
      cueKey === "story.acts.act4.narration.story.reference.winter"
        ? deferred.promise
        : { status: "completed" },
    );

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();
    narration.stop.mockClear();

    cycle.currentBar.value = 2;
    cycle.seasonPhase.value = "performance";
    cycle.evaluationEnabled.value = true;
    await flushTargetNarrationWatcher();

    expect(narration.stop).not.toHaveBeenCalled();

    deferred.resolve({ status: "completed" });
    await deferred.promise;
  });

  it("cancels stale target story narration when the next target cue starts", async () => {
    const deferred = createDeferredNarration();
    const { controller, narration, queuedRestarts, cycle } = createHarness(
      async (cueKey) =>
        cueKey === "story.acts.act4.narration.story.reference.winter"
          ? deferred.promise
          : { status: "completed" },
    );

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();
    narration.stop.mockClear();

    controller.handleRecognitionResult(
      controller.store.currentTarget!,
      success(),
    );
    await queuedRestarts.at(-1)?.beforeRestart?.();
    await enterTargetPreview(cycle, 1);

    expect(narration.stop).toHaveBeenCalledTimes(1);
    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act4.narration.story.reference.spring",
      expect.objectContaining({ behavior: "replace" }),
    );

    deferred.resolve({ status: "completed" });
    await deferred.promise;
  });

  it("suppresses recognition during story narration interludes", async () => {
    const { controller, target } = createHarness();

    controller.store.enterStoryNarration({
      phase: "story-intro",
      status: "storyIntro",
      targetIndex: 0,
      cueId: "act4.story.intro.chart",
      textKey: "story.acts.act4.narration.story.intro.chart",
    });

    controller.handleRecognitionResult(target, success());

    expect(controller.isRecognitionSuppressed.value).toBe(true);
    expect(controller.store.sequenceStatus).toBe("storyIntro");
    expect(controller.store.completedStepIds).toEqual([]);
  });

  it("does not suppress recognition for target narration during performance", async () => {
    const { controller } = createHarness();

    await controller.startStoryFlow();
    await flushTargetNarrationWatcher();

    expect(controller.store.sequenceStatus).toBe("performing");
    expect(controller.store.storyNarration.phase).toBe("idle");
    expect(controller.isRecognitionSuppressed.value).toBe(false);
  });

  it("hands the completed tutorial into the climate story intro", async () => {
    const { controller, narration, queuedRestarts, cycle, recognition } =
      createHarness();
    const tutorialTarget = createTutorialAutumnMinimumTarget();
    const referenceTarget = createReferenceTarget("winter");

    controller.store.startFlow("act4Full", [tutorialTarget, referenceTarget]);
    controller.store.startTarget(0);

    controller.handleRecognitionResult(tutorialTarget, success());
    await queuedRestarts[0]?.beforeRestart?.();

    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act4.narration.tutorial.autumn.complete",
      { behavior: "replace", params: {} },
    );
    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act4.narration.story.intro.chart",
      { behavior: "replace", params: {} },
    );
    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act4.narration.story.intro.reference",
      { behavior: "replace", params: {} },
    );
    expect(cycle.queueSeasonIndexRestart).toHaveBeenCalledWith(
      0,
      false,
      expect.any(Function),
      expect.objectContaining({
        restartSeasonIndex: 1,
        preserveBaseRhythm: true,
      }),
    );
    expect(cycle.startExplanationPreview).toHaveBeenCalledWith(1);
    await enterTargetPreview(cycle, 1);
    expect(recognition.startTarget).toHaveBeenLastCalledWith(referenceTarget, {
      keepCalibration: true,
      manual: false,
    });
    expect(narration.play).toHaveBeenCalledWith(
      "story.acts.act4.narration.story.reference.winter",
      expect.objectContaining({
        behavior: "replace",
        params: expect.objectContaining({ period: "1995-1999" }),
      }),
    );
  });
});
