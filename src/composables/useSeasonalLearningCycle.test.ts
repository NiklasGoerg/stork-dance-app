import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSeasonalLearningCycle } from "~/composables/useSeasonalLearningCycle";
import type { SeasonalCycleConfig } from "~/utils/seasonalCycle";

const audioStore = vi.hoisted(() => ({
  baseRhythmLoop: {
    currentOffsetSeconds: 0,
    isPlaying: false,
  },
  loadBaseRhythmLoop: vi.fn(async () => undefined),
  preloadSeasonalAudio: vi.fn(async () => undefined),
  setSeasonalAudioVolume: vi.fn(),
  startBaseRhythmLoop: vi.fn(async (offsetSeconds = 0) => {
    audioStore.baseRhythmLoop.currentOffsetSeconds = offsetSeconds;
    audioStore.baseRhythmLoop.isPlaying = true;
  }),
  pauseBaseRhythmLoop: vi.fn(() => {
    audioStore.baseRhythmLoop.isPlaying = false;
  }),
  resetBaseRhythmLoop: vi.fn(() => {
    audioStore.baseRhythmLoop.currentOffsetSeconds = 0;
    audioStore.baseRhythmLoop.isPlaying = false;
  }),
  stopSeasonalAudio: vi.fn(),
  pauseSeasonalAudio: vi.fn(),
  startSeasonalAudio: vi.fn(async () => undefined),
  getBaseRhythmTransportTimeMs: vi.fn(
    () => audioStore.baseRhythmLoop.currentOffsetSeconds * 1_000,
  ),
  getBeatDurationMs: vi.fn(() => 125),
}));

vi.mock("~/store/audioStore", () => ({
  useAudioStore: () => audioStore,
}));

const createFakeRaf = () => {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId++;

    callbacks.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    callbacks.delete(id);
  });

  return {
    step: () => {
      const pending = [...callbacks.entries()];

      callbacks.clear();
      for (const [, callback] of pending) callback(performance.now());
    },
    pendingCount: () => callbacks.size,
  };
};

const config: SeasonalCycleConfig = {
  seasonDurationMs: 1_000,
  barDurationMs: 500,
  repetitionCount: 1,
  countdownDurationMs: 0,
  seasonalAudioEnabled: true,
  seasons: [
    {
      id: "summer",
      label: "Summer",
      date: "2022-06-01",
      movementUrl: "/summer.json",
      audioUrl: "/summer.mp3",
      movementLoopDurationMs: 500,
      movementPrerollMs: 0,
    },
  ],
};

describe("useSeasonalLearningCycle pause semantics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    Object.values(audioStore).forEach((value) => {
      if (typeof value === "function" && "mockClear" in value) {
        value.mockClear();
      }
    });
    audioStore.baseRhythmLoop.currentOffsetSeconds = 0;
    audioStore.baseRhythmLoop.isPlaying = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          frames: [
            { time: 0, landmarks: [] },
            { time: 1_000, landmarks: [] },
          ],
          source: { width: 640, height: 480 },
        }),
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not mature a queued interlude restart while paused", async () => {
    const raf = createFakeRaf();
    const cycle = useSeasonalLearningCycle(config);
    const beforeRestart = vi.fn();

    await cycle.prepareCustomCycle(config);
    cycle.queueSeasonIndexRestart(0, false, beforeRestart, {
      interludeDurationMs: 500,
    });
    await cycle.startPreparedCycleFromIndex(0, false);

    vi.advanceTimersByTime(1_000);
    audioStore.baseRhythmLoop.currentOffsetSeconds = 1;
    raf.step();

    expect(beforeRestart).not.toHaveBeenCalled();
    expect(raf.pendingCount()).toBe(0);

    cycle.pause();
    expect(cycle.playbackState.value).toBe("paused");

    vi.advanceTimersByTime(1_000);
    expect(beforeRestart).not.toHaveBeenCalled();

    await cycle.play();
    vi.advanceTimersByTime(499);
    expect(beforeRestart).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(beforeRestart).toHaveBeenCalledTimes(1);
  });

  it("cancels a queued interlude restart before the timeout can fire", async () => {
    const raf = createFakeRaf();
    const cycle = useSeasonalLearningCycle(config);
    const beforeRestart = vi.fn();

    await cycle.prepareCustomCycle(config);
    cycle.queueSeasonIndexRestart(0, false, beforeRestart, {
      interludeDurationMs: 500,
    });
    await cycle.startPreparedCycleFromIndex(0, false);

    vi.advanceTimersByTime(1_000);
    audioStore.baseRhythmLoop.currentOffsetSeconds = 1;
    raf.step();
    cycle.cancelQueuedSeasonRestart();

    vi.advanceTimersByTime(1_000);
    await Promise.resolve();

    expect(beforeRestart).not.toHaveBeenCalled();
    expect(cycle.playbackState.value).toBe("playing");
  });

  it("waits for the next base-rhythm bar boundary", async () => {
    createFakeRaf();
    const cycle = useSeasonalLearningCycle(config);
    let resolved = false;

    await cycle.prepareCustomCycle(config);
    await cycle.startPreparedCycleFromIndex(0, false);
    audioStore.baseRhythmLoop.currentOffsetSeconds = 0.26;

    const waitPromise = cycle.waitForNextBarBoundary().then(() => {
      resolved = true;
    });

    vi.advanceTimersByTime(200);
    await Promise.resolve();
    expect(resolved).toBe(false);

    audioStore.baseRhythmLoop.currentOffsetSeconds = 0.5;
    vi.advanceTimersByTime(100);
    await waitPromise;

    expect(resolved).toBe(true);
  });

  it("does not resolve a next-bar wait while playback is paused", async () => {
    createFakeRaf();
    const cycle = useSeasonalLearningCycle(config);
    let resolved = false;

    await cycle.prepareCustomCycle(config);
    await cycle.startPreparedCycleFromIndex(0, false);
    audioStore.baseRhythmLoop.currentOffsetSeconds = 0.26;

    const waitPromise = cycle.waitForNextBarBoundary().then(() => {
      resolved = true;
    });

    cycle.pause();
    audioStore.baseRhythmLoop.currentOffsetSeconds = 0.5;
    vi.advanceTimersByTime(1_000);
    await Promise.resolve();
    expect(resolved).toBe(false);

    await cycle.play();
    audioStore.baseRhythmLoop.currentOffsetSeconds = 0.5;
    vi.advanceTimersByTime(100);
    await waitPromise;

    expect(resolved).toBe(true);
  });

  it("does not complete an explanation preview bar wait while paused", async () => {
    createFakeRaf();
    const cycle = useSeasonalLearningCycle(config);
    let resolved = false;

    await cycle.startExplanationPreview(0);
    const waitPromise = cycle.waitForExplanationPreviewBars(1).then(() => {
      resolved = true;
    });

    cycle.pause();
    vi.advanceTimersByTime(1_000);
    await Promise.resolve();

    expect(resolved).toBe(false);

    await cycle.play();
    audioStore.baseRhythmLoop.currentOffsetSeconds = 0.45;
    vi.advanceTimersByTime(100);
    await Promise.resolve();

    expect(resolved).toBe(false);

    audioStore.baseRhythmLoop.currentOffsetSeconds = 0.5;
    vi.advanceTimersByTime(50);
    await waitPromise;

    expect(resolved).toBe(true);
  });

  it("releases a paused explanation preview wait on cleanup", async () => {
    createFakeRaf();
    const cycle = useSeasonalLearningCycle(config);
    let resolved = false;

    await cycle.startExplanationPreview(0);
    const waitPromise = cycle.waitForExplanationPreviewBars(1).then(() => {
      resolved = true;
    });

    cycle.pause();
    cycle.cleanup();
    vi.advanceTimersByTime(100);
    await waitPromise;

    expect(resolved).toBe(true);
  });
});
