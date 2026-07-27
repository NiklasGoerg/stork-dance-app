export type MovementRange = {
  min: number;
  max: number;
};

export const formatMovementRange = (range: MovementRange) =>
  `${range.min}..${range.max}`;

export const isInMovementRange = (value: number | null, range: MovementRange) =>
  value !== null && value >= range.min && value <= range.max;

export const getRangeFailureDirection = (
  value: number | null,
  range: MovementRange,
) => {
  if (value === null) return undefined;
  if (value < range.min) return "tooLow";
  if (value > range.max) return "tooHigh";

  return undefined;
};

export const getMovementRangeFitScore = (
  value: number | null,
  range: MovementRange,
) => {
  if (value === null) return 0;
  if (isInMovementRange(value, range)) return 1;

  const width = Math.max(range.max - range.min, 0.01);
  const distanceFromRange =
    value < range.min ? range.min - value : value - range.max;

  return Math.max(0, 1 - distanceFromRange / width);
};
