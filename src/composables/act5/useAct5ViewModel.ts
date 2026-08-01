import { computed } from "vue";
import { useAct5Store } from "~/store/act5";
import { act5IntroCycleConfig } from "~/story/act5IntroCycle";
import {
  ACT5_PERIOD_TRANSITION_THEME,
  ACT5_SEASON_THEMES,
} from "~/utils/act5/sequence";
import type {
  SeasonalCyclePlaybackState,
  SeasonalCycleSeasonConfig,
} from "~/utils/seasonalCycle";

export const useAct5ViewModel = ({
  playbackState,
  currentSeason,
}: {
  playbackState: { value: SeasonalCyclePlaybackState };
  currentSeason: { value: SeasonalCycleSeasonConfig };
}) => {
  const store = useAct5Store();
  const { t } = useStoryTranslations();

  const playbackToggleLabel = computed(() =>
    playbackState.value === "playing" || playbackState.value === "countdown"
      ? t("story.acts.act5.controls.pause")
      : t("story.acts.act5.controls.play"),
  );
  const debugSeasonConfigs = computed<SeasonalCycleSeasonConfig[]>(() =>
    store.debug.enabled ? act5IntroCycleConfig.seasons : [],
  );
  const getDebugSeasonSequenceLabel = (
    seasonId: SeasonalCycleSeasonConfig["id"],
  ) => {
    if (seasonId === "winter") {
      return t("story.acts.act5.debug.startWinterSequence");
    }
    if (seasonId === "spring") {
      return t("story.acts.act5.debug.startSpringSequence");
    }
    if (seasonId === "summer") {
      return t("story.acts.act5.debug.startSummerSequence");
    }

    return t("story.acts.act5.debug.startAutumnSequence");
  };
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
    isDebugMode: computed(() => store.debug.enabled),
    isAutoProgressEnabled: computed(() => store.debug.autoProgressEnabled),
    playbackToggleLabel,
    debugSeasonConfigs,
    getDebugSeasonSequenceLabel,
    currentSeasonTheme,
    climateActThemeStyle,
  };
};
