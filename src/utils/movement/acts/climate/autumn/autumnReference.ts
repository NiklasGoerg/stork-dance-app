import type {
  AutumnBeat,
  AutumnEndpointRegion,
  AutumnMovementReference,
  AutumnThresholds,
  AutumnValueClass,
} from "~/utils/movement/acts/climate/autumn/autumnTypes";

export const AUTUMN_BEAT_EVALUATION_WINDOW_MS = 350;
export const AUTUMN_BEAT_WEIGHTS: Record<AutumnBeat, number> = {
  1: 25,
  2: 10,
  3: 45,
  4: 20,
};

export const AUTUMN_ENDPOINT_ZONES: Record<
  Exclude<AutumnEndpointRegion, "unknown">,
  { min: number; max: number }
> = {
  // Signed along the sweep direction: 0 is the Beat-1 side, 1 is full reach on
  // the destination side. These prototype zones are deliberately broad because
  // camera perspective and arm proportions move the hand center substantially.
  startSide: { min: -0.2, max: 0.12 },
  startSideDiagonal: { min: 0.12, max: 0.34 },
  nearCenterStartSide: { min: 0.3, max: 0.47 },
  centerFront: { min: 0.43, max: 0.62 },
  destinationSide: { min: 0.68, max: 0.9 },
  farDestinationSide: { min: 0.88, max: Number.POSITIVE_INFINITY },
};

export const AUTUMN_MOVEMENT_REFERENCE: Record<
  AutumnValueClass,
  AutumnMovementReference
> = {
  "25": {
    valueClass: "25",
    label: "Quarter sweep",
    endpointRegion: "startSideDiagonal",
    outerArmExtension: "compact",
    requireOuterWristBeyondShoulder: false,
    requireProgressFromBeat1: true,
    progressRange: { min: 0, max: 0.52 },
  },
  "40": {
    valueClass: "40",
    label: "Almost front",
    endpointRegion: "nearCenterStartSide",
    outerArmExtension: "forward",
    requireOuterWristBeyondShoulder: false,
    requireProgressFromBeat1: true,
    progressRange: { min: 0.26, max: 0.52 },
  },
  "50": {
    valueClass: "50",
    label: "Front center",
    endpointRegion: "centerFront",
    outerArmExtension: "forward",
    requireOuterWristBeyondShoulder: false,
    requireProgressFromBeat1: true,
    progressRange: AUTUMN_ENDPOINT_ZONES.centerFront,
  },
  "80": {
    valueClass: "80",
    label: "Large incomplete sweep",
    endpointRegion: "destinationSide",
    outerArmExtension: "large",
    requireOuterWristBeyondShoulder: false,
    requireProgressFromBeat1: true,
    progressRange: { min: 0.76, max: Number.POSITIVE_INFINITY },
  },
  "100": {
    valueClass: "100",
    label: "Full sweep",
    endpointRegion: "farDestinationSide",
    outerArmExtension: "maximum",
    requireOuterWristBeyondShoulder: true,
    requireProgressFromBeat1: true,
    progressRange: AUTUMN_ENDPOINT_ZONES.farDestinationSide,
  },
};

export const autumnMovementConfig = {
  thresholds: {
    handsTogetherMax: 1.45,
    startSideMinOffset: 0.42,
    centerMaxOffset: 0.42,
    chestMinY: -0.75,
    chestMaxY: 1.55,
    endpointTolerance: 0.14,
    beat2ProgressMin: 0.12,
    beat3ProgressMin: 0.18,
    negativeProgressTolerance: 0.15,
    outerWristBeyondShoulderMin: 0.08,
    outerWristNearShoulderMin: -0.08,
    outerWristAutumn80Min: -0.08,
    outerElbowExtendedMin: 145,
    outerElbowNearExtendedMin: 135,
    normalizedShoulderWristDistanceMin: 1.1,
    armDirectionSimilarityMin: 0.34,
    innerForearmDestinationMin: 0.12,
    torsoFacingMinScore: 0.44,
    radiusMin: 0.42,
    radiusMax: 1.45,
    closedFeetMax: 0.82,
    beatPassScore: 68,
    successScore: 74,
    almostCorrectScore: 58,
  },
} satisfies { thresholds: AutumnThresholds };
