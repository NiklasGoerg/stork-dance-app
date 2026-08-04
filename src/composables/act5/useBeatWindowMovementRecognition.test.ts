import { describe, expect, it } from "vitest";
import { useBeatWindowMovementRecognition } from "~/composables/act5/useBeatWindowMovementRecognition";
import type { PoseLandmarkLike } from "~/types/pose";

type TestEvaluation = {
  beat: 1;
  measureIndex: number;
  score: number;
  passed: boolean;
  trackingUnavailable: boolean;
  criteria: [];
  timestamp: number;
  metrics: { score: number };
};

type TestSequence = {
  passed: boolean;
  resultState: string;
  totalScore: number;
  beatEvaluations: TestEvaluation[];
};

const poseWithScore = (score: number): PoseLandmarkLike[] => [
  { x: score, y: 0, z: 0, visibility: 1 },
];

const createEngine = () =>
  useBeatWindowMovementRecognition<
    1,
    "test",
    { score: number },
    "FAILED",
    TestEvaluation,
    TestSequence
  >({
    seasonId: "autumn",
    defaultValue: "test",
    beatTargetsMs: { 1: 1_000 },
    beats: [1],
    evaluationWindowMs: 350,
    variationDurationMs: 4_000,
    measuresPerValue: 1,
    createEmptyMetrics: () => ({ score: 0 }),
    evaluateBeat: ({ landmarks, beat, timestamp, measureIndex }) => {
      const score = landmarks?.[0]?.x ?? 0;

      return {
        beat,
        measureIndex,
        score,
        passed: score >= 5,
        trackingUnavailable: !landmarks,
        criteria: [],
        timestamp,
        metrics: { score },
      };
    },
    evaluateSequence: (beatEvaluations) => ({
      passed: beatEvaluations.every((evaluation) => evaluation.passed),
      resultState: "complete",
      totalScore: beatEvaluations[0]?.score ?? 0,
      beatEvaluations,
    }),
    getMeasureResult: (evaluation) =>
      evaluation.passed ? "success" : "failed",
    getPrimaryMeasureFeedbackCode: () => "FAILED",
  });

const update = (
  engine: ReturnType<typeof createEngine>,
  seasonElapsedMs: number,
  score: number,
) => {
  engine.updateFrame({
    landmarks: poseWithScore(score),
    playbackState: "playing",
    seasonId: "autumn",
    seasonElapsedMs,
    repetitionIndex: 0,
    isTransition: false,
  });
};

describe("beat-window best sample selection", () => {
  it("keeps the strongest sample before the nominal beat", () => {
    const engine = createEngine();
    engine.start();

    update(engine, 700, 10);
    update(engine, 1_000, 1);
    update(engine, 1_400, 0);

    expect(engine.currentEvaluation.value?.score).toBe(10);
  });

  it("keeps the strongest sample after the nominal beat", () => {
    const engine = createEngine();
    engine.start();

    update(engine, 700, 2);
    update(engine, 1_000, 1);
    update(engine, 1_300, 9);
    update(engine, 1_400, 0);

    expect(engine.currentEvaluation.value?.score).toBe(9);
  });
});
