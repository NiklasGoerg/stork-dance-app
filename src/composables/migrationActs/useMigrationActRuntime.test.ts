import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useMigrationActRuntime,
  type MigrationActAudioService,
  type MigrationActGestureService,
  type MigrationActRuntimeDriver,
} from "~/composables/migrationActs/useMigrationActRuntime";
import type { MigrationActSeasonAudioService } from "~/composables/migrationActs/useMigrationActSeasonAudio";
import type { StoryGestureResult } from "~/store/storyGestureStore";
import type { MigrationActCycleRun } from "~/types/migrationAct";
import { migrationStoryCycleDefinitions } from "~/utils/migrationStoryData";
import { getSeasonForDate, type StorySeasonId } from "~/utils/storyCycle";
import { resolveMigrationMovement } from "~/utils/migrationActs/migrationMovementSelection";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });

  return { promise, resolve };
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createFakeRaf = () => {
  let currentTimeMs = 0;
  let nextId = 1;
  let onStep: ((deltaMs: number) => void) | null = null;
  const callbacks = new Map<number, FrameRequestCallback>();

  const driver: MigrationActRuntimeDriver = {
    requestFrame: (callback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancelFrame: (id) => {
      callbacks.delete(id);
    },
  };

  const step = (deltaMs: number) => {
    currentTimeMs += deltaMs;
    onStep?.(deltaMs);
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach((callback) => callback(currentTimeMs));
  };

  return {
    driver,
    step,
    now: () => currentTimeMs,
    pendingCount: () => callbacks.size,
    setStepHook: (hook: (deltaMs: number) => void) => {
      onStep = hook;
    },
  };
};

const createFakeAudio = () => {
  const state = {
    isPlaying: false,
    currentOffsetSeconds: 0,
    starts: 0,
    stops: 0,
  };
  const service = {
    baseRhythmLoop: state,
    startBaseRhythmLoop: async (offsetSeconds = 0) => {
      state.starts++;
      state.currentOffsetSeconds = offsetSeconds;
      state.isPlaying = true;
    },
    pauseBaseRhythmLoop: () => {
      state.isPlaying = false;
    },
    resumeBaseRhythmLoop: async () => {
      state.isPlaying = true;
    },
    stopBaseRhythmLoop: () => {
      state.stops++;
      state.isPlaying = false;
      state.currentOffsetSeconds = 0;
    },
    resetBaseRhythmLoop: () => {
      state.stops++;
      state.isPlaying = false;
      state.currentOffsetSeconds = 0;
    },
    getBaseRhythmTransportTimeMs: () => state.currentOffsetSeconds * 1_000,
    getBeatDurationMs: () => 1_000,
    getMsUntilNextBaseRhythmBeat: (targetBeat: number) => {
      const beatDurationMs = 1_000;
      const beatsPerBar = 4;
      const transportTimeMs = state.currentOffsetSeconds * 1_000;
      const currentBeatIndex = Math.floor(transportTimeMs / beatDurationMs);
      const barStartBeatIndex =
        Math.floor(currentBeatIndex / beatsPerBar) * beatsPerBar;
      const targetBeatIndex = targetBeat - 1;
      let targetTransportTimeMs =
        (barStartBeatIndex + targetBeatIndex) * beatDurationMs;
      if (targetTransportTimeMs <= transportTimeMs + 40) {
        targetTransportTimeMs += beatsPerBar * beatDurationMs;
      }
      return targetTransportTimeMs - transportTimeMs;
    },
  } as unknown as MigrationActAudioService;

  return { service, state };
};

const createFakeSeasonAudio = () => {
  const state = {
    currentSeason: null as StorySeasonId | null,
    isPlaying: false,
  };
  const calls = {
    preload: 0,
    starts: [] as StorySeasonId[],
    changes: [] as StorySeasonId[],
    pauses: 0,
    resumes: 0,
    fades: 0,
    resets: 0,
    disposes: 0,
  };

  const seasonForDate = (date: string) => getSeasonForDate(date).id;

  const service = {
    preload: async () => {
      calls.preload++;
    },
    prepare: (date: string) => {
      state.currentSeason = seasonForDate(date);
    },
    start: async (date: string) => {
      const season = seasonForDate(date);
      calls.starts.push(season);
      state.currentSeason = season;
      state.isPlaying = true;
    },
    changeForDate: async (date: string) => {
      const season = seasonForDate(date);
      if (season !== state.currentSeason) {
        calls.changes.push(season);
        state.currentSeason = season;
      }
    },
    pause: () => {
      calls.pauses++;
      state.isPlaying = false;
    },
    resume: async () => {
      calls.resumes++;
      if (state.currentSeason) state.isPlaying = true;
    },
    seek: async (date: string) => {
      state.currentSeason = seasonForDate(date);
    },
    fadeOutForCycle: () => {
      calls.fades++;
      state.isPlaying = false;
    },
    reset: () => {
      calls.resets++;
      state.currentSeason = null;
      state.isPlaying = false;
    },
    dispose: () => {
      calls.disposes++;
      state.isPlaying = false;
    },
  } as unknown as MigrationActSeasonAudioService;

  return { service, state, calls };
};

const createFakeGestures = (
  start: () => Promise<StoryGestureResult> = async () => "completed",
) => {
  const state = {
    state: "inactive",
    isActive: false,
    currentSourceTimeMs: 0,
  };
  const calls = {
    preload: 0,
    cancel: 0,
    cleanup: 0,
    tick: 0,
    starts: [] as Array<{
      id: "departure" | "arrival";
      countdownStartTransportMs?: number;
      preparationBars?: number;
    }>,
  };
  const service = {
    store: state,
    demonstrationActive: ref(false),
    demonstrationSourceTimeMs: ref(0),
    loadTimings: new Map(),
    preload: async () => {
      calls.preload++;
    },
    start: async (
      id: "departure" | "arrival",
      options: { countdownStartTransportMs?: number } = {},
    ) => {
      calls.starts.push({ id, ...options });
      state.isActive = true;
      const result = await start();
      state.isActive = false;
      return result;
    },
    demonstrate: async () => undefined,
    tick: () => {
      calls.tick++;
      state.state = "attempt-playing";
      state.currentSourceTimeMs += 16;
    },
    handlePoseFrame: () => undefined,
    cancel: () => {
      calls.cancel++;
      state.state = "idle";
      state.isActive = false;
    },
    cleanup: () => {
      calls.cleanup++;
      state.state = "idle";
      state.isActive = false;
    },
  } as unknown as MigrationActGestureService;

  return { service, state, calls };
};

const createCycleRuns = (count: number): MigrationActCycleRun[] =>
  migrationStoryCycleDefinitions.slice(0, count).map((cycle, index) => ({
    id: `controller-test:${cycle.label}:${index}`,
    cycleId: cycle.label,
    cycleStartYear: cycle.targetYear,
    title: cycle.label,
  }));

const createHarness = ({
  cycleCount = 1,
  gestureStart,
}: {
  cycleCount?: number;
  gestureStart?: () => Promise<StoryGestureResult>;
} = {}) => {
  const raf = createFakeRaf();
  const audio = createFakeAudio();
  raf.setStepHook((deltaMs) => {
    if (audio.state.isPlaying) {
      audio.state.currentOffsetSeconds += deltaMs / 1_000;
    }
  });
  const seasonAudio = createFakeSeasonAudio();
  const gestures = createFakeGestures(gestureStart);
  const controller = useMigrationActRuntime({
    surfaceId: "story-stage",
    cycleRuns: createCycleRuns(cycleCount),
    runtimeDriver: raf.driver,
    clock: { now: raf.now },
    audioService: audio.service,
    seasonAudioService: seasonAudio.service,
    gestureService: gestures.service,
  });

  return { controller, raf, audio, seasonAudio, gestures };
};

const finishInitialCountdown = async (
  raf: ReturnType<typeof createFakeRaf>,
) => {
  raf.step(0);
  raf.step(4_000);
  await flushPromises();
};

describe("migration act runtime", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("uses the same zero transport origin for three guided start-reset cycles", async () => {
    const { controller, audio } = createHarness();
    const movement = resolveMigrationMovement({
      phase: "summer_rest",
      phaseDurationMs: 0,
    });

    await controller.initialize();
    for (let run = 0; run < 3; run++) {
      if (run > 0) await controller.reset();
      await controller.enterGuidedInterlude(movement);

      expect(audio.state.currentOffsetSeconds).toBe(0);
      expect(controller.avatarPlaybackOwner.value).toBe("summer");
      expect(controller.movement.movementSourceTimeMs.value).toBe(1_000);
      expect(controller.ownerSwitchTrace.value).toEqual([
        expect.objectContaining({
          fromOwner: "idle",
          toOwner: "summer",
          scheduledTransportMs: 0,
          actualTransportMs: 0,
          reason: "guided-start",
        }),
      ]);
    }
  });

  it("switches the visible owner atomically on the scheduled boundary", async () => {
    const gesture = createDeferred<StoryGestureResult>();
    const { controller, raf } = createHarness({
      gestureStart: () => gesture.promise,
    });
    const movement = resolveMigrationMovement({
      phase: "summer_rest",
      phaseDurationMs: 0,
    });

    await controller.initialize();
    await controller.enterGuidedInterlude(movement);
    const preparation = controller.playGuidedGesturePreparation({
      gestureId: "departure",
      demonstrationBars: 2,
    });
    raf.step(0);

    expect(controller.avatarPlaybackOwner.value).toBe("departure");
    expect(controller.ownerSwitchTrace.value.at(-1)).toEqual({
      fromOwner: "summer",
      toOwner: "departure",
      scheduledTransportMs: 0,
      actualTransportMs: 0,
      reason: "gesture-preparation:departure",
    });

    gesture.resolve("completed");
    await preparation;
  });

  it("uses the final countdown beat as preroll before story recognition starts", async () => {
    const { controller, raf } = createHarness();

    await controller.initialize();
    await controller.startStory();
    expect(controller.store.playbackState).toBe("initial_countdown");
    expect(controller.store.initialCountdownNumber).toBe(4);
    expect(controller.store.currentElapsedMs).toBe(0);
    expect(controller.movementRecognition.recognitionActive.value).toBe(false);

    raf.step(0);
    raf.step(3_000);
    expect(controller.store.initialCountdownNumber).toBe(1);
    expect(controller.movement.movementSourceTimeMs.value).toBe(0);

    raf.step(1_000);
    expect(controller.store.playbackState).toBe("playing");
    expect(controller.store.currentElapsedMs).toBe(0);
    expect(controller.movement.movementSourceTimeMs.value).toBe(1_000);
    expect(controller.movementRecognition.recognitionActive.value).toBe(true);
  });

  it("starts gesture preview four beats before the event without dimming the map", async () => {
    const gesture = createDeferred<StoryGestureResult>();
    const { controller, raf, gestures } = createHarness({
      gestureStart: () => gesture.promise,
    });

    await controller.initialize();
    await controller.startStory();
    await finishInitialCountdown(raf);
    const boundaryMs = controller.store.events[0]!.boundaryTimeMs;

    raf.step(boundaryMs - 4_000);
    await flushPromises();

    expect(controller.store.currentElapsedMs).toBe(boundaryMs - 4_000);
    expect(controller.store.isGestureActive).toBe(false);
    expect(gestures.calls.starts).toEqual([
      { id: "departure", countdownStartTransportMs: boundaryMs },
    ]);

    raf.step(4_000);
    expect(controller.store.currentElapsedMs).toBe(boundaryMs);
    expect(controller.store.isGestureActive).toBe(true);
    gesture.resolve("completed");
    await flushPromises();
  });

  it("initializes idle and uses exactly one delta-based RAF across pause and resume", async () => {
    const { controller, raf, seasonAudio } = createHarness();

    await controller.initialize();
    expect(controller.store.playbackState).toBe("idle");
    expect(seasonAudio.calls.preload).toBe(1);
    expect(seasonAudio.state.isPlaying).toBe(false);
    expect(raf.pendingCount()).toBe(0);

    await controller.startStory();
    await finishInitialCountdown(raf);
    expect(seasonAudio.calls.starts).toEqual(["summer"]);
    expect(seasonAudio.state.isPlaying).toBe(true);
    expect(raf.pendingCount()).toBe(1);

    raf.step(1_000);
    raf.step(1_000);
    expect(controller.store.currentElapsedMs).toBe(2_000);
    expect(raf.pendingCount()).toBe(1);

    controller.pause();
    const pausedAtMs = controller.store.currentElapsedMs;
    expect(controller.store.playbackState).toBe("paused");
    expect(seasonAudio.state.isPlaying).toBe(false);
    expect(raf.pendingCount()).toBe(0);

    raf.step(5_000);
    expect(controller.store.currentElapsedMs).toBe(pausedAtMs);

    await controller.resume();
    expect(seasonAudio.calls.resumes).toBe(1);
    expect(seasonAudio.state.isPlaying).toBe(true);
    expect(raf.pendingCount()).toBe(1);
    raf.step(5_000);
    raf.step(500);
    expect(controller.store.currentElapsedMs).toBe(pausedAtMs + 500);
    expect(raf.pendingCount()).toBe(1);
  });

  it("resumes only after every blocking pause reason is removed", async () => {
    const { controller, raf } = createHarness();

    await controller.initialize();
    await controller.startStory();
    await finishInitialCountdown(raf);
    controller.store.addPauseReason("system");
    controller.pause();

    await controller.resume();
    expect(controller.store.pauseReasons).toEqual(["system"]);
    expect(controller.store.playbackState).toBe("paused");
    expect(raf.pendingCount()).toBe(0);

    controller.store.removePauseReason("system");
    await controller.resume();
    expect(controller.store.playbackState).toBe("playing");
    expect(raf.pendingCount()).toBe(1);
  });

  it("pauses a cycle transition and continues with the next configured run", async () => {
    const { controller, raf, audio, seasonAudio } = createHarness({
      cycleCount: 2,
    });

    await controller.initialize();
    await controller.startStory();
    await finishInitialCountdown(raf);
    controller.store.replaceEvents(
      controller.store.events.map((event) => ({
        ...event,
        status: "skipped" as const,
      })),
    );
    controller.store.setElapsedMs(controller.store.cycleDurationMs - 10);
    raf.step(0);
    raf.step(20);

    expect(controller.store.playbackState).toBe("cycle_transition");
    expect(controller.store.pauseReasons).toContain("cycle_transition");
    expect(seasonAudio.calls.fades).toBe(1);
    expect(audio.state.isPlaying).toBe(true);

    controller.pause();
    const remainingMs = controller.store.transitionRemainingMs;
    raf.step(5_000);
    expect(controller.store.transitionRemainingMs).toBe(remainingMs);

    await controller.resume();
    raf.step(0);
    raf.step(1_800);
    await flushPromises();

    expect(controller.store.activeCycleIndex).toBe(1);
    expect(controller.store.playbackState).toBe("playing");
    expect(controller.store.pauseReasons).toEqual([]);
    expect(seasonAudio.calls.starts).toEqual(["summer", "summer"]);
  });

  it("freezes story time during a gesture and ignores its stale completion after reset", async () => {
    const gesture = createDeferred<StoryGestureResult>();
    const { controller, raf, seasonAudio } = createHarness({
      gestureStart: () => gesture.promise,
    });

    await controller.initialize();
    await controller.startStory();
    await finishInitialCountdown(raf);
    expect(controller.movementRecognition.recognitionActive.value).toBe(true);
    const boundaryMs = controller.store.events[0]!.boundaryTimeMs;
    raf.step(0);
    raf.step(boundaryMs + 500);

    expect(controller.store.playbackState).toBe("gesture_lead_in");
    expect(controller.store.currentElapsedMs).toBe(boundaryMs);
    expect(controller.store.events[0]!.status).toBe("triggered");
    expect(controller.movementRecognition.recognitionActive.value).toBe(false);
    expect(seasonAudio.state.isPlaying).toBe(true);
    expect(seasonAudio.calls.pauses).toBe(0);

    raf.step(5_000);
    expect(controller.store.currentElapsedMs).toBe(boundaryMs);

    await controller.reset();
    gesture.resolve("completed");
    await flushPromises();

    expect(controller.store.playbackState).toBe("idle");
    expect(controller.store.currentElapsedMs).toBe(0);
    expect(controller.movementRecognition.recognitionActive.value).toBe(false);
    expect(
      controller.store.events.every((event) => event.status === "pending"),
    ).toBe(true);
    expect(seasonAudio.state.isPlaying).toBe(false);
    expect(raf.pendingCount()).toBe(0);
  });

  it("completes a single cycle and disposes every runtime resource", async () => {
    const { controller, raf, audio, seasonAudio, gestures } = createHarness();

    await controller.initialize();
    const runId = controller.store.cycleRuns[0]!.id;
    await controller.startSingleCycle(runId);
    await finishInitialCountdown(raf);
    controller.store.replaceEvents(
      controller.store.events.map((event) => ({
        ...event,
        status: "skipped" as const,
      })),
    );
    controller.store.setElapsedMs(controller.store.cycleDurationMs - 1);
    raf.step(0);
    raf.step(2);

    expect(controller.store.playbackState).toBe("completed");
    expect(controller.store.completedCycleRunIds).toEqual([runId]);
    expect(raf.pendingCount()).toBe(0);

    controller.dispose();
    expect(controller.store.actId).toBeNull();
    expect(gestures.calls.cleanup).toBe(1);
    expect(seasonAudio.calls.disposes).toBe(1);
    expect(audio.state.stops).toBeGreaterThan(0);
  });

  it("simulates the complete 96-second cycle with all four gestures in order", async () => {
    const { controller, raf, seasonAudio } = createHarness();

    await controller.initialize();
    const runId = controller.store.cycleRuns[0]!.id;
    await controller.startSingleCycle(runId);
    await finishInitialCountdown(raf);
    raf.step(0);

    const expectedEventTypes = controller.store.events.map(
      (event) => event.eventType,
    );

    const completedEvents: string[] = [];
    let safety = 0;
    while (controller.store.playbackState !== "completed" && safety < 200) {
      raf.step(1_000);
      await flushPromises();
      for (const event of controller.store.events) {
        if (
          event.status === "completed" &&
          !completedEvents.includes(event.eventType)
        ) {
          completedEvents.push(event.eventType);
        }
      }
      safety++;
    }

    expect(completedEvents).toEqual(expectedEventTypes);
    expect(expectedEventTypes).toEqual([
      "autumn_departure",
      "autumn_arrival",
      "spring_departure",
      "spring_arrival",
    ]);
    expect(controller.store.currentElapsedMs).toBe(96_000);
    expect(controller.store.playbackState).toBe("completed");
    expect(seasonAudio.calls.changes).toEqual(["autumn", "winter", "spring"]);
    expect(seasonAudio.calls.pauses).toBe(0);
    expect(seasonAudio.state.isPlaying).toBe(false);
  });

  it("keeps seasonal audio unchanged during a gesture and honors a user pause", async () => {
    const gesture = createDeferred<StoryGestureResult>();
    const { controller, raf, seasonAudio } = createHarness({
      gestureStart: () => gesture.promise,
    });

    await controller.initialize();
    await controller.startStory();
    await finishInitialCountdown(raf);
    const boundaryMs = controller.store.events[0]!.boundaryTimeMs;
    raf.step(0);
    raf.step(boundaryMs + 1);
    controller.store.addPauseReason("user");

    expect(seasonAudio.state.isPlaying).toBe(true);
    expect(seasonAudio.calls.pauses).toBe(0);

    gesture.resolve("completed");
    await flushPromises();

    expect(controller.store.pauseReasons).toEqual(["user"]);
    expect(controller.store.playbackState).toBe("paused");
    expect(seasonAudio.state.isPlaying).toBe(false);
    expect(seasonAudio.calls.pauses).toBe(1);
    expect(raf.pendingCount()).toBe(0);
  });

  it("freezes story time in a guided interlude while the beat transport continues", async () => {
    const { controller, raf, audio } = createHarness();

    await controller.initialize();
    await controller.enterGuidedInterlude();
    expect(controller.guidedInterludeActive.value).toBe(true);
    expect(controller.store.pauseReasons).toContain("tutorial");
    expect(audio.state.isPlaying).toBe(true);

    raf.step(0);
    raf.step(5_000);
    expect(controller.store.currentElapsedMs).toBe(0);
    expect(audio.state.currentOffsetSeconds).toBe(5);

    await controller.leaveGuidedInterlude();
    raf.step(0);
    raf.step(500);
    expect(controller.guidedInterludeActive.value).toBe(false);
    expect(controller.store.pauseReasons).not.toContain("tutorial");
    expect(controller.store.currentElapsedMs).toBe(500);
  });

  it("advances a guided story transition monotonically to the exact event boundary", async () => {
    const { controller, raf } = createHarness();

    await controller.initialize();
    await controller.enterGuidedInterlude();
    const targetElapsedMs = controller.store.events[0]!.boundaryTimeMs;
    const transition = controller.playGuidedStoryTransition({
      targetElapsedMs,
      durationMs: 4_000,
    });

    raf.step(0);
    expect(controller.store.currentElapsedMs).toBe(0);
    raf.step(1_000);
    const firstElapsedMs = controller.store.currentElapsedMs;
    raf.step(1_000);
    const secondElapsedMs = controller.store.currentElapsedMs;

    expect(firstElapsedMs).toBeCloseTo(targetElapsedMs * 0.25);
    expect(secondElapsedMs).toBeCloseTo(targetElapsedMs * 0.5);
    expect(secondElapsedMs).toBeGreaterThan(firstElapsedMs);
    expect(controller.guidedStoryTransitionActive.value).toBe(true);

    raf.step(2_000);
    await transition;
    expect(controller.store.currentElapsedMs).toBe(targetElapsedMs);
    expect(controller.store.currentDate).toBe(
      controller.store.events[0]!.boundaryDate,
    );
    expect(controller.store.events[0]!.status).toBe("pending");
    expect(controller.guidedStoryTransitionActive.value).toBe(false);
  });

  it("ends tutorial preroll on beat one and plays two bars without recognition", async () => {
    const { controller, raf, audio } = createHarness();
    const repetitions: number[] = [];
    const summerMovement = resolveMigrationMovement({
      phase: "summer_rest",
      phaseDurationMs: 0,
    });

    await controller.initialize();
    await controller.enterGuidedInterlude(summerMovement);
    expect(audio.state.currentOffsetSeconds).toBe(0);
    const demonstration = controller.playTutorialDemonstration(
      summerMovement,
      2,
      (index) => repetitions.push(index),
    );
    await vi.waitFor(() => {
      expect(repetitions).toEqual([1]);
    });

    expect(controller.movementRecognition.recognitionActive.value).toBe(false);
    expect(controller.movement.movementSourceTimeMs.value).toBe(1_000);
    raf.step(0);
    raf.step(1_000);
    expect(controller.movement.movementSourceTimeMs.value).toBe(2_000);
    raf.step(4_000);
    raf.step(3_000);
    await demonstration;

    expect(repetitions).toEqual([1, 2]);
    expect(controller.tutorialPlaybackMode.value).toBeNull();
    expect(controller.movementRecognition.recognitionActive.value).toBe(false);
  });

  it("keeps four opening bars recognition-free and hands over without a restart", async () => {
    const { controller, raf } = createHarness();
    const repetitions: number[] = [];
    const movement = resolveMigrationMovement({
      phase: "summer_rest",
      phaseDurationMs: 0,
    });

    await controller.initialize();
    await controller.enterGuidedInterlude(movement);
    const demonstration = controller.playTutorialDemonstration(
      movement,
      4,
      (index) => repetitions.push(index),
      { handoverToPractice: true },
    );
    await vi.waitFor(() => expect(repetitions).toEqual([1]));

    raf.step(0);
    raf.step(1_000);
    expect(controller.movementRecognition.recognitionActive.value).toBe(false);
    raf.step(4_000);
    raf.step(4_000);
    expect(controller.movementRecognition.recognitionActive.value).toBe(false);
    raf.step(4_000);
    expect(controller.movementRecognition.recognitionActive.value).toBe(false);
    raf.step(3_000);
    await demonstration;

    expect(repetitions).toEqual([1, 2, 3, 4]);
    expect(controller.tutorialPlaybackMode.value).toBe("practice");
    expect(controller.movement.movementPlaying.value).toBe(true);
    expect(controller.movementRecognition.recognitionActive.value).toBe(true);
    expect(controller.movement.movementSourceTimeMs.value).toBe(1_000);
  });

  it.each([
    ["autumn_migration", "autumn-migration"],
    ["spring_migration", "spring-migration"],
  ] as const)(
    "keeps the %s demo alive while its owner switch is pending",
    async (phase, expectedOwner) => {
      const { controller, raf } = createHarness();
      const summer = resolveMigrationMovement({
        phase: "summer_rest",
        phaseDurationMs: 0,
      });
      const migration = resolveMigrationMovement({
        phase,
        phaseDurationMs: 10_000,
      });
      const repetitions: number[] = [];

      await controller.initialize();
      await controller.enterGuidedInterlude(summer);
      const demonstration = controller.playTutorialDemonstration(
        migration,
        3,
        (index) => repetitions.push(index),
        { handoverToPractice: true },
      );
      await vi.waitFor(() => {
        expect(controller.tutorialPlaybackMode.value).toBe("demonstration");
        expect(controller.guidedTrace.value.ownerSwitchPromisePending).toBe(
          true,
        );
      });

      raf.step(0);
      expect(controller.tutorialPlaybackMode.value).toBe("demonstration");
      expect(controller.avatarPlaybackOwner.value).toBe("summer");
      expect(controller.guidedTrace.value).toMatchObject({
        tutorialPlaybackMode: "demonstration",
        avatarPlaybackOwner: "summer",
        ownerSwitchPromisePending: true,
        demonstrationPromisePending: false,
        playbackState: "playing",
        pauseReasons: ["tutorial"],
      });

      raf.step(4_000);
      await flushPromises();
      expect(controller.avatarPlaybackOwner.value).toBe(expectedOwner);
      expect(repetitions).toEqual([1]);
      expect(controller.guidedTrace.value).toMatchObject({
        avatarPlaybackOwner: expectedOwner,
        ownerSwitchPromisePending: false,
        demonstrationPromisePending: true,
      });

      raf.step(4_000);
      raf.step(4_000);
      raf.step(4_000);
      await demonstration;
      expect(repetitions).toEqual([1, 2, 3]);
      expect(controller.tutorialPlaybackMode.value).toBe("practice");
      expect(controller.movementRecognition.recognitionActive.value).toBe(true);
    },
  );

  it("surfaces a missing guided movement instead of waiting forever", async () => {
    const { controller } = createHarness();
    const summer = resolveMigrationMovement({
      phase: "summer_rest",
      phaseDurationMs: 0,
    });
    const missing = { ...summer, movementId: "missing-guided-movement" };

    await controller.initialize();
    await controller.enterGuidedInterlude(summer);

    await expect(
      controller.playTutorialDemonstration(missing, 3, undefined, {
        handoverToPractice: true,
      }),
    ).rejects.toThrow('Movement "missing-guided-movement" is unavailable.');
    expect(controller.store.error).toContain("missing-guided-movement");
  });
});
