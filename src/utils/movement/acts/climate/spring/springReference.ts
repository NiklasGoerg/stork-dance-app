import type {
  SpringBeat,
  SpringMovementReference,
  SpringThresholds,
  SpringValue,
} from "~/utils/movement/acts/climate/spring/springTypes";

export const SPRING_BEAT_EVALUATION_WINDOW_MS = 350;

export const SPRING_BEAT_WEIGHTS: Record<SpringBeat, number> = {
  1: 25,
  2: 30,
  3: 30,
  4: 15,
};

export const springValueOrder = ["100", "40", "30", "20"] as const;

export const SPRING_MOVEMENT_REFERENCE: Record<
  SpringValue,
  SpringMovementReference
> = {
  "100": {
    value: "100",
    label: "Full bloom",
    maxBeat: 3,
    handHeightRange: { min: 1.16, max: Number.POSITIVE_INFINITY },
  },
  "40": {
    value: "40",
    label: "Side bloom",
    maxBeat: 3,
    handHeightRange: { min: 0.3, max: 1 },
    handOpeningMin: 0.55,
    wristOutsideShoulderMin: 0,
  },
  "30": {
    value: "30",
    label: "Small side bloom",
    maxBeat: 3,
    handHeightRange: { min: 0.18, max: 0.72 },
    handOpeningMin: 0.24,
  },
  "20": {
    value: "20",
    label: "Small bloom",
    maxBeat: 3,
    handHeightRange: { min: 0.08, max: 0.5 },
  },
};

export const springDataValueMapping = [
  { sourceValue: 1, springValue: "100" },
  { sourceValue: 0.4, springValue: "40" },
  { sourceValue: 0.3, springValue: "30" },
  { sourceValue: 0.2, springValue: "20" },
] satisfies Array<{ sourceValue: number; springValue: SpringValue }>;

export const resolveSpringValue = (
  value: number | string | SpringValue | null | undefined,
): SpringValue => {
  if (value === "100" || value === "40" || value === "30" || value === "20") {
    return value;
  }

  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) return "100";

  const closest = springDataValueMapping
    .map((mapping) => ({
      ...mapping,
      distance: Math.abs(mapping.sourceValue - numericValue),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  if (!closest) return "100";

  return closest.distance <= 0.035 ? closest.springValue : "100";
};

export const springMovementConfig = {
  thresholds: {
    handsLowMax: 0.56,
    returnHeightMin: 0.52,
    returnHeightMax: 1.08,
    handsGatheredMax: 0.56,
    overheadHandsGatheredMax: 0.9,
    handsOpenMin: 1.05,
    handsCloseToBodyMax: 1.55,
    startCenterMaxOffset: 0.72,
    overheadHandHeightMin: 1.12,
    overheadCenterMaxOffset: 0.75,
    wristOutsideShoulderMin: 0.12,
    elbowExtendedMin: 126,
    centerMaxOffset: 0.42,
    openingImpulseMin: 0.08,
    symmetryMaxDifference: 0.34,
    kneeLiftMin: 0.1,
    beatPassScore: 68,
    successScore: 74,
    almostCorrectScore: 58,
  },
} satisfies { thresholds: SpringThresholds };
