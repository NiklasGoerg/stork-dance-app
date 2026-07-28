export type SeasonalCycleSeasonId = "spring" | "summer" | "autumn" | "winter";

export type SeasonalCyclePlaybackState =
  | "idle"
  | "countdown"
  | "playing"
  | "paused"
  | "completed";

export type SeasonalCycleSeasonConfig = {
  id: SeasonalCycleSeasonId;
  label: string;
  labelKey?: string;
  date: string;
  movementUrl: string;
  audioUrl: string;
  movementLoopDurationMs?: number;
  movementPrerollMs?: number;
  movementReplayPrerollMs?: number;
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

  if (!season) {
    throw new Error("Seasonal cycle needs at least one season.");
  }

  return {
    elapsedMs: clampedElapsedMs,
    totalDurationMs,
    season,
    seasonIndex,
    seasonElapsedMs,
    repetitionIndex,
    isTransition,
    isComplete,
  };
};
