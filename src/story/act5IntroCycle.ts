import type { SeasonalCycleConfig } from "~/utils/seasonalCycle";

export const act5IntroCycleConfig = {
  seasonDurationMs: 16_000,
  barDurationMs: 4_000,
  repetitionCount: 3,
  countdownDurationMs: 4_000,
  movementPrerollMs: 1_000,
  seasons: [
    {
      id: "spring",
      label: "Spring",
      labelKey: "seasonClock.seasons.spring",
      date: "2023-03-01",
      movementUrl: new URL(
        "../assets/movement_library/seasons/spring-100-percent.json",
        import.meta.url,
      ).href,
      audioUrl: new URL("../assets/audio/music/spring.wav", import.meta.url)
        .href,
    },
    {
      id: "summer",
      label: "Summer",
      labelKey: "seasonClock.seasons.summer",
      date: "2023-06-01",
      movementUrl: new URL(
        "../assets/movement_library/seasons/summer-100-percent.json",
        import.meta.url,
      ).href,
      audioUrl: new URL("../assets/audio/music/summer.wav", import.meta.url)
        .href,
    },
    {
      id: "autumn",
      label: "Autumn",
      labelKey: "seasonClock.seasons.autumn",
      date: "2023-09-01",
      movementUrl: new URL(
        "../assets/movement_library/seasons/autumn-100-percent.json",
        import.meta.url,
      ).href,
      audioUrl: new URL("../assets/audio/music/autumn.wav", import.meta.url)
        .href,
    },
    {
      id: "winter",
      label: "Winter",
      labelKey: "seasonClock.seasons.winter",
      date: "2023-12-01",
      movementUrl: new URL(
        "../assets/movement_library/seasons/winter-100-percent.json",
        import.meta.url,
      ).href,
      audioUrl: new URL("../assets/audio/music/winter.wav", import.meta.url)
        .href,
    },
  ],
} satisfies SeasonalCycleConfig;
