import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useMigrationActRuntime,
  type MigrationActAudioService,
  type MigrationActGestureService,
  type MigrationActRuntimeDriver,
} from "~/composables/migrationActs/useMigrationActRuntime";
import type { PlayNarrationOptions } from "~/composables/narration/useNarration";
import type { MigrationActSeasonAudioService } from "~/composables/migrationActs/useMigrationActSeasonAudio";
import type { StoryGestureResult } from "~/store/storyGestureStore";
import type { MigrationActCycleRun } from "~/types/migrationAct";
import { migrationStoryCycleDefinitions } from "~/utils/migrationStoryData";
import { getSeasonForDate, type StorySeasonId } from "~/utils/storyCycle";
import { resolveMigrationMovement } from "~/utils/migrationActs/migrationMovementSelection";
import { migrationMovementConfig } from "~/utils/migrationActs/migrationMovementConfig";

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
    fades: [] as number[],
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
    fadeOutBaseRhythmLoop: (durationSeconds = 4) => {
      state.fades.push(durationSeconds);
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
  let onHandoverStart: (() => void) | null = null;
  let handoverStarted = false;
  const state = {
    state: "inactive",
    isActive: false,
    activeGestureId: null as "departure" | "arrival" | null,
    currentSourceTimeMs: 0,
    movementLoaded: false,
    movementLoadError: null as string | null,
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
      autoProgressEnabled?: boolean;
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
      options: {
        countdownStartTransportMs?: number;
        preparationBars?: number;
        onHandoverStart?: () => void;
        autoProgressEnabled?: () => boolean;
      } = {},
    ) => {
      const startCall: {
        id: "departure" | "arrival";
        countdownStartTransportMs?: number;
        preparationBars?: number;
        autoProgressEnabled?: boolean;
      } = { id };
      if (options.countdownStartTransportMs !== undefined) {
        startCall.countdownStartTransportMs = options.countdownStartTransportMs;
      }
      if (options.preparationBars !== undefined) {
        startCall.preparationBars = options.preparationBars;
      }
      if (options.autoProgressEnabled?.() === true) {
        startCall.autoProgressEnabled = true;
      }
      calls.starts.push(startCall);
      onHandoverStart = options.onHandoverStart ?? null;
      handoverStarted = false;
      state.isActive = true;
      state.activeGestureId = id;
      state.movementLoaded = true;
      state.state = "waiting-for-lead-in";
      const result = await start();
      state.isActive = false;
      state.activeGestureId = null;
      return result;
    },
    demonstrate: async () => undefined,
    tick: () => {
      calls.tick++;
      if (!handoverStarted) {
        handoverStarted = true;
        onHandoverStart?.();
      }
      state.state = "attempt-playing";
      state.currentSourceTimeMs += 16;
    },
    handlePoseFrame: () => undefined,
    cancel: () => {
      calls.cancel++;
      onHandoverStart = null;
      handoverStarted = false;
      state.state = "idle";
      state.isActive = false;
      state.activeGestureId = null;
    },
    cleanup: () => {
      calls.cleanup++;
      onHandoverStart = null;
      handoverStarted = false;
      state.state = "idle";
      state.isActive = false;
      state.activeGestureId = null;
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

const createFakeNarration = ({
  holdKeys = [],
}: { holdKeys?: string[] } = {}) => {
  const calls = {
    play: [] as Array<{
      key: string;
      params?: Record<string, string | number>;
      behavior?: PlayNarrationOptions["behavior"];
    }>,
    held: [] as Array<{
      key: string;
      options: PlayNarrationOptions;
      resolve: () => void;
    }>,
    stop: 0,
  };
  const service = {
    play: async (key: string, options: PlayNarrationOptions = {}) => {
      calls.play.push({
        key,
        params: options.params,
        behavior: options.behavior,
      });
      if (holdKeys.includes(key)) {
        return await new Promise<{ status: "completed" }>((resolve) => {
          calls.held.push({
            key,
            options,
            resolve: () => resolve({ status: "completed" }),
          });
        });
      }
      options.onStart?.({ rate: 1, voiceName: null });
      options.onEnd?.({ status: "completed", rate: 1, voiceName: null });
      return { status: "completed" as const };
    },
    stop: () => {
      calls.stop++;
    },
  };

  return { service, calls };
};

const createHarness = ({
  cycleCount = 1,
  gestureStart,
  narrationOptions,
}: {
  cycleCount?: number;
  gestureStart?: () => Promise<StoryGestureResult>;
  narrationOptions?: Parameters<typeof createFakeNarration>[0];
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
  const narration = createFakeNarration(narrationOptions);
  const controller = useMigrationActRuntime({
    surfaceId: "story-stage",
    cycleRuns: createCycleRuns(cycleCount),
    runtimeDriver: raf.driver,
    clock: { now: raf.now },
    audioService: audio.service,
    seasonAudioService: seasonAudio.service,
    gestureService: gestures.service,
    narrationService: narration.service,
    translate: (key) => {
      if (key === "story.migrationPanel.engagement.title") {
        return "Stay with the journey";
      }
      if (key === "story.migrationPanel.engagement.nudge") {
        return "Keep moving with the avatar to stay part of the journey.";
      }
      return key;
    },
  });

  return { controller, raf, audio, seasonAudio, gestures, narration };
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
    const { controller, raf, narration } = createHarness();

    await controller.initialize();
    await controller.startStory();
    expect(narration.calls.play.slice(0, 2)).toEqual([
      {
        key: "story.acts.act3.narration.intro.part1.text",
        params: expect.objectContaining({ startYear: 2013, endYear: 2014 }),
        behavior: "queue",
      },
      {
        key: "story.acts.act3.narration.intro.part2.text",
        params: expect.objectContaining({ startYear: 2013, endYear: 2014 }),
        behavior: "queue",
      },
    ]);
    expect(controller.store.playbackState).toBe("initial_countdown");
    expect(controller.store.initialCountdownNumber).toBe(4);
    expect(controller.store.currentElapsedMs).toBe(0);
    expect(controller.movementRecognition.recognitionActive.value).toBe(false);
    expect(controller.store.cycleOverlay.visible).toBe(false);

    raf.step(0);
    raf.step(3_000);
    expect(controller.store.initialCountdownNumber).toBe(1);
    expect(controller.movement.movementSourceTimeMs.value).toBe(0);

    raf.step(1_000);
    expect(controller.store.playbackState).toBe("playing");
    expect(controller.store.currentElapsedMs).toBe(0);
    expect(controller.movement.movementSourceTimeMs.value).toBe(1_000);
    expect(controller.movementRecognition.recognitionActive.value).toBe(true);
    expect(controller.store.cycleOverlay).toMatchObject({
      visible: true,
      title: "2013-2014",
      subtitleKey: "story.acts.act3.overlay.reference",
    });
    expect(controller.store.latestNarrationEvent).toMatchObject({
      event: "cycleIntro",
      cycleId: "individual_3031_2013_2014",
      startYear: 2013,
      endYear: 2014,
      cueId: "act3.story.2013_2014.intro",
    });
    expect(narration.calls.play).toContainEqual({
      key: "story.acts.act3.narration.cycles.2013_2014.intro.text",
      params: expect.objectContaining({ startYear: 2013, endYear: 2014 }),
      behavior: "queue",
    });
    raf.step(4_000);
    expect(controller.store.cycleOverlay.visible).toBe(false);
  });

  it("updates visible authored narration only when queued speech actually starts", async () => {
    const heldCueKey = "story.acts.act3.narration.cycles.2013_2014.intro.text";
    const { controller, raf, narration } = createHarness({
      narrationOptions: { holdKeys: [heldCueKey] },
    });

    await controller.initialize();
    await controller.startStory();
    await finishInitialCountdown(raf);

    const queuedTitleKey =
      "story.acts.act3.narration.cycles.2013_2014.intro.title";
    expect(narration.calls.play.some((call) => call.key === heldCueKey)).toBe(
      true,
    );
    expect(controller.store.storyNarration.title).not.toBe(queuedTitleKey);

    narration.calls.held[0]!.options.onStart?.({ rate: 1, voiceName: null });

    expect(controller.store.storyNarration).toMatchObject({
      title: queuedTitleKey,
      text: heldCueKey,
    });

    narration.calls.held[0]!.options.onEnd?.({
      status: "completed",
      rate: 1,
      voiceName: null,
    });
    narration.calls.held[0]!.resolve();
  });

  it("starts Departure countdown only after the exact event freezes Story-Time", async () => {
    const gesture = createDeferred<StoryGestureResult>();
    const { controller, raf, audio, gestures, narration } = createHarness({
      gestureStart: () => gesture.promise,
    });

    await controller.initialize();
    await controller.startStory();
    await finishInitialCountdown(raf);
    const boundaryMs = controller.store.events[0]!.boundaryTimeMs;

    raf.step(boundaryMs - 1);
    await flushPromises();

    expect(controller.store.currentElapsedMs).toBe(boundaryMs - 1);
    expect(controller.store.isGestureActive).toBe(false);
    expect(gestures.calls.starts).toEqual([]);
    expect(controller.store.mapCameraMode).toBe("residence");
    expect(controller.avatarPlaybackOwner.value).toBe("summer");
    expect(controller.guidedTrace.value).toMatchObject({
      avatarPlaybackOwner: "summer",
      renderedMovementId: "summer-step",
    });

    raf.step(1);
    await flushPromises();
    const boundaryTransportMs = audio.state.currentOffsetSeconds * 1_000;
    const countdownStartTransportMs =
      Math.ceil(Math.max(boundaryTransportMs - 40, 0) / 4_000) * 4_000;

    expect(controller.store.currentElapsedMs).toBe(boundaryMs);
    expect(controller.store.mapCameraMode).toBe("migration");
    expect(controller.avatarPlaybackOwner.value).toBe("departure");
    expect(gestures.calls.starts).toEqual([
      { id: "departure", countdownStartTransportMs },
    ]);
    expect(countdownStartTransportMs % 4_000).toBe(0);
    expect(countdownStartTransportMs).toBeGreaterThanOrEqual(
      boundaryTransportMs - 40,
    );
    expect(controller.guidedTrace.value).toMatchObject({
      avatarPlaybackOwner: "departure",
      renderedMovementId: "departure",
      storyTimeMs: boundaryMs,
    });

    raf.step(4_000);
    await flushPromises();
    expect(controller.store.mapCameraMode).toBe("migration");
    expect(controller.avatarPlaybackOwner.value).toBe("departure");
    expect(controller.store.currentElapsedMs).toBe(boundaryMs);
    expect(controller.store.isGestureActive).toBe(true);
    expect(controller.store.mapCameraMode).toBe("migration");
    expect(controller.store.latestNarrationEvent).toMatchObject({
      event: "autumnDeparturePrepare",
      realDepartureDate: "2013-08-12",
      realArrivalDate: "2013-10-06",
      realMigrationDurationDays: 55,
      direction: "south",
      cueId: "act3.story.2013_2014.autumnPrepare",
      experienceMigrationDurationSecondsSpoken: 20,
    });
    expect(narration.calls.play).toContainEqual({
      key: "story.acts.act3.narration.cycles.2013_2014.autumnPrepare.text",
      params: expect.objectContaining({
        direction: "south",
        experienceMigrationDurationSecondsSpoken: 20,
      }),
      behavior: "replace",
    });
    raf.step(4_000);
    await flushPromises();
    expect(controller.store.currentElapsedMs).toBe(boundaryMs);

    gesture.resolve("completed");
    await flushPromises();
  });

  it("passes auto progress into the exact-boundary departure gesture without fast-forwarding story time", async () => {
    const gesture = createDeferred<StoryGestureResult>();
    const { controller, raf, audio, gestures } = createHarness({
      gestureStart: () => gesture.promise,
    });

    await controller.initialize();
    controller.toggleDebug();
    controller.toggleAutoProgress();
    await controller.startStory();
    await finishInitialCountdown(raf);

    const boundaryMs = controller.store.events[0]!.boundaryTimeMs;
    raf.step(boundaryMs - 1);
    await flushPromises();

    expect(gestures.calls.starts).toEqual([]);
    expect(controller.store.currentElapsedMs).toBe(boundaryMs - 1);
    expect(controller.store.playbackState).toBe("playing");

    raf.step(1);
    await flushPromises();
    const boundaryTransportMs = audio.state.currentOffsetSeconds * 1_000;
    const countdownStartTransportMs =
      Math.ceil(Math.max(boundaryTransportMs - 40, 0) / 4_000) * 4_000;

    expect(gestures.calls.starts.at(-1)).toEqual({
      id: "departure",
      countdownStartTransportMs,
      autoProgressEnabled: true,
    });
    expect(controller.store.currentElapsedMs).toBe(boundaryMs);
    expect(controller.store.playbackState).toBe("gesture_lead_in");

    gesture.resolve("completed");
    await flushPromises();
  });

  it("runs migration to the arrival boundary before freezing for the arrival gesture", async () => {
    const gesture = createDeferred<StoryGestureResult>();
    const { controller, raf, audio, gestures, narration } = createHarness({
      gestureStart: () => gesture.promise,
    });

    await controller.initialize();
    await controller.startStory();
    await finishInitialCountdown(raf);
    const arrival = controller.store.events.find(
      (event) => event.eventType === "autumn_arrival",
    )!;

    await controller.seekToElapsedMs(arrival.boundaryTimeMs - 4_000);
    await flushPromises();
    raf.step(0);

    expect(controller.store.currentElapsedMs).toBe(
      arrival.boundaryTimeMs - 4_000,
    );
    expect(controller.store.playbackState).toBe("playing");
    expect(controller.store.mapCameraMode).toBe("migration");
    expect(controller.avatarPlaybackOwner.value).toBe("autumn-migration");
    expect(gestures.calls.starts.some((call) => call.id === "arrival")).toBe(
      false,
    );

    raf.step(3_999);
    expect(controller.store.currentElapsedMs).toBe(arrival.boundaryTimeMs - 1);
    expect(controller.store.playbackState).toBe("playing");
    expect(gestures.calls.starts.some((call) => call.id === "arrival")).toBe(
      false,
    );

    raf.step(1);
    const arrivalTransportMs = audio.state.currentOffsetSeconds * 1_000;
    const arrivalCountdownStartTransportMs =
      Math.ceil(Math.max(arrivalTransportMs - 40, 0) / 4_000) * 4_000;
    expect(controller.store.currentElapsedMs).toBe(arrival.boundaryTimeMs);
    expect(controller.store.playbackState).toBe("gesture_lead_in");
    expect(controller.store.mapCameraMode).toBe("migration");
    expect(controller.avatarPlaybackOwner.value).toBe("arrival");
    expect(gestures.calls.starts.at(-1)).toEqual({
      id: "arrival",
      countdownStartTransportMs: arrivalCountdownStartTransportMs,
    });
    expect(arrivalCountdownStartTransportMs % 4_000).toBe(0);
    expect(arrivalCountdownStartTransportMs).toBeGreaterThanOrEqual(
      arrivalTransportMs - 40,
    );
    expect(controller.guidedTrace.value).toMatchObject({
      avatarPlaybackOwner: "arrival",
      renderedMovementId: "arrival",
      storyTimeMs: arrival.boundaryTimeMs,
    });

    const transportAtBoundary = audio.state.currentOffsetSeconds;
    raf.step(1_000);
    expect(controller.store.currentElapsedMs).toBe(arrival.boundaryTimeMs);
    expect(controller.guidedTrace.value.avatarSourceTimeMs).toBeGreaterThan(0);
    expect(audio.state.currentOffsetSeconds).toBeGreaterThan(
      transportAtBoundary,
    );

    gesture.resolve("completed");
    await flushPromises();
    expect(controller.store.playbackState).toBe("playing");
    expect(controller.store.mapCameraMode).toBe("residence");
    expect(controller.store.latestNarrationEvent?.event).not.toBe(
      "winterReflection",
    );

    raf.step(4_000);
    await flushPromises();
    expect(controller.store.latestNarrationEvent).toMatchObject({
      event: "winterReflection",
      cycleId: "individual_3031_2013_2014",
      winterRegion: "Morocco",
      cueId: "act3.story.2013_2014.winterReflection1",
    });
    expect(narration.calls.play).toContainEqual({
      key: "story.acts.act3.narration.cycles.2013_2014.winterReflection1.text",
      params: expect.objectContaining({
        startYear: 2013,
        endYear: 2014,
      }),
      behavior: "queue",
    });
  });

  it("does not emit the 2018 Iberia narration before winter arrival succeeds", async () => {
    const { controller, raf, narration } = createHarness({ cycleCount: 5 });

    await controller.initialize();
    const cycleRun = controller.store.cycleRuns[2]!;
    await controller.startSingleCycle(cycleRun.id);
    await finishInitialCountdown(raf);
    const arrival = controller.store.events.find(
      (event) => event.eventType === "autumn_arrival",
    )!;

    await controller.seekToElapsedMs(arrival.boundaryTimeMs - 1);
    await flushPromises();
    raf.step(0);
    expect(
      narration.calls.play.some((call) =>
        call.key.includes("cycles.2018_2019.winterReflection"),
      ),
    ).toBe(false);

    raf.step(1);
    await flushPromises();
    expect(
      narration.calls.play.some((call) =>
        call.key.includes("cycles.2018_2019.winterReflection"),
      ),
    ).toBe(false);

    raf.step(4_000);
    await flushPromises();
    expect(narration.calls.play).toContainEqual({
      key: "story.acts.act3.narration.cycles.2018_2019.winterReflection1.text",
      params: expect.objectContaining({
        winterRegion: "Spain / Iberia",
      }),
      behavior: "queue",
    });
  });

  it("keeps the 2022 non-linearity cue until after spring return", async () => {
    const { controller, raf, narration } = createHarness({ cycleCount: 5 });

    await controller.initialize();
    const cycleRun = controller.store.cycleRuns[4]!;
    await controller.startSingleCycle(cycleRun.id);
    await finishInitialCountdown(raf);
    const springArrival = controller.store.events.find(
      (event) => event.eventType === "spring_arrival",
    )!;

    await controller.seekToElapsedMs(springArrival.boundaryTimeMs - 1);
    await flushPromises();
    raf.step(0);
    expect(
      narration.calls.play.some((call) =>
        call.key.includes("cycles.2022_2023.breedingReflection2"),
      ),
    ).toBe(false);

    raf.step(1);
    await flushPromises();
    expect(
      narration.calls.play.some((call) =>
        call.key.includes("cycles.2022_2023.breedingReflection2"),
      ),
    ).toBe(false);

    raf.step(4_000);
    await flushPromises();
    expect(narration.calls.play).toContainEqual({
      key: "story.acts.act3.narration.cycles.2022_2023.breedingReflection2.text",
      params: expect.objectContaining({
        startYear: 2022,
        endYear: 2023,
      }),
      behavior: "queue",
    });
  });

  it("queues the 2013 breeding reflection before the 2016 transition without duplicate intro", async () => {
    const { controller, raf, narration } = createHarness({ cycleCount: 2 });

    await controller.initialize();
    await controller.startStory();
    await finishInitialCountdown(raf);
    const springArrival = controller.store.events.find(
      (event) => event.eventType === "spring_arrival",
    )!;
    controller.store.replaceEvents(
      controller.store.events.map((event) => ({
        ...event,
        status:
          event.id === springArrival.id ? "pending" : ("skipped" as const),
      })),
    );

    await controller.seekToElapsedMs(springArrival.boundaryTimeMs - 1);
    await flushPromises();
    raf.step(0);
    raf.step(1);
    await flushPromises();
    raf.step(4_000);
    await flushPromises();

    const storyCueKeys = narration.calls.play.map((call) => call.key);
    expect(storyCueKeys).toContain(
      "story.acts.act3.narration.cycles.2013_2014.breedingReflection1.text",
    );
    expect(storyCueKeys).not.toContain(
      "story.acts.act3.narration.cycles.2013_2014.breedingReflection2.text",
    );
    expect(storyCueKeys).toContain(
      "story.acts.act3.narration.transitions.2016_2017.text",
    );
    expect(
      storyCueKeys.filter(
        (key) =>
          key === "story.acts.act3.narration.cycles.2016_2017.intro.text",
      ),
    ).toHaveLength(0);
    expect(
      narration.calls.play
        .filter((call) =>
          call.key.includes("cycles.2013_2014.breedingReflection1"),
        )
        .at(0),
    ).toMatchObject({ behavior: "queue" });
    expect(
      narration.calls.play
        .filter((call) => call.key.includes("transitions.2016_2017"))
        .at(0),
    ).toMatchObject({ behavior: "queue" });
  });

  it("still announces a directly debug-started cycle without a transition", async () => {
    const { controller, raf, narration } = createHarness({ cycleCount: 5 });

    await controller.initialize();
    const cycleRun = controller.store.cycleRuns[2]!;
    await controller.startSingleCycle(cycleRun.id);
    await finishInitialCountdown(raf);

    expect(narration.calls.play).toContainEqual({
      key: "story.acts.act3.narration.cycles.2018_2019.intro.text",
      params: expect.objectContaining({
        startYear: 2018,
        endYear: 2019,
      }),
      behavior: "queue",
    });
  });

  it("plays only residence timing cues that fit before protected events while Story-Time continues", async () => {
    const { controller, raf, narration } = createHarness({ cycleCount: 5 });
    const expectedTriggers = [
      ["2013_2014", 4_000, 44_000, true],
      ["2016_2017", 12_000, 40_000, true],
      ["2018_2019", 12_000, 36_000, true],
      ["2020_2021", 16_000, 36_000, true],
      ["2022_2023", 16_000, 40_000, false],
    ] as const;

    await controller.initialize();

    for (const [
      index,
      [cycleKey, summerTriggerMs, winterTriggerMs, winterFits],
    ] of expectedTriggers.entries()) {
      const cycleRun = controller.store.cycleRuns[index]!;
      await controller.startSingleCycle(cycleRun.id);
      await finishInitialCountdown(raf);

      await controller.seekToElapsedMs(summerTriggerMs - 1);
      await flushPromises();
      raf.step(0);
      raf.step(1);
      await flushPromises();
      expect(controller.store.currentElapsedMs).toBe(summerTriggerMs);
      expect(
        narration.calls.play.some(
          (call) =>
            call.key ===
            `story.acts.act3.narration.cycles.${cycleKey}.summerTiming.text`,
        ),
      ).toBe(false);
      raf.step(1_000);
      await flushPromises();
      expect(controller.store.currentElapsedMs).toBe(summerTriggerMs + 1_000);
      expect(
        narration.calls.play.filter(
          (call) =>
            call.key ===
            `story.acts.act3.narration.cycles.${cycleKey}.summerTiming.text`,
        ),
      ).toHaveLength(0);

      await controller.seekToElapsedMs(winterTriggerMs - 1);
      await flushPromises();
      raf.step(0);
      raf.step(1);
      await flushPromises();
      expect(controller.store.currentElapsedMs).toBe(winterTriggerMs);
      const winterCueCalls = narration.calls.play.filter(
        (call) =>
          call.key ===
          `story.acts.act3.narration.cycles.${cycleKey}.winterTiming.text`,
      );
      if (winterFits) {
        expect(winterCueCalls).toEqual([
          {
            key: `story.acts.act3.narration.cycles.${cycleKey}.winterTiming.text`,
            params: expect.objectContaining({ currentPhase: "winter_rest" }),
            behavior: "queue",
          },
        ]);
      } else {
        expect(winterCueCalls).toEqual([]);
      }
      raf.step(1_000);
      await flushPromises();
      expect(controller.store.currentElapsedMs).toBe(winterTriggerMs + 1_000);
      expect(
        narration.calls.play.filter(
          (call) =>
            call.key ===
            `story.acts.act3.narration.cycles.${cycleKey}.winterTiming.text`,
        ),
      ).toHaveLength(winterFits ? 1 : 0);
    }
  });

  it("initializes idle and uses exactly one delta-based RAF across pause and resume", async () => {
    const { controller, raf, seasonAudio } = createHarness();

    await controller.initialize();
    expect(controller.store.playbackState).toBe("idle");
    expect(seasonAudio.calls.preload).toBe(1);
    expect(controller.movement.isMovementReady("summer-step")).toBe(true);
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

  it("runs one covered bar for each normal cycle transition", async () => {
    const { controller, raf, audio, seasonAudio, narration } = createHarness({
      cycleCount: 5,
    });

    await controller.initialize();
    await controller.startStory();
    await finishInitialCountdown(raf);

    const transitions = [
      ["2013-2014", "2016-2017", "2016_2017"],
      ["2016-2017", "2018-2019", "2018_2019"],
      ["2018-2019", "2020-2021", "2020_2021"],
      ["2020-2021", "2022-2023", "2022_2023"],
    ] as const;

    for (const [index, [fromTitle, toTitle, cueKey]] of transitions.entries()) {
      controller.store.replaceEvents(
        controller.store.events.map((event) => ({
          ...event,
          status: "skipped" as const,
        })),
      );
      controller.store.setElapsedMs(controller.store.cycleDurationMs - 1);
      const transportBeforeTransition = audio.state.currentOffsetSeconds;
      raf.step(0);
      raf.step(2);
      await flushPromises();

      expect(controller.store.activeCycleIndex).toBe(index + 1);
      expect(controller.store.playbackState).toBe("cycle_transition");
      expect(controller.store.currentElapsedMs).toBe(0);
      expect(controller.store.cycleTransitionOverlay).toMatchObject({
        visible: true,
        state: "swapping",
        fromTitle,
        toTitle,
        sourceCycleId: controller.store.cycleRuns[index]!.cycleId,
        targetCycleId: controller.store.activeCycleId,
        targetDate: `${Number(toTitle.slice(0, 4))}-06-01`,
        targetPhase: "summer_rest",
        mapReady: false,
        oneBarDurationMs: 4_000,
      });
      expect(controller.store.cycleOverlay.visible).toBe(false);
      expect(controller.store.mapCameraMode).toBe("residence");
      expect(audio.state.isPlaying).toBe(true);
      expect(audio.state.currentOffsetSeconds).toBeGreaterThan(
        transportBeforeTransition,
      );
      expect(narration.calls.play).toContainEqual({
        key: `story.acts.act3.narration.transitions.${cueKey}.text`,
        params: expect.objectContaining({
          startYear: Number(toTitle.slice(0, 4)),
          endYear: Number(toTitle.slice(5)),
        }),
        behavior: "queue",
      });
      const preparedMapFrame = controller.getCurrentMapFrame();
      expect(preparedMapFrame).toMatchObject({
        cycleId: controller.store.activeCycleId,
        date: `${Number(toTitle.slice(0, 4))}-06-01`,
        phase: "summer_rest",
      });
      const preparedLatLng = preparedMapFrame!.markerLatLng!;
      controller.reportMapFrame({
        ...preparedMapFrame!,
        cycleId: controller.store.cycleRuns[index]!.cycleId,
        markerLatLng: { lat: 1, lng: 2 },
        cameraReady: true,
      });
      expect(controller.store.cycleTransitionOverlay.mapReady).toBe(false);
      controller.reportMapFrame({
        ...preparedMapFrame!,
        markerLatLng: { lat: 3, lng: 4 },
        cameraReady: false,
      });
      expect(controller.store.cycleTransitionOverlay.mapReady).toBe(false);
      controller.reportMapFrame({
        ...preparedMapFrame!,
        markerLatLng: {
          lat: preparedLatLng.lat + 0.001,
          lng: preparedLatLng.lng,
        },
        cameraReady: true,
      });
      expect(controller.store.cycleTransitionOverlay.mapReady).toBe(false);
      controller.reportMapFrame({
        ...preparedMapFrame!,
        markerLatLng: preparedLatLng,
        cameraReady: true,
      });
      expect(controller.store.cycleTransitionOverlay.mapReady).toBe(true);
      expect(controller.store.cycleTransitionOverlay).toMatchObject({
        state: "ready",
        markerLatLng: preparedLatLng,
        cameraReady: true,
      });

      raf.step(3_999);
      expect(controller.store.playbackState).toBe("cycle_transition");
      expect(controller.store.currentElapsedMs).toBe(0);

      raf.step(2);
      await vi.waitFor(() => {
        expect(controller.store.playbackState).toBe("playing");
      });

      expect(controller.store.currentElapsedMs).toBe(0);
      expect(controller.store.cycleTransitionOverlay.visible).toBe(false);
      expect(controller.store.cycleOverlay.visible).toBe(false);
      expect(
        controller.store.cycleTransitionTrace.slice(-5).map((entry) => ({
          state: entry.state,
          sourceCycleId: entry.sourceCycleId,
          targetCycleId: entry.targetCycleId,
          targetDate: entry.targetDate,
          targetPhase: entry.targetPhase,
          oneBarDurationMs: entry.oneBarDurationMs,
        })),
      ).toEqual([
        {
          state: "covering",
          sourceCycleId: controller.store.cycleRuns[index]!.cycleId,
          targetCycleId: controller.store.cycleRuns[index + 1]!.cycleId,
          targetDate: `${Number(toTitle.slice(0, 4))}-06-01`,
          targetPhase: "summer_rest",
          oneBarDurationMs: 4_000,
        },
        {
          state: "swapping",
          sourceCycleId: controller.store.cycleRuns[index]!.cycleId,
          targetCycleId: controller.store.cycleRuns[index + 1]!.cycleId,
          targetDate: `${Number(toTitle.slice(0, 4))}-06-01`,
          targetPhase: "summer_rest",
          oneBarDurationMs: 4_000,
        },
        {
          state: "ready",
          sourceCycleId: controller.store.cycleRuns[index]!.cycleId,
          targetCycleId: controller.store.cycleRuns[index + 1]!.cycleId,
          targetDate: `${Number(toTitle.slice(0, 4))}-06-01`,
          targetPhase: "summer_rest",
          oneBarDurationMs: 4_000,
        },
        {
          state: "revealing",
          sourceCycleId: controller.store.cycleRuns[index]!.cycleId,
          targetCycleId: controller.store.cycleRuns[index + 1]!.cycleId,
          targetDate: `${Number(toTitle.slice(0, 4))}-06-01`,
          targetPhase: "summer_rest",
          oneBarDurationMs: 4_000,
        },
        {
          state: "idle",
          sourceCycleId: controller.store.cycleRuns[index]!.cycleId,
          targetCycleId: controller.store.cycleRuns[index + 1]!.cycleId,
          targetDate: `${Number(toTitle.slice(0, 4))}-06-01`,
          targetPhase: "summer_rest",
          oneBarDurationMs: 4_000,
        },
      ]);
      expect(
        narration.calls.play.filter(
          (call) =>
            call.key ===
            `story.acts.act3.narration.cycles.${cueKey}.intro.text`,
        ),
      ).toHaveLength(0);
    }

    expect(audio.state.isPlaying).toBe(true);
    expect(seasonAudio.calls.starts).toEqual([
      "summer",
      "summer",
      "summer",
      "summer",
      "summer",
    ]);
    expect(
      [
        migrationMovementConfig.summerRest.movementId,
        migrationMovementConfig.winterRest.movementId,
        ...Object.values(migrationMovementConfig.outbound).map(
          (slot) => slot.movementId,
        ),
        ...Object.values(migrationMovementConfig.return).map(
          (slot) => slot.movementId,
        ),
      ].every((movementId) => controller.movement.isMovementReady(movementId)),
    ).toBe(true);
  });

  it("keeps the cycle cover up after the bar until the new map frame is coherent", async () => {
    const { controller, raf, audio } = createHarness({ cycleCount: 2 });

    await controller.initialize();
    await controller.startStory();
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
    await flushPromises();
    expect(controller.store.playbackState).toBe("cycle_transition");
    expect(controller.store.cycleTransitionOverlay.visible).toBe(true);
    expect(controller.store.cycleTransitionOverlay.mapReady).toBe(false);

    raf.step(0);
    raf.step(4_050);
    await flushPromises();
    expect(controller.store.playbackState).toBe("cycle_transition");
    expect(controller.store.currentElapsedMs).toBe(0);
    expect(controller.store.cycleTransitionOverlay).toMatchObject({
      visible: true,
      remainingMs: 0,
      mapReady: false,
    });

    const preparedMapFrame = controller.getCurrentMapFrame();
    controller.reportMapFrame(preparedMapFrame!);
    expect(controller.store.cycleTransitionOverlay.state).toBe("ready");
    const readyTransportMs = audio.state.currentOffsetSeconds * 1_000;
    const nextRevealTransportMs =
      Math.ceil(Math.max(readyTransportMs - 40, 0) / 4_000) * 4_000;
    expect(nextRevealTransportMs).toBeGreaterThanOrEqual(readyTransportMs - 40);

    raf.step(Math.max(0, nextRevealTransportMs - readyTransportMs - 1));
    await flushPromises();
    expect(controller.store.playbackState).toBe("cycle_transition");
    expect(controller.store.currentElapsedMs).toBe(0);
    expect(controller.store.cycleTransitionOverlay.visible).toBe(true);

    raf.step(2);
    await vi.waitFor(() => {
      expect(controller.store.playbackState).toBe("playing");
    });
    expect(controller.store.cycleTransitionOverlay.visible).toBe(false);
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

  it("speaks one gentle engagement nudge after repeated low participation in a phase", async () => {
    const { controller, raf, narration } = createHarness();

    await controller.initialize();
    await controller.startStory();
    await finishInitialCountdown(raf);
    await controller.seekToElapsedMs(5_000);
    raf.step(0);
    await flushPromises();

    for (let index = 1; index <= 4; index++) {
      controller.movementRecognition.lastBarEvaluation.value = {
        evaluationId: `low-${index}`,
        sessionId: 1,
        profile: "summer_rest",
        movementId: "summer-step",
        barIndex: index,
        status: "failed",
        beatResults: [],
        criteria: {
          wingBeat: "failed",
          stepActivity: "failed",
          stanceWidthChange: "failed",
          verticalBounce: "failed",
        },
        evaluatedAtMs: index,
      };
      controller.handlePoseFrame(null);
    }

    const nudgeCalls = narration.calls.play.filter(
      (call) => call.key === "story.migrationPanel.engagement.nudge",
    );
    expect(nudgeCalls).toEqual([
      {
        key: "story.migrationPanel.engagement.nudge",
        params: undefined,
        behavior: "skip-if-speaking",
      },
    ]);
    expect(controller.store.storyNarration).toMatchObject({
      title: "Stay with the journey",
      text: "Keep moving with the avatar to stay part of the journey.",
    });
    expect(controller.store.engagementNudge.nudged).toBe(true);
  });

  it("keeps auto progress scoped to debug mode", async () => {
    const { controller } = createHarness();

    await controller.initialize();
    expect(controller.store.debug).toEqual({
      enabled: false,
      autoProgressEnabled: false,
    });

    controller.toggleAutoProgress();
    expect(controller.store.debug.autoProgressEnabled).toBe(false);

    controller.toggleDebug();
    controller.toggleAutoProgress();
    expect(controller.store.debug).toEqual({
      enabled: true,
      autoProgressEnabled: true,
    });

    controller.toggleDebug();
    expect(controller.store.debug).toEqual({
      enabled: false,
      autoProgressEnabled: false,
    });
  });

  it("bar-aligns a continuous phase restart to the existing master transport", async () => {
    const { controller, raf, audio } = createHarness();

    await controller.initialize();
    await controller.startStory();
    await finishInitialCountdown(raf);

    raf.step(1_200);
    expect(audio.state.currentOffsetSeconds).toBeCloseTo(5.2);

    await controller.seekToElapsedMs(0);
    await flushPromises();
    expect(controller.movement.movementSourceTimeMs.value).toBe(0);

    raf.step(2_800);
    expect(audio.state.currentOffsetSeconds).toBeCloseTo(8);
    expect(controller.movement.movementSourceTimeMs.value).toBeCloseTo(1_000);
  });

  it("completes a single cycle and disposes every runtime resource", async () => {
    const { controller, raf, audio, seasonAudio, gestures, narration } =
      createHarness();

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
    await vi.waitFor(() => {
      expect(
        narration.calls.play.filter((call) =>
          call.key.includes("story.acts.act3.narration.completed"),
        ),
      ).toHaveLength(5);
    });

    expect(controller.store.playbackState).toBe("completed");
    expect(controller.store.completedCycleRunIds).toEqual([runId]);
    expect(raf.pendingCount()).toBe(0);
    expect(
      narration.calls.play
        .filter((call) =>
          call.key.includes("story.acts.act3.narration.completed"),
        )
        .map((call) => call.key),
    ).toEqual([
      "story.acts.act3.narration.completed.structure.text",
      "story.acts.act3.narration.completed.pattern.text",
      "story.acts.act3.narration.completed.qualification.text",
      "story.acts.act3.narration.completed.question.text",
      "story.acts.act3.narration.completed.climateTransition.text",
    ]);

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

  it("ends tutorial preroll on beat one and plays two bars with passive recognition", async () => {
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

    expect(controller.movementRecognition.recognitionActive.value).toBe(true);
    expect(controller.guidedRecognitionPurpose.value).toBe("passive-feedback");
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
    expect(controller.guidedRecognitionPurpose.value).toBe("idle");
  });

  it("keeps four opening bars passively recognized and hands over without a restart", async () => {
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
    expect(controller.movementRecognition.recognitionActive.value).toBe(true);
    expect(controller.guidedRecognitionPurpose.value).toBe("passive-feedback");
    raf.step(4_000);
    raf.step(4_000);
    expect(controller.guidedRecognitionPurpose.value).toBe("passive-feedback");
    raf.step(4_000);
    expect(controller.guidedRecognitionPurpose.value).toBe("passive-feedback");
    raf.step(3_000);
    await demonstration;

    expect(repetitions).toEqual([1, 2, 3, 4]);
    expect(controller.tutorialPlaybackMode.value).toBe("practice");
    expect(controller.movement.movementPlaying.value).toBe(true);
    expect(controller.movementRecognition.recognitionActive.value).toBe(true);
    expect(controller.guidedRecognitionPurpose.value).toBe("practice-gating");
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
      expect(controller.guidedRecognitionPurpose.value).toBe("practice-gating");
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
