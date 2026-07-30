import { computed } from "vue";
import { useAct5Store } from "~/store/act5Store";
import {
  ACT5_PERIOD_TRANSITION_THEME,
  ACT5_SEASON_THEMES,
} from "~/features/act5/domain/sequence";
import type { SeasonalCycleSeasonConfig } from "~/utils/seasonalCycle";

export const useAct5SeasonTheme = ({
  currentSeason,
}: {
  currentSeason: { value: SeasonalCycleSeasonConfig };
}) => {
  const store = useAct5Store();

  const currentSeasonTheme = computed(() => {
    if (store.sequenceStatus === "periodTransition") {
      return ACT5_PERIOD_TRANSITION_THEME;
    }

    const season = store.currentSeason ?? currentSeason.value.id;

    return ACT5_SEASON_THEMES[season];
  });

  const climateActThemeStyle = computed(() => ({
    "--act5-season-background": currentSeasonTheme.value.background,
    "--act5-season-surface": currentSeasonTheme.value.surface,
  }));

  return {
    currentSeasonTheme,
    climateActThemeStyle,
  };
};
