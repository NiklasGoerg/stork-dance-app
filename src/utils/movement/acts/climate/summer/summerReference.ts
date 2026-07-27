import type {
  SummerBeat,
  SummerIntensity,
  SummerMovementReference,
  SummerThresholds,
} from "~/utils/movement/acts/climate/summer/summerTypes";

export const BEAT_EVALUATION_WINDOW_MS = 350;
export const MAX_AUTOMATIC_RETRIES = 2;
export const SUMMER_BEAT_WEIGHTS: Record<SummerBeat, number> = {
  1: 20,
  2: 35,
  3: 20,
  4: 25,
};

// Body-relative prototype ranges. They are intentionally tolerant and should be
// empirically calibrated with live participants.
export const SUMMER_MOVEMENT_REFERENCE: Record<
  SummerIntensity,
  SummerMovementReference
> = {
  "100": {
    label: "Full movement",
    shapePassScore: 68,
    intensityPassScore: 68,
    beat2: {
      handHeightClass: "aboveHead",
      elbowClass: "mostlyStraight",
      handRaiseAmplitude: { min: 0.72, max: 1.85 },
      elbowAngle: { min: 145, max: 180 },
      handsAboveHeadRequired: true,
    },
    beat3: {
      armOpeningClass: "large",
      handHeightClass: "shoulderLevel",
      elbowClass: "mostlyStraight",
      armOpening: { min: 1.25, max: 2.4 },
      elbowAngle: { min: 140, max: 180 },
      importance: "supporting",
    },
  },
  "60": {
    label: "Medium movement",
    shapePassScore: 64,
    intensityPassScore: 62,
    beat2: {
      handHeightClass: "aboveHeadReduced",
      elbowClass: "moderatelyBent",
      handRaiseAmplitude: { min: 0.48, max: 0.98 },
      elbowAngle: { min: 105, max: 162 },
      handsAboveHeadRequired: true,
    },
    beat3: {
      armOpeningClass: "medium",
      handHeightClass: "shoulderLevel",
      elbowClass: "moderatelyBent",
      armOpening: { min: 0.82, max: 1.35 },
      elbowAngle: { min: 95, max: 165 },
      importance: "supporting",
    },
  },
  "30": {
    label: "Small movement",
    shapePassScore: 60,
    intensityPassScore: 58,
    beat2: {
      handHeightClass: "inFrontOfHead",
      elbowClass: "clearlyBent",
      handRaiseAmplitude: { min: 0.12, max: 0.58 },
      elbowAngle: { min: 68, max: 138 },
      handsAboveHeadRequired: false,
    },
    beat3: {
      armOpeningClass: "small",
      handHeightClass: "aroundShoulderLevel",
      elbowClass: "clearlyBent",
      armOpening: { min: 0.44, max: 0.86 },
      elbowAngle: { min: 60, max: 145 },
      importance: "supporting",
    },
  },
  "10": {
    label: "Minimal movement",
    shapePassScore: 56,
    intensityPassScore: 54,
    beat2: {
      handHeightClass: "upperBodyToShoulderLevel",
      elbowClass: "clearlyBent",
      handRaiseAmplitude: { min: 0.025, max: 0.34 },
      elbowAngle: { min: 52, max: 130 },
      handsAboveHeadRequired: false,
    },
    beat3: {
      armOpeningClass: "minimal",
      handHeightClass: "aroundShoulderLevel",
      elbowClass: "clearlyBent",
      armOpening: { min: 0.18, max: 0.52 },
      elbowAngle: { min: 50, max: 135 },
      importance: "supporting",
    },
  },
};

export const summerMovementConfig: Record<
  SummerIntensity,
  { thresholds: SummerThresholds }
> = {
  "100": {
    // Prototype defaults. These need empirical tuning with live participants.
    thresholds: {
      closedStanceMax: 0.8,
      handsTogetherMax: 0.9,
      handCenterMaxOffset: 0.65,
      chestMinY: -0.3,
      chestMaxY: 1.45,
      handsAboveHeadMargin: 0.08,
      armsRaisedAboveShoulders: 0.35,
      overheadHandsTogetherMax: 1.25,
      openHandsMin: 1.35,
      shoulderHeightTolerance: 0.85,
      handsLoweredMinY: 0.75,
      returnExpansionRatio: 0.72,
      straightElbowMinAngle: 140,
      beatPassScore: 72,
      essentialPassRatio: 0.75,
      successScore: 74,
      almostCorrectScore: 58,
    },
  },
  "60": {
    // Tolerant medium-range prototype values; tune after live-body testing.
    thresholds: {
      closedStanceMax: 0.8,
      handsTogetherMax: 0.95,
      handCenterMaxOffset: 0.7,
      chestMinY: -0.25,
      chestMaxY: 1.45,
      handsAboveHeadMargin: 0.04,
      armsRaisedAboveShoulders: 0.18,
      overheadHandsTogetherMax: 1.35,
      openHandsMin: 0.96,
      shoulderHeightTolerance: 0.95,
      handsLoweredMinY: 0.62,
      returnExpansionRatio: 0.78,
      straightElbowMinAngle: 118,
      beatPassScore: 66,
      essentialPassRatio: 0.72,
      successScore: 68,
      almostCorrectScore: 54,
    },
  },
  "30": {
    // Tolerant small-range prototype values; tune after live-body testing.
    thresholds: {
      closedStanceMax: 0.8,
      handsTogetherMax: 1,
      handCenterMaxOffset: 0.75,
      chestMinY: -0.18,
      chestMaxY: 1.45,
      handsAboveHeadMargin: -0.05,
      armsRaisedAboveShoulders: -0.04,
      overheadHandsTogetherMax: 1.45,
      openHandsMin: 0.58,
      shoulderHeightTolerance: 1.05,
      handsLoweredMinY: 0.5,
      returnExpansionRatio: 0.84,
      straightElbowMinAngle: 92,
      beatPassScore: 62,
      essentialPassRatio: 0.68,
      successScore: 64,
      almostCorrectScore: 50,
    },
  },
  "10": {
    // Tolerant minimal-range prototype values; tune after live-body testing.
    thresholds: {
      closedStanceMax: 0.8,
      handsTogetherMax: 1.05,
      handCenterMaxOffset: 0.8,
      chestMinY: -0.12,
      chestMaxY: 1.45,
      handsAboveHeadMargin: -0.1,
      armsRaisedAboveShoulders: -0.22,
      overheadHandsTogetherMax: 1.5,
      openHandsMin: 0.32,
      shoulderHeightTolerance: 1.15,
      handsLoweredMinY: 0.42,
      returnExpansionRatio: 0.9,
      straightElbowMinAngle: 72,
      beatPassScore: 58,
      essentialPassRatio: 0.64,
      successScore: 60,
      almostCorrectScore: 48,
    },
  },
};
