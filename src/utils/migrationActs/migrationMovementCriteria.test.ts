import { afterEach, describe, expect, it, vi } from "vitest";
import { useMigrationActMovementRecognition } from "~/composables/migrationActs/useMigrationActMovementRecognition";
import type { PoseLandmarkLike } from "~/types/pose";
import { POSE_LANDMARK } from "~/utils/pose/poseLandmarks";
import {
  calculateWingState,
  evaluateMigrationMovementWindow,
  evaluateMigrationMovementBeat,
  evaluateSummerRestBeat,
  type MigrationMovementRecognitionSample,
} from "~/utils/migrationActs/migrationMovementCriteria";
import {
  calculateAnkleMovement,
  calculateHipCenter,
  calculateLateralLean,
  calculateShoulderCenter,
  calculateStanceWidth,
  calculateTorsoScale,
  calculateVerticalHipMovement,
} from "~/utils/migrationActs/migrationMovementMetrics";

const createLandmarks = ({
  leftAnkleX = 0.35,
  rightAnkleX = 0.65,
  hipY = 0.55,
  elbowY = 0.3,
  leftWristX = elbowY <= 0.32 ? 0.3 : 0.42,
  rightWristX = elbowY <= 0.32 ? 0.7 : 0.58,
  wristY = elbowY <= 0.32 ? 0.38 : 0.64,
}: {
  leftAnkleX?: number;
  rightAnkleX?: number;
  hipY?: number;
  elbowY?: number;
  leftWristX?: number;
  rightWristX?: number;
  wristY?: number;
} = {}): PoseLandmarkLike[] => {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
  }));

  landmarks[POSE_LANDMARK.LEFT_SHOULDER] = {
    x: 0.4,
    y: 0.3,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.RIGHT_SHOULDER] = {
    x: 0.6,
    y: 0.3,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.LEFT_HIP] = {
    x: 0.42,
    y: hipY,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.RIGHT_HIP] = {
    x: 0.58,
    y: hipY,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.LEFT_ELBOW] = {
    x: 0.35,
    y: elbowY,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.RIGHT_ELBOW] = {
    x: 0.65,
    y: elbowY,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.LEFT_WRIST] = {
    x: leftWristX,
    y: wristY,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.RIGHT_WRIST] = {
    x: rightWristX,
    y: wristY,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.LEFT_ANKLE] = {
    x: leftAnkleX,
    y: 0.85,
    visibility: 1,
  };
  landmarks[POSE_LANDMARK.RIGHT_ANKLE] = {
    x: rightAnkleX,
    y: 0.85,
    visibility: 1,
  };

  return landmarks;
};

const createSample = ({
  barElapsedMs,
  ankleX,
  rightAnkleX = 0.65,
  stanceWidth,
  hipX = 0.5,
  hipY = 0.55,
  wingState = "neutral",
}: {
  barElapsedMs: number;
  ankleX: number;
  rightAnkleX?: number;
  stanceWidth: number;
  hipX?: number;
  hipY?: number;
  wingState?: MigrationMovementRecognitionSample["wingState"];
}): MigrationMovementRecognitionSample => ({
  timestampMs: barElapsedMs,
  barElapsedMs,
  hipCenter: { x: hipX, y: hipY },
  torsoScale: 0.2,
  stanceWidth,
  lean: 0,
  leftAnkle: { x: ankleX, y: 0.85 },
  rightAnkle: { x: rightAnkleX, y: 0.85 },
  wingState,
});

const summerSamples: MigrationMovementRecognitionSample[] = [
  createSample({
    barElapsedMs: 0,
    ankleX: 0.35,
    rightAnkleX: 0.65,
    stanceWidth: 1.5,
  }),
  createSample({
    barElapsedMs: 700,
    ankleX: 0.35,
    rightAnkleX: 0.625,
    stanceWidth: 1.375,
  }),
  createSample({
    barElapsedMs: 1_000,
    ankleX: 0.35,
    rightAnkleX: 0.625,
    stanceWidth: 1.375,
  }),
  createSample({
    barElapsedMs: 1_700,
    ankleX: 0.35,
    rightAnkleX: 0.65,
    stanceWidth: 1.5,
  }),
  createSample({
    barElapsedMs: 2_000,
    ankleX: 0.35,
    rightAnkleX: 0.65,
    stanceWidth: 1.5,
  }),
  createSample({
    barElapsedMs: 2_700,
    ankleX: 0.375,
    rightAnkleX: 0.65,
    stanceWidth: 1.375,
  }),
  createSample({
    barElapsedMs: 3_000,
    ankleX: 0.375,
    rightAnkleX: 0.65,
    stanceWidth: 1.375,
  }),
  createSample({
    barElapsedMs: 3_700,
    ankleX: 0.35,
    rightAnkleX: 0.65,
    stanceWidth: 1.5,
  }),
];

const winterSamples: MigrationMovementRecognitionSample[] = [
  createSample({
    barElapsedMs: 0,
    ankleX: 0.4,
    rightAnkleX: 0.6,
    stanceWidth: 1,
  }),
  createSample({
    barElapsedMs: 700,
    ankleX: 0.4,
    rightAnkleX: 0.64,
    stanceWidth: 1.2,
  }),
  createSample({
    barElapsedMs: 1_000,
    ankleX: 0.4,
    rightAnkleX: 0.64,
    stanceWidth: 1.2,
  }),
  createSample({
    barElapsedMs: 1_700,
    ankleX: 0.625,
    rightAnkleX: 0.64,
    stanceWidth: 0.075,
  }),
  createSample({
    barElapsedMs: 2_000,
    ankleX: 0.625,
    rightAnkleX: 0.64,
    stanceWidth: 0.075,
  }),
  createSample({
    barElapsedMs: 2_700,
    ankleX: 0.35,
    rightAnkleX: 0.64,
    stanceWidth: 1.45,
  }),
  createSample({
    barElapsedMs: 3_000,
    ankleX: 0.35,
    rightAnkleX: 0.64,
    stanceWidth: 1.45,
  }),
  createSample({
    barElapsedMs: 3_700,
    ankleX: 0.35,
    rightAnkleX: 0.365,
    stanceWidth: 0.075,
  }),
];

const successfulSamples: MigrationMovementRecognitionSample[] = [
  createSample({
    barElapsedMs: 0,
    ankleX: 0.35,
    stanceWidth: 1.5,
    hipY: 0.55,
    wingState: "down",
  }),
  createSample({
    barElapsedMs: 700,
    ankleX: 0.3,
    stanceWidth: 1.75,
    wingState: "up",
  }),
  createSample({
    barElapsedMs: 1_000,
    ankleX: 0.3,
    stanceWidth: 1.75,
    wingState: "up",
  }),
  createSample({
    barElapsedMs: 1_700,
    ankleX: 0.35,
    stanceWidth: 1.5,
    wingState: "down",
  }),
  createSample({
    barElapsedMs: 2_000,
    ankleX: 0.35,
    stanceWidth: 1.5,
    wingState: "down",
  }),
  createSample({
    barElapsedMs: 2_700,
    ankleX: 0.3,
    stanceWidth: 1.75,
    wingState: "up",
  }),
  createSample({
    barElapsedMs: 3_000,
    ankleX: 0.3,
    stanceWidth: 1.75,
    wingState: "up",
  }),
  createSample({
    barElapsedMs: 3_700,
    ankleX: 0.35,
    stanceWidth: 1.5,
    wingState: "down",
  }),
];

describe("migration movement metrics and criteria", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("derives stable normalized body metrics", () => {
    const start = createLandmarks();
    const moved = createLandmarks({ leftAnkleX: 0.4, hipY: 0.58 });

    expect(calculateHipCenter(start)).toMatchObject({ x: 0.5, y: 0.55 });
    expect(calculateShoulderCenter(start)).toMatchObject({ x: 0.5, y: 0.3 });
    expect(calculateTorsoScale(start)).toBeCloseTo(0.2);
    expect(calculateStanceWidth(start)).toBeCloseTo(1.5);
    expect(calculateAnkleMovement(start, moved)).toBeGreaterThan(0.16);
    expect(calculateVerticalHipMovement(start, moved)).toBeGreaterThan(0.08);
    expect(calculateLateralLean(start)).toBeCloseTo(0);
  });

  it("accepts flight arms below shoulder height when wrists are above hips and opened outward", () => {
    expect(
      calculateWingState(
        createLandmarks({
          elbowY: 0.42,
          leftWristX: 0.28,
          rightWristX: 0.72,
          wristY: 0.45,
        }),
      ),
    ).toBe("up");
  });

  it("accepts opened flight arms regardless of left/right image ordering", () => {
    expect(
      calculateWingState(
        createLandmarks({
          elbowY: 0.42,
          leftWristX: 0.72,
          rightWristX: 0.28,
          wristY: 0.45,
        }),
      ),
    ).toBe("up");
  });

  it("falls back to elbows when wrist landmarks are not reliable", () => {
    const landmarks = createLandmarks({
      elbowY: 0.44,
      leftWristX: 0.28,
      rightWristX: 0.72,
      wristY: 0.45,
    });
    landmarks[POSE_LANDMARK.LEFT_WRIST] = {
      ...landmarks[POSE_LANDMARK.LEFT_WRIST]!,
      visibility: 0,
    };
    landmarks[POSE_LANDMARK.RIGHT_WRIST] = {
      ...landmarks[POSE_LANDMARK.RIGHT_WRIST]!,
      visibility: 0,
    };
    landmarks[POSE_LANDMARK.LEFT_ELBOW] = {
      ...landmarks[POSE_LANDMARK.LEFT_ELBOW]!,
      x: 0.3,
    };
    landmarks[POSE_LANDMARK.RIGHT_ELBOW] = {
      ...landmarks[POSE_LANDMARK.RIGHT_ELBOW]!,
      x: 0.7,
    };

    expect(calculateWingState(landmarks)).toBe("up");
  });

  it("keeps neutral hanging arms from passing as flight arms", () => {
    expect(
      calculateWingState(
        createLandmarks({
          elbowY: 0.5,
          leftWristX: 0.42,
          rightWristX: 0.58,
          wristY: 0.65,
        }),
      ),
    ).toBe("down");
  });

  it("rejects raised arms that are not laterally opened", () => {
    expect(
      calculateWingState(
        createLandmarks({
          elbowY: 0.44,
          leftWristX: 0.42,
          rightWristX: 0.58,
          wristY: 0.45,
        }),
      ),
    ).toBe("neutral");
  });

  it("recognizes a summer step-touch", () => {
    const evaluation = evaluateMigrationMovementWindow(
      "summer_rest",
      summerSamples,
    );

    expect(evaluation.status).toBe("success");
    expect(evaluation.stepActivity).toBe("success");
    expect(evaluation.stanceWidthChange).toBe("success");
  });

  it("requires the opposite foot for the second Summer step", () => {
    const samples: MigrationMovementRecognitionSample[] = [
      createSample({ barElapsedMs: 2_000, ankleX: 0.4, stanceWidth: 1 }),
      createSample({ barElapsedMs: 2_700, ankleX: 0.34, stanceWidth: 1.3 }),
    ];

    expect(evaluateSummerRestBeat(samples, 3, "right")).toMatchObject({
      status: "failed",
      detectedSide: "left",
    });
  });

  it("uses the calibrated Summer threshold for small natural taps", () => {
    const evaluateDelta = (rightAnkleX: number) =>
      evaluateMigrationMovementBeat({
        profile: "summer_rest",
        beatIndex: 1,
        samples: [
          createSample({
            barElapsedMs: 0,
            ankleX: 0.35,
            rightAnkleX: 0.65,
            stanceWidth: 1.5,
          }),
          createSample({
            barElapsedMs: 700,
            ankleX: 0.35,
            rightAnkleX,
            stanceWidth: 1.5,
          }),
        ],
      }).status;

    expect(evaluateDelta(0.633)).toBe("failed");
    expect(evaluateDelta(0.632)).toBe("success");
    expect(evaluateDelta(0.63)).toBe("success");
  });

  it("accepts winter step activity without requiring bounce", () => {
    const samplesWithoutBounce = winterSamples.map((sample) => ({
      ...sample,
      hipCenter: { x: 0.5, y: 0.55 },
    }));
    const evaluation = evaluateMigrationMovementWindow(
      "winter_rest",
      samplesWithoutBounce,
    );

    expect(evaluation.status).toBe("success");
    expect(evaluation.stepActivity).toBe("success");
    expect(evaluation.verticalBounce).toBe("failed");
  });

  it("requires both wing beat and step activity for migration", () => {
    const wingOnly = successfulSamples.map((sample) => ({
      ...sample,
      leftAnkle: { x: 0.35, y: 0.85 },
    }));

    expect(
      evaluateMigrationMovementWindow("migration", successfulSamples).status,
    ).toBe("success");
    expect(
      evaluateMigrationMovementWindow("migration", wingOnly),
    ).toMatchObject({
      status: "failed",
      wingBeat: "success",
      stepActivity: "failed",
    });
  });

  it("requires both migration half-phrases", () => {
    const onlyFirstPhrase = successfulSamples.map((sample) =>
      sample.barElapsedMs < 2_000
        ? sample
        : {
            ...sample,
            leftAnkle: { x: 0.35, y: 0.85 },
            stanceWidth: 1.5,
            wingState: "down" as const,
          },
    );

    expect(
      evaluateMigrationMovementWindow("migration", onlyFirstPhrase).status,
    ).toBe("failed");
  });

  it("keeps migration direction diagnostic rather than blocking", () => {
    const result = evaluateMigrationMovementBeat({
      profile: "migration",
      beatIndex: 1,
      expectedDirection: "outbound",
      samples: [
        createSample({
          barElapsedMs: 0,
          ankleX: 0.35,
          stanceWidth: 1.5,
          hipX: 0.5,
          wingState: "up",
        }),
        createSample({
          barElapsedMs: 700,
          ankleX: 0.3,
          stanceWidth: 1.75,
          hipX: 0.52,
          wingState: "up",
        }),
      ],
    });

    expect(result.status).toBe("success");
    expect(result.criteria.direction).toBe("failed");
    expect(result.metrics.expectedDirection).toBe("outbound");
  });

  it("applies the Spring override only when a threshold scale is requested", () => {
    const samples = [
      createSample({
        barElapsedMs: 0,
        ankleX: 0.35,
        stanceWidth: 1.5,
        wingState: "up",
      }),
      createSample({
        barElapsedMs: 700,
        ankleX: 0.333,
        stanceWidth: 1.6,
        wingState: "up",
      }),
    ];

    const evaluate = (thresholdScale: number) =>
      evaluateMigrationMovementBeat({
        profile: "migration",
        beatIndex: 1,
        samples,
        thresholdScale,
      }).status;

    expect(evaluate(1)).toBe("failed");
    expect(evaluate(0.9)).toBe("success");
  });

  it("accepts a natural Autumn beat-2 return without requiring exact baseline", () => {
    const naturalReturnSamples: MigrationMovementRecognitionSample[] = [
      createSample({
        barElapsedMs: 0,
        ankleX: 0.4,
        rightAnkleX: 0.6,
        stanceWidth: 1,
        wingState: "down",
      }),
      createSample({
        barElapsedMs: 700,
        ankleX: 0.35,
        rightAnkleX: 0.6,
        stanceWidth: 1.25,
        wingState: "up",
      }),
      createSample({
        barElapsedMs: 1_050,
        ankleX: 0.35,
        rightAnkleX: 0.6,
        stanceWidth: 1.25,
        wingState: "up",
      }),
      createSample({
        barElapsedMs: 1_850,
        ankleX: 0.376,
        rightAnkleX: 0.6,
        stanceWidth: 1.02,
        wingState: "down",
      }),
      createSample({
        barElapsedMs: 2_000,
        ankleX: 0.376,
        rightAnkleX: 0.6,
        stanceWidth: 1.02,
        wingState: "down",
      }),
      createSample({
        barElapsedMs: 2_700,
        ankleX: 0.35,
        rightAnkleX: 0.6,
        stanceWidth: 1.25,
        wingState: "up",
      }),
      createSample({
        barElapsedMs: 3_050,
        ankleX: 0.35,
        rightAnkleX: 0.6,
        stanceWidth: 1.25,
        wingState: "up",
      }),
      createSample({
        barElapsedMs: 3_850,
        ankleX: 0.376,
        rightAnkleX: 0.6,
        stanceWidth: 1.02,
        wingState: "down",
      }),
    ];

    const evaluation = evaluateMigrationMovementWindow(
      "migration",
      naturalReturnSamples,
      "outbound",
    );

    expect(evaluation.beatResults[1]).toMatchObject({
      beatIndex: 2,
      status: "success",
      detectedSide: "left",
      criteria: {
        returnToBaseline: "success",
        armsDown: "success",
      },
    });
    expect(evaluation.beatResults[1]?.metrics.returnFinalDistance).toBeLessThan(
      0.14,
    );
    expect(evaluation.status).toBe("success");
  });

  it("accepts Autumn beat 2 when stance stays slightly broad but the active foot returns", () => {
    const broadStanceReturn: MigrationMovementRecognitionSample[] = [
      createSample({
        barElapsedMs: 0,
        ankleX: 0.4,
        rightAnkleX: 0.6,
        stanceWidth: 1,
        wingState: "down",
      }),
      createSample({
        barElapsedMs: 700,
        ankleX: 0.35,
        rightAnkleX: 0.6,
        stanceWidth: 1.3,
        wingState: "up",
      }),
      createSample({
        barElapsedMs: 1_050,
        ankleX: 0.35,
        rightAnkleX: 0.6,
        stanceWidth: 1.3,
        wingState: "up",
      }),
      createSample({
        barElapsedMs: 2_080,
        ankleX: 0.377,
        rightAnkleX: 0.6,
        stanceWidth: 1.3,
        wingState: "down",
      }),
      createSample({
        barElapsedMs: 2_700,
        ankleX: 0.35,
        rightAnkleX: 0.6,
        stanceWidth: 1.3,
        wingState: "up",
      }),
      createSample({
        barElapsedMs: 3_850,
        ankleX: 0.377,
        rightAnkleX: 0.6,
        stanceWidth: 1.3,
        wingState: "down",
      }),
    ];

    const beat2 = evaluateMigrationMovementWindow(
      "migration",
      broadStanceReturn,
      "outbound",
    ).beatResults[1];

    expect(beat2).toMatchObject({
      beatIndex: 2,
      status: "success",
      criteria: {
        returnToBaseline: "success",
        stanceChange: "failed",
        armsDown: "success",
      },
    });
  });

  it("rejects Autumn beat 2 when the stepped foot stays out", () => {
    const stayedOutSamples = successfulSamples.map((sample) =>
      sample.barElapsedMs >= 1_000 && sample.barElapsedMs <= 2_000
        ? {
            ...sample,
            leftAnkle: { x: 0.3, y: 0.85 },
            stanceWidth: 1.75,
            wingState: "down" as const,
          }
        : sample,
    );

    const beat2 = evaluateMigrationMovementWindow(
      "migration",
      stayedOutSamples,
      "outbound",
    ).beatResults[1];

    expect(beat2).toMatchObject({
      beatIndex: 2,
      status: "failed",
      detectedSide: "left",
      criteria: {
        returnToBaseline: "failed",
      },
    });
  });

  it("uses the same guided return rule for beats 2 and 4", () => {
    const returnedFeet: MigrationMovementRecognitionSample[] = [
      createSample({
        barElapsedMs: 0,
        ankleX: 0.36,
        rightAnkleX: 0.64,
        stanceWidth: 1.4,
        wingState: "down",
      }),
      createSample({
        barElapsedMs: 120,
        ankleX: 0.36,
        rightAnkleX: 0.64,
        stanceWidth: 1.4,
        wingState: "down",
      }),
    ];
    const evaluate = (beatIndex: 2 | 4) =>
      evaluateMigrationMovementBeat({
        profile: "migration-guided",
        samples: returnedFeet,
        beatIndex,
        barBaseline: returnedFeet[0],
        expectedDirection: "outbound",
      });

    expect(evaluate(2)).toMatchObject({
      status: "success",
      criteria: { returnToBaseline: "success", armsDown: "success" },
    });
    expect(evaluate(4)).toEqual(evaluate(2));
  });

  it("accepts a guided action from arms up and a separated stance only", () => {
    const baseline = createSample({
      barElapsedMs: 0,
      ankleX: 0.36,
      rightAnkleX: 0.64,
      stanceWidth: 1.4,
      wingState: "down",
    });
    const action = createSample({
      barElapsedMs: 120,
      ankleX: 0.32,
      rightAnkleX: 0.68,
      stanceWidth: 1.8,
      hipX: 0.7,
      hipY: 0.7,
      wingState: "up",
    });

    expect(
      evaluateMigrationMovementBeat({
        profile: "migration-guided",
        samples: [baseline, action],
        beatIndex: 1,
        barBaseline: baseline,
        expectedDirection: "return",
      }).status,
    ).toBe("success");
    expect(
      evaluateMigrationMovementBeat({
        profile: "migration-guided",
        samples: [baseline, { ...action, stanceWidth: 1.4 }],
        beatIndex: 1,
        barBaseline: baseline,
      }).status,
    ).toBe("failed");
  });

  it("requires both arms down and closed feet for a guided return", () => {
    const evaluate = (
      stanceWidth: number,
      wingState: MigrationMovementRecognitionSample["wingState"],
    ) =>
      evaluateMigrationMovementBeat({
        profile: "migration-guided",
        samples: [0, 120].map((barElapsedMs) =>
          createSample({
            barElapsedMs,
            ankleX: 0.35,
            stanceWidth,
            wingState,
          }),
        ),
        beatIndex: 2,
      }).status;

    expect(evaluate(1.4, "down")).toBe("success");
    expect(evaluate(1.7, "down")).toBe("failed");
    expect(evaluate(1.4, "up")).toBe("failed");
  });

  it("marks missing required landmarks as not evaluable", () => {
    const missingSamples = [0, 1_000, 2_000, 3_000].map(
      (barElapsedMs): MigrationMovementRecognitionSample => ({
        timestampMs: barElapsedMs,
        barElapsedMs,
        hipCenter: null,
        torsoScale: null,
        stanceWidth: null,
        lean: null,
        leftAnkle: null,
        rightAnkle: null,
        wingState: "not_evaluable",
      }),
    );

    expect(
      evaluateMigrationMovementWindow("migration", missingSamples).status,
    ).toBe("not_evaluable");
  });

  it("pulses immediately for each correct Summer step and keeps bar progress", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const recognition = useMigrationActMovementRecognition();
    const frames = [
      { time: 0, leftAnkleX: 0.4, rightAnkleX: 0.6 },
      { time: 700, leftAnkleX: 0.4, rightAnkleX: 0.575 },
      { time: 1_000, leftAnkleX: 0.4, rightAnkleX: 0.575 },
      { time: 1_700, leftAnkleX: 0.4, rightAnkleX: 0.6 },
      { time: 2_000, leftAnkleX: 0.4, rightAnkleX: 0.6 },
      { time: 2_700, leftAnkleX: 0.425, rightAnkleX: 0.6 },
      { time: 3_000, leftAnkleX: 0.425, rightAnkleX: 0.6 },
      { time: 3_700, leftAnkleX: 0.4, rightAnkleX: 0.6 },
    ];
    const pulseIds: string[] = [];

    recognition.start("summer_rest", {
      transportTimeMs: 0,
      movementElapsedMs: 0,
      prerollMs: 1_000,
      movementId: "summer-step",
    });
    recognition.handlePoseFrame({
      landmarks: createLandmarks(),
      transportTimeMs: 500,
      timestampMs: 500,
    });
    expect(recognition.currentBeatWindow.value).toBe("preroll");
    expect(recognition.lastEvaluationStatus.value).toBe("idle");
    frames.forEach((frame) => {
      recognition.handlePoseFrame({
        landmarks: createLandmarks(frame),
        transportTimeMs: frame.time + 1_000,
        timestampMs: frame.time + 1_000,
      });
      const pulseId =
        recognition.skeletonFeedbackState.value.sourceEvaluationId;
      if (pulseId && !pulseIds.includes(pulseId)) pulseIds.push(pulseId);
    });
    recognition.handlePoseFrame({
      landmarks: createLandmarks(),
      transportTimeMs: 5_000,
      timestampMs: 5_000,
    });

    expect(recognition.lastEvaluationStatus.value).toBe("success");
    expect(recognition.lastBarEvaluation.value).toMatchObject({
      profile: "summer_rest",
      movementId: "summer-step",
      barIndex: 0,
      status: "success",
    });
    expect(recognition.lastBeatEvaluation.value).toMatchObject({
      barIndex: 0,
      beatIndex: 4,
      status: "success",
    });
    expect(recognition.lastBeatEvaluation.value?.evaluationId).toBe(
      recognition.lastSuccessfulEvaluationId.value,
    );
    expect(pulseIds).toHaveLength(4);
    expect(recognition.skeletonFeedbackState.value.mode).toBe("successPulse");
    expect(recognition.skeletonFeedbackState.value.pulseDurationMs).toBe(300);
    expect(recognition.lastPulseAt.value).not.toBeNull();

    recognition.cleanup();
  });

  it("uses the delayed Beat-2 return window for live Autumn feedback", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const recognition = useMigrationActMovementRecognition();
    recognition.start("migration", {
      transportTimeMs: 0,
      movementElapsedMs: 0,
      prerollMs: 0,
      movementId: "autumn-migration-medium",
    });

    [
      { time: 0, leftAnkleX: 0.4, rightAnkleX: 0.6, elbowY: 0.4 },
      { time: 700, leftAnkleX: 0.35, rightAnkleX: 0.6, elbowY: 0.3 },
      { time: 1_000, leftAnkleX: 0.35, rightAnkleX: 0.6, elbowY: 0.3 },
      { time: 2_080, leftAnkleX: 0.377, rightAnkleX: 0.6, elbowY: 0.4 },
    ].forEach((frame) => {
      recognition.handlePoseFrame({
        landmarks: createLandmarks(frame),
        transportTimeMs: frame.time,
        timestampMs: frame.time,
      });
    });

    expect(recognition.lastBeatEvaluation.value).toMatchObject({
      beatIndex: 2,
      status: "success",
      detectedSide: "left",
      criteria: {
        returnToBaseline: "success",
        armsDown: "success",
      },
    });
    expect(recognition.lastSuccessfulEvaluationId.value).toContain("-2");
    recognition.cleanup();
  });

  it.each([2, 4] as const)(
    "uses the same action-peak-to-neutral rule for Summer beat %s",
    (beatIndex) => {
      const actionStartMs = (beatIndex - 2) * 1_000;
      const returnStartMs = (beatIndex - 1) * 1_000;
      const side = beatIndex === 2 ? "right" : "left";
      const actionSamples = [
        createSample({
          barElapsedMs: actionStartMs,
          ankleX: 0.4,
          rightAnkleX: 0.6,
          stanceWidth: 1,
        }),
        createSample({
          barElapsedMs: actionStartMs + 700,
          ankleX: side === "left" ? 0.35 : 0.4,
          rightAnkleX: side === "right" ? 0.65 : 0.6,
          stanceWidth: 1.25,
        }),
      ];
      const returnSamples = [
        createSample({
          barElapsedMs: returnStartMs,
          ankleX: side === "left" ? 0.37 : 0.4,
          rightAnkleX: side === "right" ? 0.63 : 0.6,
          stanceWidth: 1.15,
        }),
        createSample({
          barElapsedMs: returnStartMs + 700,
          ankleX: side === "left" ? 0.395 : 0.4,
          rightAnkleX: side === "right" ? 0.605 : 0.6,
          stanceWidth: 1.02,
        }),
      ];

      const result = evaluateMigrationMovementBeat({
        profile: "summer_rest",
        beatIndex,
        samples: returnSamples,
        actionSamples,
        barBaseline: createSample({
          barElapsedMs: 0,
          ankleX: 0.4,
          rightAnkleX: 0.6,
          stanceWidth: 1,
        }),
        returnSide: side,
      });

      expect(result).toMatchObject({
        status: "success",
        detectedSide: side,
        criteria: {
          returnToBaseline: "success",
          stanceChange: "success",
        },
        metrics: {
          activeSide: side,
          validSampleCount: 2,
          actionSampleCount: 2,
        },
      });
      expect(result.metrics.returnFinalDistance).toBeLessThan(0.12);
      expect(result.metrics.stanceChange).toBeGreaterThan(0.05);
    },
  );

  it.each([
    ["stayed out", 0.65, 1.25],
    ["did not narrow the stance", 0.605, 1.25],
    ["only jittered", 0.648, 1.24],
  ] as const)(
    "rejects a Summer beat-2 return that %s",
    (_, returnX, stance) => {
      const baseline = createSample({
        barElapsedMs: 0,
        ankleX: 0.4,
        rightAnkleX: 0.6,
        stanceWidth: 1,
      });
      const actionSamples = [
        baseline,
        createSample({
          barElapsedMs: 700,
          ankleX: 0.4,
          rightAnkleX: 0.65,
          stanceWidth: 1.25,
        }),
      ];
      const returnSamples = [1_000, 1_700].map((barElapsedMs) =>
        createSample({
          barElapsedMs,
          ankleX: 0.4,
          rightAnkleX: returnX,
          stanceWidth: stance,
        }),
      );

      expect(
        evaluateMigrationMovementBeat({
          profile: "summer_rest",
          beatIndex: 2,
          samples: returnSamples,
          actionSamples,
          barBaseline: baseline,
          returnSide: "right",
        }).status,
      ).toBe("failed");
    },
  );

  it("rejects Summer beat 2 when the wrong foot moves or ankle visibility is missing", () => {
    const baseline = createSample({
      barElapsedMs: 0,
      ankleX: 0.4,
      rightAnkleX: 0.6,
      stanceWidth: 1,
    });
    const actionSamples = [
      baseline,
      createSample({
        barElapsedMs: 700,
        ankleX: 0.4,
        rightAnkleX: 0.65,
        stanceWidth: 1.25,
      }),
    ];
    const wrongFoot = [1_000, 1_700].map((barElapsedMs, index) =>
      createSample({
        barElapsedMs,
        ankleX: index ? 0.35 : 0.4,
        rightAnkleX: 0.65,
        stanceWidth: index ? 1.05 : 1.25,
      }),
    );
    const missingVisibility = wrongFoot.map((sample) => ({
      ...sample,
      rightAnkle: null,
    }));

    expect(
      evaluateMigrationMovementBeat({
        profile: "summer_rest",
        beatIndex: 2,
        samples: wrongFoot,
        actionSamples,
        barBaseline: baseline,
        returnSide: "right",
      }).status,
    ).toBe("failed");
    expect(
      evaluateMigrationMovementBeat({
        profile: "summer_rest",
        beatIndex: 2,
        samples: missingVisibility,
        actionSamples,
        barBaseline: baseline,
        returnSide: "right",
      }).status,
    ).toBe("not_evaluable");
  });

  it.each([
    {
      profile: "winter_rest" as const,
      movementId: "winter-step",
      frames: [
        { time: 0, leftAnkleX: 0.4, rightAnkleX: 0.6, elbowY: 0.4 },
        { time: 700, leftAnkleX: 0.4, rightAnkleX: 0.64, elbowY: 0.4 },
        { time: 1_000, leftAnkleX: 0.4, rightAnkleX: 0.64, elbowY: 0.4 },
        { time: 1_700, leftAnkleX: 0.625, rightAnkleX: 0.64, elbowY: 0.4 },
        { time: 2_000, leftAnkleX: 0.625, rightAnkleX: 0.64, elbowY: 0.4 },
        { time: 2_700, leftAnkleX: 0.35, rightAnkleX: 0.64, elbowY: 0.4 },
        { time: 3_000, leftAnkleX: 0.35, rightAnkleX: 0.64, elbowY: 0.4 },
        { time: 3_700, leftAnkleX: 0.35, rightAnkleX: 0.365, elbowY: 0.4 },
      ],
    },
    {
      profile: "migration" as const,
      movementId: "autumn-migration-medium",
      frames: [
        { time: 0, leftAnkleX: 0.4, rightAnkleX: 0.6, elbowY: 0.4 },
        { time: 700, leftAnkleX: 0.35, rightAnkleX: 0.6, elbowY: 0.3 },
        { time: 1_000, leftAnkleX: 0.35, rightAnkleX: 0.6, elbowY: 0.3 },
        { time: 1_700, leftAnkleX: 0.4, rightAnkleX: 0.6, elbowY: 0.4 },
        { time: 2_000, leftAnkleX: 0.4, rightAnkleX: 0.6, elbowY: 0.4 },
        { time: 2_700, leftAnkleX: 0.35, rightAnkleX: 0.6, elbowY: 0.3 },
        { time: 3_000, leftAnkleX: 0.35, rightAnkleX: 0.6, elbowY: 0.3 },
        { time: 3_700, leftAnkleX: 0.4, rightAnkleX: 0.6, elbowY: 0.4 },
      ],
    },
  ])(
    "pulses once per successful $profile beat without a bar pulse",
    ({ profile, movementId, frames }) => {
      vi.stubGlobal("requestAnimationFrame", () => 1);
      vi.stubGlobal("cancelAnimationFrame", () => undefined);
      const recognition = useMigrationActMovementRecognition();
      const pulseIds = new Set<string>();
      recognition.start(profile, { movementId });

      frames.forEach((frame) => {
        recognition.handlePoseFrame({
          landmarks: createLandmarks(frame),
          transportTimeMs: frame.time,
          timestampMs: frame.time,
        });
        const id = recognition.skeletonFeedbackState.value.sourceEvaluationId;
        if (id) pulseIds.add(id);
      });
      recognition.handlePoseFrame({
        landmarks: createLandmarks(frames[0]),
        transportTimeMs: 4_000,
        timestampMs: 4_000,
      });

      expect(recognition.lastBarEvaluation.value?.status).toBe("success");
      expect(recognition.lastBarEvaluation.value?.beatResults).toHaveLength(4);
      expect(pulseIds).toHaveLength(4);
      expect(recognition.lastSuccessfulEvaluationId.value).toContain("-4");
      expect(recognition.lastSuccessfulEvaluationId.value).not.toBe(
        recognition.lastBarEvaluation.value?.evaluationId,
      );
      recognition.cleanup();
    },
  );

  it("exposes failed and not-evaluable bars with unique evaluation IDs", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const recognition = useMigrationActMovementRecognition();

    recognition.start("summer_rest", {
      transportTimeMs: 0,
      movementElapsedMs: 0,
      prerollMs: 0,
      movementId: "summer-step",
    });
    [0, 500, 1_000, 1_500, 2_000, 2_500, 3_000, 3_500].forEach((time) =>
      recognition.handlePoseFrame({
        landmarks: createLandmarks(),
        transportTimeMs: time,
        timestampMs: time,
      }),
    );
    recognition.handlePoseFrame({
      landmarks: createLandmarks(),
      transportTimeMs: 4_000,
      timestampMs: 4_000,
    });
    const failedId = recognition.lastBarEvaluation.value?.evaluationId;
    expect(recognition.lastBarEvaluation.value).toMatchObject({
      status: "failed",
      barIndex: 0,
    });

    [4_500, 5_000, 5_500, 6_000, 6_500, 7_000, 7_500].forEach((time) =>
      recognition.handlePoseFrame({
        landmarks: null,
        transportTimeMs: time,
        timestampMs: time,
      }),
    );
    recognition.handlePoseFrame({
      landmarks: null,
      transportTimeMs: 8_000,
      timestampMs: 8_000,
    });
    expect(recognition.lastBarEvaluation.value).toMatchObject({
      status: "not_evaluable",
      barIndex: 1,
    });
    expect(recognition.lastBarEvaluation.value?.evaluationId).not.toBe(
      failedId,
    );
    expect(recognition.lastSuccessfulEvaluationId.value).toBeNull();

    recognition.cleanup();
  });
});
