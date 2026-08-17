export type SeasonalCycleSeasonId = "spring" | "summer" | "autumn" | "winter";

export type SeasonalCyclePlaybackState =
  "idle" | "countdown" | "playing" | "previewing" | "paused" | "completed";

export type SeasonalCyclePhase = "preview" | "performance" | "transition";

export type SeasonalCycleMovementDirection = "A" | "B";

export type SeasonalCycleSeasonConfig = {
  id: SeasonalCycleSeasonId;
  label: string;
  labelKey?: string;
  date: string;
  movementUrl: string;
  audioUrl: string;
  movementLoopDurationMs?: number;
  movementPrerollMs?: number;
  configuredMovementId?: string;
  movementIntensity?: number;
  usingFallbackMovement?: boolean;
  movementTiming?: import("~/types/movement").MovementPlaybackTiming;
};

export type SeasonalCycleConfig = {
  seasons: SeasonalCycleSeasonConfig[];
  seasonDurationMs: number;
  barDurationMs: number;
  repetitionCount: number;
  countdownDurationMs?: number;
  movementPrerollMs?: number;
  seasonalAudioEnabled?: boolean;
};

export type SeasonalCycleProgress = {
  elapsedMs: number;
  totalDurationMs: number;
  season: SeasonalCycleSeasonConfig;
  seasonIndex: number;
  seasonElapsedMs: number;
  currentBar: number | null;
  currentBeat: number | null;
  currentRepetition: number | null;
  phase: SeasonalCyclePhase;
  evaluationEnabled: boolean;
  movementDirection: SeasonalCycleMovementDirection | null;
  repetitionIndex: number | null;
  isTransition: boolean;
  isComplete: boolean;
};

export const getSeasonalCycleDurationMs = (config: SeasonalCycleConfig) =>
  config.seasons.length * config.seasonDurationMs;

export const getSeasonalCycleProgress = (
  config: SeasonalCycleConfig,
  elapsedMs: number,
): SeasonalCycleProgress => {
  const totalDurationMs = getSeasonalCycleDurationMs(config);
  const clampedElapsedMs = Math.min(Math.max(elapsedMs, 0), totalDurationMs);
  const isComplete = clampedElapsedMs >= totalDurationMs;
  const seasonIndex = Math.min(
    Math.floor(
      (isComplete ? totalDurationMs - 1 : clampedElapsedMs) /
        config.seasonDurationMs,
    ),
    config.seasons.length - 1,
  );
  const season = config.seasons[seasonIndex] ?? config.seasons[0];
  const seasonElapsedMs = isComplete
    ? config.seasonDurationMs
    : clampedElapsedMs - seasonIndex * config.seasonDurationMs;
  const repetitionWindowMs = config.repetitionCount * config.barDurationMs;
  const isTransition = seasonElapsedMs >= repetitionWindowMs || isComplete;
  const repetitionIndex = isTransition
    ? null
    : Math.min(
        Math.floor(seasonElapsedMs / config.barDurationMs),
        config.repetitionCount - 1,
      );
  const currentBar =
    repetitionIndex === null ? null : Math.min(repetitionIndex + 1, 4);
  const beatDurationMs = config.barDurationMs / 4;
  const barElapsedMs = seasonElapsedMs % config.barDurationMs;
  const currentBeat =
    currentBar === null
      ? null
      : Math.min(Math.floor(barElapsedMs / beatDurationMs) + 1, 4);
  const phase: SeasonalCyclePhase =
    currentBar === null
      ? "transition"
      : currentBar === 1
        ? "preview"
        : "performance";
  const evaluationEnabled = phase === "performance";
  const movementDirection =
    repetitionIndex === null
      ? null
      : repetitionIndex === 0 || repetitionIndex === 1
        ? "A"
        : "B";

  if (!season) {
    throw new Error("Seasonal cycle needs at least one season.");
  }

  return {
    elapsedMs: clampedElapsedMs,
    totalDurationMs,
    season,
    seasonIndex,
    seasonElapsedMs,
    currentBar,
    currentBeat,
    currentRepetition: repetitionIndex,
    phase,
    evaluationEnabled,
    movementDirection,
    repetitionIndex,
    isTransition,
    isComplete,
  };
};
