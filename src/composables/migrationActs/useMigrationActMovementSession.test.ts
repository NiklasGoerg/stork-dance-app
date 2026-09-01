import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMigrationActMovementSession } from "~/composables/migrationActs/useMigrationActMovementSession";
import type { MigrationCheckpointEvaluation } from "~/utils/migrationActs/migrationMovementEvaluation";
import { evaluateMigrationCheckpoint } from "~/utils/migrationActs/migrationMovementEvaluation";

const mockAudioTransport = vi.hoisted(() => ({ value: 0 }));
const mockTriggerBeatFeedback = vi.hoisted(() => vi.fn());
const mockResetSkeletonFeedback = vi.hoisted(() => vi.fn());

vi.mock("~/store/audioStore", () => ({
  useAudioStore: () => ({
    baseRhythmLoop: { isPlaying: true, currentOffsetSeconds: 0 },
    loadBaseRhythmLoop: vi.fn(async () => undefined),
    startBaseRhythmLoop: vi.fn(async () => undefined),
    getBaseRhythmTransportTimeMs: () => mockAudioTransport.value,
    getBeatDurationMs: () => 1_000,
    getMsUntilNextBaseRhythmBeat: () => 0,
  }),
}));

vi.mock("~/composables/migrationActs/useMigrationGestureNarration", () => ({
  useMigrationGestureNarration: () => ({
    setEnabled: vi.fn(),
    cleanup: vi.fn(),
  }),
}));

vi.mock("~/composables/useMovementPlayback", () => ({
  useMovementPlayback: () => ({
    currentFrame: { value: null },
    loadRecording: vi.fn(),
    seekToTime: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock("~/composables/useSkeletonVisualFeedback", () => ({
  useSkeletonVisualFeedback: () => ({
    skeletonFeedbackState: { value: null },
    pulseProgress: { value: 0 },
    triggerBeatFeedback: mockTriggerBeatFeedback,
    resetSkeletonFeedback: mockResetSkeletonFeedback,
  }),
}));

vi.mock("~/story/gestureMovements", () => ({
  loadGestureMovement: vi.fn(async () => ({
    recording: {
      source: { width: 1, height: 1 },
      frames: [],
    },
  })),
}));

vi.mock("~/utils/migrationActs/migrationMovementEvaluation", async () => {
  const actual = await vi.importActual<
    typeof import("~/utils/migrationActs/migrationMovementEvaluation")
  >("~/utils/migrationActs/migrationMovementEvaluation");

  return {
    ...actual,
    evaluateMigrationCheckpoint: vi.fn(),
  };
});

const mockedEvaluateMigrationCheckpoint = vi.mocked(
  evaluateMigrationCheckpoint,
);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createEvaluation = (
  checkpointId: string,
  status: MigrationCheckpointEvaluation["status"],
): MigrationCheckpointEvaluation => ({
  checkpointId,
  status,
  required: checkpointId !== "departure-arms-out",
  selectedPose: null,
  criteria: [],
});

const startDepartureAttempt = async () => {
  setActivePinia(createPinia());
  mockAudioTransport.value = 0;
  const session = useMigrationActMovementSession();
  void session.start("departure", { countdownStartTransportMs: 0 });

  await Promise.resolve();
  await Promise.resolve();

  mockAudioTransport.value = 4_000;
  session.tick();

  return session;
};

describe("useMigrationActMovementSession checkpoint feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEvaluateMigrationCheckpoint.mockReset();
  });

  it("publishes one terminal pulse per authored departure checkpoint", async () => {
    mockedEvaluateMigrationCheckpoint
      .mockReturnValueOnce(createEvaluation("departure-crouch", "success"))
      .mockReturnValueOnce(createEvaluation("departure-rise-hands", "failed"))
      .mockReturnValueOnce(createEvaluation("departure-arms-out", "failed"));

    const session = await startDepartureAttempt();

    mockAudioTransport.value = 4_599;
    session.tick();
    expect(mockTriggerBeatFeedback).not.toHaveBeenCalled();

    mockAudioTransport.value = 5_600;
    session.tick();
    expect(mockTriggerBeatFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({
        beatIndex: 1,
        result: "passed",
        evaluationId: expect.stringContaining("checkpoint:departure-crouch"),
      }),
    );

    mockAudioTransport.value = 6_650;
    session.tick();
    expect(mockTriggerBeatFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({
        beatIndex: 2,
        result: "failed",
        evaluationId: expect.stringContaining(
          "checkpoint:departure-rise-hands",
        ),
      }),
    );

    mockAudioTransport.value = 7_700;
    session.tick();
    expect(mockTriggerBeatFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        beatIndex: 3,
        result: "failed",
        evaluationId: expect.stringContaining("checkpoint:departure-arms-out"),
      }),
    );

    expect(
      mockTriggerBeatFeedback.mock.calls.filter(
        ([event]) => event.result === "failed",
      ),
    ).toHaveLength(2);
  });

  it("does not publish orange feedback for tracking-only checkpoints", async () => {
    mockedEvaluateMigrationCheckpoint
      .mockReturnValueOnce(
        createEvaluation("departure-crouch", "not_evaluable"),
      )
      .mockReturnValueOnce(
        createEvaluation("departure-rise-hands", "not_evaluable"),
      )
      .mockReturnValueOnce(
        createEvaluation("departure-arms-out", "not_evaluable"),
      );

    const session = await startDepartureAttempt();

    mockAudioTransport.value = 7_700;
    session.tick();

    expect(mockTriggerBeatFeedback).not.toHaveBeenCalledWith(
      expect.objectContaining({ result: "failed" }),
    );
  });

  it("keeps active gesture source time stable after a transport anchor shift", async () => {
    setActivePinia(createPinia());
    mockAudioTransport.value = 10_000;
    const session = useMigrationActMovementSession();
    void session.start("departure", { countdownStartTransportMs: 10_000 });
    await flushPromises();

    mockAudioTransport.value = 12_000;
    session.tick();
    const sourceTimeBeforeShift = session.store.currentSourceTimeMs;
    const countdownBeforeShift = session.store.countdownNumber;

    session.shiftTransportAnchors(5_000);
    mockAudioTransport.value = 17_000;
    session.tick();

    expect(session.store.currentSourceTimeMs).toBe(sourceTimeBeforeShift);
    expect(session.store.countdownNumber).toBe(countdownBeforeShift);

    session.cancel();
  });
});
