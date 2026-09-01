import { createPinia, setActivePinia } from "pinia";
import { nextTick, reactive, shallowRef } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isGuidedBlockingInteractionPhase,
  useGuidedMigrationController,
} from "~/composables/act2/useGuidedMigrationController";
import { GUIDED_ACT2_NARRATION_RATE } from "~/composables/act2/useGuidedAct2Narration";
import type { MigrationActRuntimeService } from "~/composables/migrationActs/useMigrationActRuntime";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import type {
  MigrationActEvent,
  GuidedMigrationPhase,
  MigrationGestureEvaluationResult,
  MigrationMovementBarEvaluation,
  MigrationMovementPhraseEvaluation,
  MigrationMovementRecognitionProfile,
} from "~/types/migrationAct";
import type { StoryTimelineDay } from "~/utils/storyCycle";
import { resolveMigrationMovement } from "~/utils/migrationActs/migrationMovementSelection";

const immediateTiming = {
  gestureHandoverStartBarOffsetMs: 0,
  storyTransitionMs: {
    summerToDeparture: 10,
    autumnMigration: 10,
    winterToDeparture: 10,
    springMigration: 10,
  },
};

const createTimelineDay = ({
  date,
  relativeDay,
  phase,
  event = null,
}: Pick<StoryTimelineDay, "date" | "relativeDay" | "phase"> &
  Partial<Pick<StoryTimelineDay, "event">>): StoryTimelineDay => ({
  date,
  relativeDay,
  phase,
  event,
  isMigrationDay: phase.includes("migration"),
  isRestDay: phase.includes("rest"),
  referenceWeight: 1,
  timingClass: phase.includes("migration") ? "migration" : "rest",
  canonicalStartMs: relativeDay * 100,
  canonicalEndMs: (relativeDay + 1) * 100,
  dayDurationMs: 100,
  startMs: relativeDay * 100,
  endMs: (relativeDay + 1) * 100,
});

const timeline: StoryTimelineDay[] = [
  createTimelineDay({
    date: "2013-06-01",
    relativeDay: 0,
    phase: "summer_rest",
  }),
  createTimelineDay({
    date: "2013-08-12",
    relativeDay: 1,
    phase: "autumn_migration",
    event: "autumn_departure",
  }),
  createTimelineDay({
    date: "2013-10-06",
    relativeDay: 2,
    phase: "winter_rest",
    event: "autumn_arrival",
  }),
  createTimelineDay({
    date: "2014-03-15",
    relativeDay: 3,
    phase: "spring_migration",
    event: "spring_departure",
  }),
  createTimelineDay({
    date: "2014-05-28",
    relativeDay: 4,
    phase: "summer_rest",
    event: "spring_arrival",
  }),
];

const events: MigrationActEvent[] = timeline.flatMap((day) =>
  day.event
    ? [
        {
          id: `event-${day.event}`,
          cycleRunId: "guided-run",
          cycleId: "guided-cycle",
          eventType: day.event,
          gestureId: day.event.includes("departure") ? "departure" : "arrival",
          boundaryDate: day.date,
          boundaryTimeMs: day.startMs,
          status: "pending",
        },
      ]
    : [],
);

const flushFlow = async () => {
  for (let index = 0; index < 20; index++) await Promise.resolve();
  await nextTick();
};

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

const profileForMovement = (
  movementId: string,
): MigrationMovementRecognitionProfile =>
  movementId === "summer-step"
    ? "summer_rest"
    : movementId === "winter-step"
      ? "winter_rest"
      : "migration";

const createEvaluation = ({
  id,
  movementId,
  status,
}: {
  id: string;
  movementId: string;
  status: MigrationMovementBarEvaluation["status"];
}): MigrationMovementBarEvaluation => ({
  evaluationId: id,
  sessionId: 1,
  profile: profileForMovement(movementId),
  movementId,
  barIndex: Number(id.replace(/\D/g, "")) || 0,
  status,
  beatResults: [],
  criteria: {
    wingBeat: status,
    stepActivity: status,
    stanceWidthChange: status,
    verticalBounce: status,
  },
  evaluatedAtMs: 0,
});

const createHarness = () => {
  const store = useMigrationActStore();
  store.prepare({
    actId: "act-2",
    cycleRuns: [
      {
        id: "guided-run",
        cycleId: "guided-cycle",
        cycleStartYear: 2013,
        title: "Guided cycle",
      },
    ],
  });
  store.prepareCycle({ activeCycleIndex: 0, timeline, events });
  store.setPlaybackState("idle");
  const lastBarEvaluation = shallowRef<MigrationMovementBarEvaluation | null>(
    null,
  );
  const lastPhraseEvaluation =
    shallowRef<MigrationMovementPhraseEvaluation | null>(null);
  const calls = {
    movementDemonstrations: [] as string[],
    gestureDemonstrations: [] as string[],
    gesturePractices: [] as string[],
    transitions: [] as Array<{
      start: number;
      target: number;
      duration: number;
    }>,
  };
  const gestureStore = reactive({
    feedbackText: "",
    latestEvaluationResult: null as MigrationGestureEvaluationResult | null,
    isActive: false,
    activeGestureId: null as "departure" | "arrival" | null,
  });
  const runtime = {
    store,
    movementRecognition: { lastBarEvaluation, lastPhraseEvaluation },
    gestures: { store: gestureStore },
    enterGuidedInterlude: vi.fn(async () => {
      store.setPlaybackState("playing");
    }),
    cancelGuidedInterlude: vi.fn(),
    preloadTutorialMovement: vi.fn(async () => true),
    continueTutorialMovement: vi.fn(() => true),
    startTutorialStoryMovement: vi.fn(async () => true),
    forceCompleteGuidedRecognition: vi.fn(() => false),
    playTutorialDemonstration: vi.fn(
      async (movement, repetitions, onRepetition) => {
        calls.movementDemonstrations.push(movement.movementId);
        onRepetition?.(1);
        onRepetition?.(repetitions);
      },
    ),
    stopTutorialMovement: vi.fn(),
    playGuidedGesturePreparation: vi.fn(
      async ({ gestureId, demonstrationBars, onPreparationBar }) => {
        calls.gestureDemonstrations.push(gestureId);
        onPreparationBar?.(1);
        onPreparationBar?.(demonstrationBars);
        calls.gesturePractices.push(gestureId);
        return "completed" as const;
      },
    ),
    startGuidedGesturePractice: vi.fn(async (gestureId) => {
      calls.gesturePractices.push(gestureId);
      return "completed" as const;
    }),
    playGuidedStoryTransition: vi.fn(
      async ({ targetElapsedMs, durationMs, onBar }) => {
        calls.transitions.push({
          start: store.currentElapsedMs,
          target: targetElapsedMs,
          duration: durationMs,
        });
        onBar?.(0);
        onBar?.(1);
        onBar?.(2);
        store.setElapsedMs(targetElapsedMs);
      },
    ),
    waitForGuidedBars: vi.fn(async () => undefined),
    waitForGuidedBeats: vi.fn(async () => undefined),
    getGuidedTransportMs: vi.fn(() => 0),
    completeGuidedInterlude: vi.fn(),
    resolveCurrentPhaseMovement: vi.fn(() =>
      resolveMigrationMovement({
        phase: store.currentPhase!,
        phaseDurationMs: 100,
      }),
    ),
    pause: vi.fn(),
    resume: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
  } as unknown as MigrationActRuntimeService;
  const completed = vi.fn();
  const instructionNarration = {
    play: vi.fn(async () => ({ status: "completed" as const })),
    speakText: vi.fn(async (_text, options) => {
      options?.onStart?.({
        rate: GUIDED_ACT2_NARRATION_RATE,
        voiceName: "Test voice",
      });
      options?.onEnd?.({
        status: "completed",
        rate: GUIDED_ACT2_NARRATION_RATE,
        voiceName: "Test voice",
      });
      return { status: "completed" as const };
    }),
    stop: vi.fn(),
  };
  const controller = useGuidedMigrationController({
    runtime,
    enabled: true,
    timing: immediateTiming,
    onGuidedCycleCompleted: completed,
    instructionNarration,
  });
  controller.initialize();

  const publish = async (
    movementId: string,
    id: string,
    status: MigrationMovementBarEvaluation["status"],
  ) => {
    lastBarEvaluation.value = createEvaluation({ id, movementId, status });
    await nextTick();
    await flushFlow();
  };
  const publishPhrase = async (
    movementId: string,
    id: string,
    status: MigrationMovementPhraseEvaluation["status"],
    phraseIndex: MigrationMovementPhraseEvaluation["phraseIndex"] = 1,
  ) => {
    lastPhraseEvaluation.value = {
      evaluationId: id,
      sessionId: 1,
      profile: "migration-guided",
      movementId,
      barIndex: Number(id.replace(/\D/g, "")) || 0,
      phraseIndex,
      status,
      beatResults: [],
      evaluatedAtMs: 0,
    };
    await nextTick();
    await flushFlow();
  };

  const completeMovement = async (movementId: string, prefix: string) => {
    if (movementId.includes("migration")) {
      await publishPhrase(movementId, `${prefix}-failure`, "failed");
      await publishPhrase(movementId, `${prefix}-tracking`, "not_evaluable");
      await publishPhrase(movementId, `${prefix}-1`, "success");
      await publishPhrase(movementId, `${prefix}-1`, "success");
      await publishPhrase(movementId, `${prefix}-2`, "success", 2);
      await publishPhrase(movementId, `${prefix}-3`, "success");
      return;
    }

    await publish(movementId, `${prefix}-failure`, "failed");
    await publish(movementId, `${prefix}-tracking`, "not_evaluable");
    await publish(movementId, `${prefix}-1`, "success");
    await publish(movementId, `${prefix}-1`, "success");
    await publish(movementId, `${prefix}-2`, "success");
    await publish(movementId, `${prefix}-3`, "success");
  };

  return {
    store,
    runtime,
    controller,
    calls,
    completed,
    instructionNarration,
    gestureStore,
    publish,
    publishPhrase,
    completeMovement,
  };
};

describe("guided migration controller", () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.useRealTimers());

  it.each([1, 2, 3, 4, 5])(
    "runs the complete annual tutorial deterministically (run %s)",
    async () => {
      const {
        controller,
        store,
        calls,
        completed,
        completeMovement,
        publish,
        publishPhrase,
      } = createHarness();

      expect(store.guided.phase).toBe("idle");
      expect(controller.panelModel.value.actions).toEqual([
        expect.objectContaining({ id: "startGuidedJourney", primary: true }),
      ]);
      controller.startGuidedJourney();
      await flushFlow();
      expect(store.guided.phase).toBe("summer-practice");
      expect(controller.panelModel.value.actions).toEqual([]);
      expect(controller.panelModel.value.progress).toEqual({
        current: 0,
        total: 3,
        label: "0 of 3 successful movements",
      });

      await completeMovement("summer-step", "summer");
      expect(store.guided.phase).toBe("autumn-migration-practice");
      expect(store.guided.successfulBars).toBe(0);
      expect(controller.panelModel.value.progress).toEqual({
        current: 0,
        total: 3,
        label: "0 of 3 successful movements",
      });
      expect(calls.gestureDemonstrations).toEqual(["departure"]);
      expect(calls.gesturePractices).toEqual(["departure"]);
      expect(calls.transitions[0]).toEqual({
        start: 0,
        target: 100,
        duration: 10,
      });

      await publish("summer-step", "old-summer-id", "success");
      expect(store.guided.successfulBars).toBe(0);
      const autumnMovement = store.guided.activeMovementId!;
      await publish(autumnMovement, "autumn-bar-success", "success");
      expect(store.guided.successfulBars).toBe(0);
      await publishPhrase(autumnMovement, "autumn-phrase-failed", "failed");
      expect(store.guided.successfulBars).toBe(0);
      await publishPhrase(autumnMovement, "autumn-phrase-1", "success");
      expect(store.guided.successfulBars).toBe(1);
      expect(controller.panelModel.value.progress).toEqual({
        current: 1,
        total: 3,
        label: "1 of 3 successful movements",
      });
      await publishPhrase(autumnMovement, "autumn-phrase-2", "success", 2);
      expect(store.guided.successfulBars).toBe(2);
      expect(controller.panelModel.value.progress).toEqual({
        current: 2,
        total: 3,
        label: "2 of 3 successful movements",
      });
      await publishPhrase(autumnMovement, "autumn-phrase-3", "success");
      expect(store.guided.phase).toBe("winter-practice");
      expect(controller.panelModel.value.progress).toEqual({
        current: 0,
        total: 3,
        label: "0 of 3 successful movements",
      });
      expect(calls.gestureDemonstrations).toEqual(["departure", "arrival"]);
      expect(calls.gesturePractices).toEqual(["departure", "arrival"]);

      await completeMovement("winter-step", "winter");
      expect(store.guided.phase).toBe("spring-migration-practice");
      expect(calls.gestureDemonstrations).toEqual(["departure", "arrival"]);
      expect(calls.gesturePractices).toEqual([
        "departure",
        "arrival",
        "departure",
      ]);

      const springMovement = store.guided.activeMovementId!;
      await completeMovement(springMovement, "spring");
      expect(store.guided.phase).toBe("cycle-complete");
      expect(store.guided.completionCount).toBe(1);
      expect(calls.gesturePractices).toEqual([
        "departure",
        "arrival",
        "departure",
        "arrival",
      ]);
      expect(calls.movementDemonstrations).toHaveLength(4);
      expect(calls.transitions.map((item) => item.target)).toEqual([
        100, 200, 300, 400, 400,
      ]);
      expect(completed).toHaveBeenCalledOnce();

      controller.startGuidedJourney();
      await flushFlow();
      expect(completed).toHaveBeenCalledOnce();
      expect(store.guided.completionCount).toBe(1);
    },
  );

  it("starts Summer and its introduction in the same start operation", async () => {
    const { controller, runtime, store } = createHarness();
    const demonstration = createDeferred<undefined>();
    runtime.playTutorialDemonstration = vi.fn(
      async () => await demonstration.promise,
    );

    controller.startGuidedJourney();
    await flushFlow();

    expect(runtime.enterGuidedInterlude).toHaveBeenCalledWith(
      expect.objectContaining({ movementId: "summer-step" }),
    );
    expect(store.guided.phase).toBe("journey-introduction");
    demonstration.resolve(undefined);
    controller.dispose();
  });

  it("uses four uninterrupted opening bars before Summer Practice", async () => {
    const demonstration = createDeferred<undefined>();
    const { controller, runtime, store, instructionNarration } =
      createHarness();
    runtime.playTutorialDemonstration = vi.fn(
      async (_movement, repetitions, onRepetition, options) => {
        expect(repetitions).toBe(4);
        expect(options).toEqual({ handoverToPractice: true });
        onRepetition?.(1);
        onRepetition?.(2);
        onRepetition?.(3);
        onRepetition?.(4);
        await demonstration.promise;
      },
    );

    controller.startGuidedJourney();
    await flushFlow();
    expect(store.guided.phase).toBe("summer-practice-prompt");
    expect(controller.panelModel.value.instruction).toContain(
      "Follow the avatar",
    );
    expect(
      controller.narrationDiagnostics.value.events
        .filter((event) => event.outcome === "scheduled")
        .map((event) => event.id),
    ).toEqual([
      "act2.introduction.annualJourney",
      "act2.introduction.summerBreeding",
      "act2.summer.instruction",
      "act2.summer.handover",
    ]);
    expect(runtime.playTutorialDemonstration).toHaveBeenCalledOnce();
    expect(runtime.continueTutorialMovement).not.toHaveBeenCalled();
    expect(instructionNarration.speakText).toHaveBeenLastCalledWith(
      "Now it's your turn. Follow the avatar.",
      expect.objectContaining({
        behavior: "replace",
        rate: GUIDED_ACT2_NARRATION_RATE,
      }),
    );

    demonstration.resolve(undefined);
    await flushFlow();
    expect(store.guided.phase).toBe("summer-practice");
    expect(runtime.continueTutorialMovement).not.toHaveBeenCalled();
    controller.dispose();
    expect(instructionNarration.stop).toHaveBeenCalled();
  });

  it("narrates two watch bars and hands over in countdown bar three", async () => {
    const preparation = createDeferred<"completed">();
    let handoverStart: (() => void) | undefined;
    let attemptStart: (() => void) | undefined;
    const {
      controller,
      runtime,
      store,
      instructionNarration,
      completeMovement,
    } = createHarness();
    runtime.playGuidedGesturePreparation = vi.fn(
      async ({
        gestureId,
        demonstrationBars,
        handoverStartBarOffsetMs,
        onPreparationBar,
        onHandoverStart,
        onAttemptStart,
      }) => {
        expect(gestureId).toBe("departure");
        expect(demonstrationBars).toBe(2);
        expect(handoverStartBarOffsetMs).toBe(0);
        onPreparationBar?.(1);
        onPreparationBar?.(2);
        handoverStart = onHandoverStart;
        attemptStart = onAttemptStart;
        return await preparation.promise;
      },
    );

    controller.startGuidedJourney();
    await flushFlow();
    instructionNarration.speakText.mockClear();
    await completeMovement("summer-step", "summer");
    expect(store.guided.phase).toBe("autumn-departure-demonstration");
    const preparationNarrationCount =
      instructionNarration.speakText.mock.calls.length;
    expect(instructionNarration.speakText).toHaveBeenLastCalledWith(
      "Crouch, rise with your hands overhead, then open your arms.",
      expect.objectContaining({
        behavior: "replace",
        rate: GUIDED_ACT2_NARRATION_RATE,
      }),
    );

    handoverStart?.();
    expect(store.guided.phase).toBe("autumn-departure-practice-prompt");
    expect(instructionNarration.speakText).toHaveBeenCalledWith(
      "During the countdown, move into a crouch so you're ready on count one.",
      expect.objectContaining({
        behavior: "replace",
        rate: GUIDED_ACT2_NARRATION_RATE,
      }),
    );
    expect(instructionNarration.speakText).toHaveBeenCalledTimes(
      preparationNarrationCount + 1,
    );

    attemptStart?.();
    expect(store.guided.phase).toBe("autumn-departure-practice");

    preparation.resolve("completed");
    await flushFlow();
    expect(store.guided.phase).toBe("autumn-migration-practice");
  });

  it("resets practice progress and blocks late evaluations", async () => {
    const { controller, runtime, store, publish } = createHarness();
    controller.startGuidedJourney();
    await flushFlow();
    await publish("summer-step", "summer-1", "success");
    expect(store.guided.successfulBars).toBe(1);
    expect(controller.panelModel.value.progress).toEqual({
      current: 1,
      total: 3,
      label: "1 of 3 successful movements",
    });

    await controller.resetAct();
    expect(runtime.cancelGuidedInterlude).toHaveBeenCalled();
    expect(store.guided.phase).toBe("idle");
    expect(store.guided.successfulBars).toBe(0);
    expect(controller.panelModel.value.progress).toBeUndefined();
    await publish("summer-step", "summer-late", "success");
    expect(store.guided.phase).toBe("idle");
    expect(store.guided.successfulBars).toBe(0);
    expect(controller.panelModel.value.progress).toBeUndefined();
  });

  it("keeps ordinary movement failures silent without resetting progress", async () => {
    const { controller, store, publish, instructionNarration } =
      createHarness();
    controller.startGuidedJourney();
    await flushFlow();
    expect(store.guided.phase).toBe("summer-practice");
    const panelBeforeFailure = controller.panelModel.value.instruction;
    const callsBeforeFailure = instructionNarration.speakText.mock.calls.length;

    await publish("summer-step", "summer-first-success", "success");
    expect(store.guided.successfulBars).toBe(1);
    expect(controller.panelModel.value.progress).toEqual({
      current: 1,
      total: 3,
      label: "1 of 3 successful movements",
    });

    await publish("summer-step", "summer-quiet-failure", "failed");
    expect(store.guided.successfulBars).toBe(1);
    expect(controller.panelModel.value.progress).toEqual({
      current: 1,
      total: 3,
      label: "1 of 3 successful movements",
    });
    expect(controller.panelModel.value.instruction).toBe(panelBeforeFailure);
    expect(instructionNarration.speakText).toHaveBeenCalledTimes(
      callsBeforeFailure,
    );

    await publish("summer-step", "summer-success-after-failure", "success");
    expect(store.guided.successfulBars).toBe(2);
    controller.dispose();
  });

  it("exposes progress only for continuous guided practice", async () => {
    const { controller, store } = createHarness();
    controller.startGuidedJourney();
    await flushFlow();

    store.setGuidedState({
      phase: "summer-practice",
      status: "practicing",
      activeMovementId: "summer-step",
      activeGestureId: null,
      successfulBars: 3,
      requiredSuccessfulBars: 3,
    });
    expect(controller.panelModel.value.progress).toEqual({
      current: 3,
      total: 3,
      label: "3 of 3 successful movements",
    });

    store.setGuidedState({
      phase: "summer-demonstration",
      status: "demonstrating",
      activeMovementId: "summer-step",
      activeGestureId: null,
      successfulBars: 1,
      requiredSuccessfulBars: 3,
    });
    expect(controller.panelModel.value.progress).toBeUndefined();

    store.setGuidedState({
      phase: "autumn-departure-practice",
      status: "practicing",
      activeMovementId: null,
      activeGestureId: "departure",
      successfulBars: 1,
      requiredSuccessfulBars: 3,
    });
    expect(controller.panelModel.value.progress).toBeUndefined();
    controller.dispose();
  });

  it("preserves criterion-specific Gesture failure narration", async () => {
    const { controller, gestureStore, instructionNarration } = createHarness();
    gestureStore.latestEvaluationResult = {
      id: "departure-failure-1",
      status: "failed",
      gestureId: "departure",
      attemptNumber: 1,
      checkpointId: "rise",
      failedCriteria: ["hands"],
      primaryFeedbackCode: "HANDS_UP",
    };
    await nextTick();

    expect(instructionNarration.speakText).toHaveBeenCalledWith(
      "story.migrationPanel.feedback.handsUp",
      expect.objectContaining({
        behavior: "replace",
        rate: GUIDED_ACT2_NARRATION_RATE,
      }),
    );
    controller.dispose();
  });

  it("cancels narration and ignores a stale countdown handover after reset", async () => {
    const { controller, runtime, instructionNarration, completeMovement } =
      createHarness();
    let staleHandover: (() => void) | undefined;
    runtime.playGuidedGesturePreparation = vi.fn(
      async ({ onHandoverStart }) => {
        staleHandover = onHandoverStart;
        return await new Promise<"completed">(() => undefined);
      },
    );

    controller.startGuidedJourney();
    await flushFlow();
    await completeMovement("summer-step", "summer");
    instructionNarration.play.mockClear();
    await controller.resetAct();
    staleHandover?.();

    expect(instructionNarration.stop).toHaveBeenCalled();
    expect(instructionNarration.play).not.toHaveBeenCalled();
  });

  it("keeps Summer Success in its own transport bar before Story Bar 0", async () => {
    const wait = createDeferred<undefined>();
    const { controller, runtime, store, completeMovement } = createHarness();
    runtime.waitForGuidedBars = vi.fn(async () => await wait.promise);

    controller.startGuidedJourney();
    await flushFlow();
    await completeMovement("summer-step", "summer");
    await flushFlow();

    expect(store.guided.phase).toBe("summer-success");
    expect(runtime.waitForGuidedBars).toHaveBeenCalledWith(1);
    expect(runtime.playGuidedStoryTransition).not.toHaveBeenCalled();

    wait.resolve(undefined);
    await flushFlow();
    expect(store.guided.phase).toBe("autumn-migration-practice");
    expect(
      controller.narrationDiagnostics.value.events
        .filter((event) => event.outcome === "scheduled")
        .map((event) => event.id),
    ).toContain("act2.summer.story.breeding");
  });

  it("keeps Departure Success in its own transport bar before Migration context", async () => {
    const wait = createDeferred<undefined>();
    const { controller, runtime, store, completeMovement } = createHarness();
    runtime.waitForGuidedBars = vi.fn().mockResolvedValueOnce(undefined);
    runtime.waitForGuidedBeats = vi.fn(async () => await wait.promise);

    controller.startGuidedJourney();
    await flushFlow();
    await completeMovement("summer-step", "summer");
    await flushFlow();

    expect(store.guided.phase).toBe("autumn-departure-success");
    expect(runtime.waitForGuidedBars).toHaveBeenCalledTimes(1);
    expect(runtime.waitForGuidedBeats).toHaveBeenCalledWith(2);
    expect(
      controller.narrationDiagnostics.value.events
        .filter((event) => event.outcome === "scheduled")
        .map((event) => event.id),
    ).not.toContain("act2.autumnMigration.context");

    wait.resolve(undefined);
    await flushFlow();
    expect(
      controller.narrationDiagnostics.value.events
        .filter((event) => event.outcome === "scheduled")
        .map((event) => event.id),
    ).toContain("act2.autumnMigration.context");
  });

  it("uses text-only Guided narration when speakText is unavailable", async () => {
    const { runtime } = createHarness();
    const textOnlyNarration = {
      play: vi.fn(async () => ({ status: "completed" as const })),
      stop: vi.fn(),
    };
    const controller = useGuidedMigrationController({
      runtime,
      enabled: true,
      timing: immediateTiming,
      instructionNarration: textOnlyNarration,
    });

    controller.initialize();
    controller.startGuidedJourney();
    await flushFlow();

    expect(textOnlyNarration.play).not.toHaveBeenCalled();
    expect(controller.panelModel.value.instruction).toContain(
      "Follow the avatar",
    );
    controller.dispose();
  });

  it("routes passive successful bars to transient panel feedback without progress", async () => {
    const { controller, runtime, store, publish } = createHarness();
    vi.useFakeTimers();
    store.setGuidedState({
      phase: "summer-demonstration",
      status: "demonstrating",
      activeMovementId: "summer-step",
      successfulBars: 0,
      requiredSuccessfulBars: 3,
    });
    runtime.getGuidedTransportMs = vi.fn(() => 10_000);

    await publish("summer-step", "passive-1", "success");
    expect(store.guided.successfulBars).toBe(0);
    expect(controller.panelModel.value.feedbackText).toBeUndefined();

    await publish("summer-step", "passive-2", "success");
    expect(store.guided.successfulBars).toBe(0);
    expect(controller.panelModel.value.instruction).toBe(
      controller.narrationDiagnostics.value.currentNarrationText,
    );
    expect(controller.panelModel.value.feedbackText).toBe("Good!");

    vi.advanceTimersByTime(1_250);
    await nextTick();
    expect(controller.panelModel.value.feedbackText).toBeUndefined();
    controller.dispose();
  });

  it("keeps passive failures silent during demonstration", async () => {
    const { controller, store, publish, instructionNarration } =
      createHarness();
    store.setGuidedState({
      phase: "summer-demonstration",
      status: "demonstrating",
      activeMovementId: "summer-step",
      successfulBars: 0,
    });
    const callsBefore = instructionNarration.speakText.mock.calls.length;

    await publish("summer-step", "passive-fail", "failed");
    await publish("summer-step", "passive-tracking", "not_evaluable");

    expect(store.guided.successfulBars).toBe(0);
    expect(controller.panelModel.value.feedbackText).toBeUndefined();
    expect(instructionNarration.speakText).toHaveBeenCalledTimes(callsBefore);
    controller.dispose();
  });

  it("throttles passive full-bar panel feedback", async () => {
    const { controller, runtime, store, publish } = createHarness();
    vi.useFakeTimers();
    store.setGuidedState({
      phase: "summer-story-transition",
      status: "transition",
      activeMovementId: "summer-step",
      successfulBars: 3,
      requiredSuccessfulBars: 3,
    });
    let transportMs = 0;
    runtime.getGuidedTransportMs = vi.fn(() => transportMs);

    await publish("summer-step", "cadence-1", "success");
    await publish("summer-step", "cadence-2", "success");
    expect(controller.panelModel.value.feedbackText).toBe("Good!");

    vi.advanceTimersByTime(1_250);
    await nextTick();
    expect(controller.panelModel.value.feedbackText).toBeUndefined();

    for (let index = 3; index <= 5; index++) {
      transportMs += 1_000;
      await publish("summer-step", `cadence-${index}`, "success");
    }
    expect(controller.panelModel.value.feedbackText).toBeUndefined();

    transportMs = 16_000;
    await publish("summer-step", "cadence-6", "success");
    expect(controller.panelModel.value.feedbackText).toBe("Good!");
    controller.dispose();
  });

  it("does not resume the flow after reset during movement preload", async () => {
    const preload = createDeferred<boolean>();
    const { controller, runtime, store, completeMovement } = createHarness();
    runtime.preloadTutorialMovement = vi.fn(async () => preload.promise);

    controller.startGuidedJourney();
    await flushFlow();
    await completeMovement("summer-step", "summer");
    expect(store.guided.phase).toBe("autumn-departure-success");

    await controller.resetAct();
    preload.resolve(true);
    await flushFlow();

    expect(store.guided.phase).toBe("idle");
    expect(runtime.playTutorialDemonstration).toHaveBeenCalledTimes(1);
  });

  it("records facilitator completion and clears active recognition", async () => {
    const { controller, runtime, store } = createHarness();
    controller.startGuidedJourney();
    await flushFlow();

    expect(store.guided.phase).toBe("summer-practice");
    controller.handleAction("forceCompleteGuidedStep");
    await flushFlow();

    expect(store.guided.facilitatorCompletedPhases).toContain(
      "summer-practice",
    );
    expect(runtime.forceCompleteGuidedRecognition).toHaveBeenCalledOnce();
  });

  it("identifies only participant-blocking guided phases as skippable phases", () => {
    const expectedSkippable: GuidedMigrationPhase[] = [
      "summer-practice",
      "autumn-departure-practice",
      "autumn-migration-practice",
      "autumn-arrival-practice",
      "winter-practice",
      "spring-departure-practice",
      "spring-migration-practice",
      "spring-arrival-practice",
    ];
    const passive: GuidedMigrationPhase[] = [
      "idle",
      "journey-introduction",
      "summer-demonstration",
      "summer-practice-prompt",
      "summer-success",
      "summer-story-transition",
      "autumn-migration-story",
      "cycle-complete",
    ];

    expectedSkippable.forEach((phase) => {
      expect(isGuidedBlockingInteractionPhase(phase)).toBe(true);
    });
    passive.forEach((phase) => {
      expect(isGuidedBlockingInteractionPhase(phase)).toBe(false);
    });
  });

  it("exposes guided skip only while the flow waits on participant performance", async () => {
    const { controller, runtime, store, gestureStore } = createHarness();

    controller.startGuidedJourney();
    await flushFlow();
    expect(store.guided.phase).toBe("summer-practice");
    expect(controller.canSkipCurrentBlockingInteraction.value).toBe(true);

    expect(controller.skipCurrentBlockingInteraction()).toBe(true);
    await flushFlow();
    expect(runtime.forceCompleteGuidedRecognition).toHaveBeenCalledOnce();
    expect(store.guided.facilitatorCompletedPhases).toContain(
      "summer-practice",
    );

    store.setGuidedState({
      phase: "summer-story-transition",
      status: "transition",
    });
    expect(controller.canSkipCurrentBlockingInteraction.value).toBe(false);
    expect(controller.skipCurrentBlockingInteraction()).toBe(false);

    store.setGuidedState({
      phase: "autumn-departure-practice",
      status: "practicing",
    });
    gestureStore.isActive = true;
    expect(controller.canSkipCurrentBlockingInteraction.value).toBe(true);

    controller.dispose();
  });

  it("does not advance after unmounting during a demonstration", async () => {
    const demonstration = createDeferred<undefined>();
    const { controller, runtime, store } = createHarness();
    runtime.playTutorialDemonstration = vi.fn(
      async () => await demonstration.promise,
    );

    controller.startGuidedJourney();
    await flushFlow();
    expect(store.guided.phase).toBe("journey-introduction");
    expect(controller.panelModel.value.actions).toEqual([]);

    controller.dispose();
    demonstration.resolve(undefined);
    await flushFlow();
    expect(store.guided.phase).toBe("journey-introduction");
    expect(runtime.cancelGuidedInterlude).toHaveBeenCalled();
  });

  it("cancels a pending story transition without a late phase change", async () => {
    const transition = createDeferred<undefined>();
    const { controller, runtime, store, completeMovement } = createHarness();
    runtime.playGuidedStoryTransition = vi.fn(
      async () => await transition.promise,
    );

    controller.startGuidedJourney();
    await flushFlow();
    await completeMovement("summer-step", "summer");
    expect(store.guided.phase).toBe("summer-story-transition");

    await controller.resetAct();
    expect(store.guided.phase).toBe("idle");
    transition.resolve(undefined);
    await flushFlow();
    expect(store.guided.phase).toBe("idle");
  });

  it("stays inactive on the shared Act 4 stage", async () => {
    const { runtime, store } = createHarness();
    store.resetGuidedState();
    const controller = useGuidedMigrationController({
      runtime,
      enabled: false,
      timing: immediateTiming,
    });

    controller.initialize();
    controller.startGuidedJourney();
    await flushFlow();
    expect(store.guided.phase).toBe("idle");
    expect(runtime.enterGuidedInterlude).not.toHaveBeenCalled();
    controller.dispose();
  });
});
