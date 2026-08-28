import { describe, expect, it } from "vitest";

import { buildAutumnBeatCriteria } from "~/utils/movement/acts/climate/autumn/autumnCriteria";
import type { AutumnRecognitionMetrics } from "~/utils/movement/acts/climate/autumn/autumnTypes";

const createMetrics = (
  overrides: Partial<AutumnRecognitionMetrics> = {},
): AutumnRecognitionMetrics => ({
  shoulderWidth: 1,
  normalizedHandDistance: 0.6,
  normalizedAnkleDistance: 0.4,
  expectedStartSide: "left",
  detectedStartSide: "left",
  startSidePassed: true,
  directionLocked: false,
  directionResult: "unknown",
  detectedDirection: "unknown",
  directionFailureReason: "unknown",
  signedProgressFromBeat1: 0,
  normalizedProgress: 0,
  expectedProgressMin: 0,
  expectedProgressMax: 0.52,
  beat1HandCenterXOffset: -0.5,
  beat1OuterWristXOffset: -0.55,
  handCenterXOffset: -0.5,
  handCenterYFromShoulders: 0.2,
  handRadiusFromTorso: 0.7,
  handTravelProgress: 0,
  handCenterRegionProgress: 0,
  detectedEndpointRegion: "startSide",
  endpointErrorKind: "matched",
  outerWristRelativeToOuterShoulder: 0,
  outerWristXOffset: -0.55,
  outerWristProgressToCenter: 0,
  outerElbowAngle: 110,
  normalizedShoulderWristDistance: 0.8,
  activeArm: "left",
  armExtended: false,
  outerArmExtensionClass: "compact",
  outerArmDirectionX: 0,
  outerArmDirectionY: 0,
  innerForearmDirectionX: 0,
  innerForearmDirectionY: 0,
  armDirectionSimilarity: 0,
  torsoFacingScore: 1,
  progressFromStartingPose: 0,
  detectedValueClass: "25",
  sweepPositionValid: true,
  landmarkConfidence: "tracked",
  ...overrides,
});

const getCriterion = (
  criteria: ReturnType<typeof buildAutumnBeatCriteria>,
  id: string,
) => criteria.find((item) => item.id === id);

describe("autumn criteria", () => {
  it("allows the 25 percent endpoint to stay close to the starting side", () => {
    const criteria = buildAutumnBeatCriteria(3, createMetrics(), {
      expectedDirection: "leftToRight",
      expectedValueClass: "25",
    });

    expect(getCriterion(criteria, "sweep-direction")?.passed).toBe(true);
    expect(getCriterion(criteria, "progress-from-start")?.passed).toBe(true);
    expect(getCriterion(criteria, "endpoint-value-range")?.passed).toBe(true);
  });

  it("keeps larger autumn values from passing with no sweep", () => {
    const criteria = buildAutumnBeatCriteria(3, createMetrics(), {
      expectedDirection: "leftToRight",
      expectedValueClass: "40",
    });

    expect(getCriterion(criteria, "sweep-direction")?.passed).toBe(false);
    expect(getCriterion(criteria, "progress-from-start")?.passed).toBe(false);
    expect(getCriterion(criteria, "endpoint-value-range")?.passed).toBe(false);
  });

  it("accepts the smallest Autumn value when the target is reached early and held", () => {
    const criteria = buildAutumnBeatCriteria(
      3,
      createMetrics({
        directionLocked: true,
        directionResult: "matched",
        detectedDirection: "leftToRight",
        signedProgressFromBeat1: 0.28,
        normalizedProgress: 0.28,
        handTravelProgress: 0.28,
        handCenterRegionProgress: 0.28,
        progressFromStartingPose: 0.28,
        detectedEndpointRegion: "startSideDiagonal",
        endpointErrorKind: "matched",
        outerWristProgressToCenter: 0.18,
        detectedValueClass: "25",
      }),
      {
        expectedDirection: "leftToRight",
        expectedValueClass: "25",
      },
    );

    expect(getCriterion(criteria, "sweep-direction")?.passed).toBe(true);
    expect(getCriterion(criteria, "progress-from-start")?.passed).toBe(true);
    expect(getCriterion(criteria, "endpoint-value-range")?.passed).toBe(true);
  });

  it("keeps large Autumn endpoint checks separate from arm styling", () => {
    const criteria = buildAutumnBeatCriteria(
      3,
      createMetrics({
        directionLocked: true,
        directionResult: "matched",
        detectedDirection: "leftToRight",
        signedProgressFromBeat1: 0.92,
        normalizedProgress: 0.92,
        handTravelProgress: 0.92,
        handCenterRegionProgress: 0.92,
        progressFromStartingPose: 0.92,
        detectedEndpointRegion: "farDestinationSide",
        endpointErrorKind: "matched",
        outerWristRelativeToOuterShoulder: -0.2,
        outerWristProgressToCenter: 0.9,
        detectedValueClass: "100",
        armExtended: false,
        outerArmExtensionClass: "compact",
        innerForearmDirectionX: -1,
      }),
      {
        expectedDirection: "leftToRight",
        expectedValueClass: "100",
      },
    );

    expect(getCriterion(criteria, "endpoint-value-range")?.passed).toBe(true);
    expect(getCriterion(criteria, "outer-arm-extension")?.importance).toBe(
      "supporting",
    );
    expect(getCriterion(criteria, "outer-arm-extension")?.feedbackCode).toBe(
      undefined,
    );
    expect(
      getCriterion(criteria, "inner-forearm-oriented-endpoint")?.importance,
    ).toBe("supporting");
    expect(
      getCriterion(criteria, "inner-forearm-oriented-endpoint")?.feedbackCode,
    ).toBe(undefined);
    expect(getCriterion(criteria, "outer-wrist-endpoint-side")?.importance).toBe(
      "supporting",
    );
  });
});
