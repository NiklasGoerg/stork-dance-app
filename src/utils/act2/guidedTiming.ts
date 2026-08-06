export type GuidedTransportPosition = {
  transportMs: number;
  barIndex: number;
  beatIndex: 1 | 2 | 3 | 4;
  barLocalMs: number;
};

export const resolveGuidedTransportPosition = (
  transportMs: number,
  beatDurationMs = 1_000,
): GuidedTransportPosition => {
  const beatMs = Math.max(1, beatDurationMs);
  const barMs = beatMs * 4;
  const normalizedMs = Math.max(0, transportMs);
  const barLocalMs = normalizedMs % barMs;

  return {
    transportMs: normalizedMs,
    barIndex: Math.floor(normalizedMs / barMs),
    beatIndex: (Math.floor(barLocalMs / beatMs) + 1) as 1 | 2 | 3 | 4,
    barLocalMs,
  };
};

export const resolveNextGuidedBarBoundary = (
  transportMs: number,
  beatDurationMs = 1_000,
  includeCurrent = false,
) => {
  const barMs = Math.max(1, beatDurationMs) * 4;
  const normalizedMs = Math.max(0, transportMs);
  const remainder = normalizedMs % barMs;

  if (includeCurrent && remainder <= 40) return normalizedMs - remainder;
  return normalizedMs + (barMs - remainder || barMs);
};

export const resolveGuidedMovementSourceTime = ({
  transportMs,
  ownerStartedAtMs,
  prerollMs,
}: {
  transportMs: number;
  ownerStartedAtMs: number;
  prerollMs: number;
}) => Math.max(0, transportMs - ownerStartedAtMs + Math.max(0, prerollMs));

export const resolveGuidedCountdownValue = ({
  transportMs,
  attemptStartsAtMs,
  beatDurationMs = 1_000,
}: {
  transportMs: number;
  attemptStartsAtMs: number;
  beatDurationMs?: number;
}) => {
  const remainingMs = attemptStartsAtMs - transportMs;
  const barMs = Math.max(1, beatDurationMs) * 4;
  if (remainingMs <= 0 || remainingMs > barMs) return null;
  return Math.min(4, Math.max(1, Math.ceil(remainingMs / beatDurationMs)));
};
