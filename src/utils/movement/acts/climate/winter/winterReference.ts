import type {
  WinterBeat,
  WinterMovementReference,
  WinterThresholds,
  WinterValue,
} from "~/utils/movement/acts/climate/winter/winterTypes";

export const WINTER_BEAT_EVALUATION_WINDOW_MS = 350;

export const WINTER_BEAT_WEIGHTS: Record<WinterBeat, number> = {
  1: 20,
  2: 25,
  3: 40,
  4: 15,
};

export const winterValueOrder = ["100", "50", "20", "-10"] as const;

export const WINTER_MOVEMENT_REFERENCE: Record<
  WinterValue,
  WinterMovementReference
> = {
  "100": {
    value: "100",
    label: "Upright",
    contractionRange: { min: 0, max: 0.34 },
    kneeAngleRange: { min: 136, max: Number.POSITIVE_INFINITY },
  },
  "50": {
    value: "50",
    label: "Medium contraction",
    contractionRange: { min: 0.14, max: 0.72 },
    kneeAngleRange: { min: 96, max: 170 },
  },
  "20": {
    value: "20",
    label: "Deep contraction",
    contractionRange: { min: 0.38, max: 0.98 },
    kneeAngleRange: { min: 65, max: 145 },
  },
  "-10": {
    value: "-10",
    label: "Extreme cold",
    contractionRange: { min: 0.38, max: 1.05 },
    kneeAngleRange: { min: 55, max: 145 },
    requiresHeadProtection: true,
  },
};

export const winterDataValueMapping = [
  { sourceValue: 1, winterValue: "100" },
  { sourceValue: 0.5, winterValue: "50" },
  { sourceValue: 0.2, winterValue: "20" },
  { sourceValue: -0.1, winterValue: "-10" },
] satisfies Array<{ sourceValue: number; winterValue: WinterValue }>;

export const resolveWinterValue = (
  value: number | string | WinterValue | null | undefined,
): WinterValue => {
  if (value === "100" || value === "50" || value === "20" || value === "-10") {
    return value;
  }

  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) return "100";

  const closest = winterDataValueMapping
    .map((mapping) => ({
      ...mapping,
      distance: Math.abs(mapping.sourceValue - numericValue),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  return closest && closest.distance <= 0.04 ? closest.winterValue : "100";
};

export const winterMovementConfig = {
  thresholds: {
    openArmWidthMin: 1.45,
    shoulderHeightTolerance: 0.42,
    elbowStraightMin: 128,
    selfHugHeightMin: -0.75,
    selfHugHeightMax: 1.08,
    selfHugCenterMaxOffset: 0.85,
    selfHugHandDistanceMax: 1.7,
    oppositeShoulderDistanceMax: 1.45,
    feetStableMaxDelta: 0.38,
    uprightDropMax: 0.34,
    uprightKneeAngleMin: 136,
    returnHandDistanceMin: 0.72,
    returnDropMax: 0.42,
    beatPassScore: 66,
    successScore: 74,
    almostCorrectScore: 58,
  },
} satisfies { thresholds: WinterThresholds };
