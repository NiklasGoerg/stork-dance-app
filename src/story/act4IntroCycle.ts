import type { ClimateSeason } from "~/types/climate";
import type { MovementPlaybackTiming } from "~/types/movement";
import type {
  SeasonalCycleConfig,
  SeasonalCycleSeasonConfig,
} from "~/utils/seasonalCycle";
import { SEASON_THEME_CONFIG } from "~/utils/seasonAudio/config";

// Every complete seasonal take has one lead-in beat, two movement bars and an
// optional export tail. Only the two movement bars are repeated.
export const ACT4_MOVEMENT_TIMING_DEFAULTS: MovementPlaybackTiming = {
  sourceFps: 30,
  prerollMs: 1_000,
  loopStartMs: 1_000,
  loopEndMs: 9_000,
};

const seasonMetadata: Record<
  ClimateSeason,
  Pick<SeasonalCycleSeasonConfig, "label" | "labelKey" | "date" | "audioUrl">
> = {
  winter: {
    label: "Winter",
    labelKey: "seasonClock.seasons.winter",
    date: "2023-12-01",
    audioUrl: SEASON_THEME_CONFIG.winter.url,
  },
  spring: {
    label: "Spring",
    labelKey: "seasonClock.seasons.spring",
    date: "2023-03-01",
    audioUrl: SEASON_THEME_CONFIG.spring.url,
  },
  summer: {
    label: "Summer",
    labelKey: "seasonClock.seasons.summer",
    date: "2023-06-01",
    audioUrl: SEASON_THEME_CONFIG.summer.url,
  },
  autumn: {
    label: "Autumn",
    labelKey: "seasonClock.seasons.autumn",
    date: "2023-09-01",
    audioUrl: SEASON_THEME_CONFIG.autumn.url,
  },
};

const createMovementConfig = (
  season: ClimateSeason,
  movementIntensity: number,
  configuredMovementId: string,
  movementUrl: string,
): SeasonalCycleSeasonConfig => ({
  id: season,
  ...seasonMetadata[season],
  movementUrl,
  configuredMovementId,
  movementIntensity,
  usingFallbackMovement: false,
  movementTiming: ACT4_MOVEMENT_TIMING_DEFAULTS,
  movementLoopDurationMs: 8_000,
  movementPrerollMs: ACT4_MOVEMENT_TIMING_DEFAULTS.prerollMs,
});

export const act4SeasonMovementConfig = {
  winter: {
    100: createMovementConfig(
      "winter",
      100,
      "winter-100-percent",
      new URL(
        "../assets/movement_library/seasons/winter-100-percent.json",
        import.meta.url,
      ).href,
    ),
    50: createMovementConfig(
      "winter",
      50,
      "winter-50-percent",
      new URL(
        "../assets/movement_library/seasons/winter-50-percent.json",
        import.meta.url,
      ).href,
    ),
    20: createMovementConfig(
      "winter",
      20,
      "winter-20-percent",
      new URL(
        "../assets/movement_library/seasons/winter-20-percent.json",
        import.meta.url,
      ).href,
    ),
    [-10]: createMovementConfig(
      "winter",
      -10,
      "winter--10-percent",
      new URL(
        "../assets/movement_library/seasons/winter--10-percent.json",
        import.meta.url,
      ).href,
    ),
  },
  spring: {
    100: createMovementConfig(
      "spring",
      100,
      "spring-100-percent",
      new URL(
        "../assets/movement_library/seasons/spring-100-percent.json",
        import.meta.url,
      ).href,
    ),
    40: createMovementConfig(
      "spring",
      40,
      "spring-40-percent",
      new URL(
        "../assets/movement_library/seasons/spring-40-percent.json",
        import.meta.url,
      ).href,
    ),
    30: createMovementConfig(
      "spring",
      30,
      "spring-30-percent",
      new URL(
        "../assets/movement_library/seasons/spring-30-percent.json",
        import.meta.url,
      ).href,
    ),
    20: createMovementConfig(
      "spring",
      20,
      "spring-20-percent",
      new URL(
        "../assets/movement_library/seasons/spring-20-percent.json",
        import.meta.url,
      ).href,
    ),
  },
  summer: {
    100: createMovementConfig(
      "summer",
      100,
      "summer-100-percent",
      new URL(
        "../assets/movement_library/seasons/summer-100-percent.json",
        import.meta.url,
      ).href,
    ),
    60: createMovementConfig(
      "summer",
      60,
      "summer-60-percent",
      new URL(
        "../assets/movement_library/seasons/summer-60-percent.json",
        import.meta.url,
      ).href,
    ),
    30: createMovementConfig(
      "summer",
      30,
      "summer-30-percent",
      new URL(
        "../assets/movement_library/seasons/summer-30-percent.json",
        import.meta.url,
      ).href,
    ),
    10: createMovementConfig(
      "summer",
      10,
      "summer-10-percent",
      new URL(
        "../assets/movement_library/seasons/summer-10-percent.json",
        import.meta.url,
      ).href,
    ),
  },
  autumn: {
    100: createMovementConfig(
      "autumn",
      100,
      "autumn-100-percent",
      new URL(
        "../assets/movement_library/seasons/autumn-100-percent.json",
        import.meta.url,
      ).href,
    ),
    80: createMovementConfig(
      "autumn",
      80,
      "autumn-80-percent",
      new URL(
        "../assets/movement_library/seasons/autumn-80-percent.json",
        import.meta.url,
      ).href,
    ),
    50: createMovementConfig(
      "autumn",
      50,
      "autumn-50-percent",
      new URL(
        "../assets/movement_library/seasons/autumn-50-percent.json",
        import.meta.url,
      ).href,
    ),
    40: createMovementConfig(
      "autumn",
      40,
      "autumn-40-percent",
      new URL(
        "../assets/movement_library/seasons/autumn-40-percent.json",
        import.meta.url,
      ).href,
    ),
    25: createMovementConfig(
      "autumn",
      25,
      "autumn-25-percent",
      new URL(
        "../assets/movement_library/seasons/autumn-25-percent.json",
        import.meta.url,
      ).href,
    ),
  },
} as const;

export const resolveAct4SeasonMovementConfig = (
  season: ClimateSeason,
  movementIntensity: number,
): SeasonalCycleSeasonConfig | null => {
  const seasonConfig = act4SeasonMovementConfig[season] as Record<
    number,
    SeasonalCycleSeasonConfig | undefined
  >;

  return seasonConfig[movementIntensity] ?? null;
};

export const act4IntroCycleConfig = {
  seasonDurationMs: 16_000,
  barDurationMs: 4_000,
  repetitionCount: 4,
  countdownDurationMs: 4_000,
  movementPrerollMs: ACT4_MOVEMENT_TIMING_DEFAULTS.prerollMs,
  seasons: [
    act4SeasonMovementConfig.winter[100],
    act4SeasonMovementConfig.spring[100],
    act4SeasonMovementConfig.summer[100],
    act4SeasonMovementConfig.autumn[100],
  ],
} satisfies SeasonalCycleConfig;
