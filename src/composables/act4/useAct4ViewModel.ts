import { computed } from "vue";
import { useAct4Store } from "~/store/act4";
import { act4IntroCycleConfig } from "~/story/act4IntroCycle";
import {
  ACT4_PERIOD_TRANSITION_THEME,
  ACT4_SEASON_THEMES,
} from "~/utils/act4/sequence";
import type {
  SeasonalCyclePlaybackState,
  SeasonalCycleSeasonConfig,
} from "~/utils/seasonalCycle";

export const useAct4ViewModel = ({
  playbackState,
  currentSeason,
}: {
  playbackState: { value: SeasonalCyclePlaybackState };
  currentSeason: { value: SeasonalCycleSeasonConfig };
}) => {
  const store = useAct4Store();
  const { t } = useStoryTranslations();

  const playbackToggleLabel = computed(() =>
    playbackState.value === "playing" || playbackState.value === "countdown"
      ? t("story.acts.act4.controls.pause")
      : t("story.acts.act4.controls.play"),
  );
  const debugSeasonConfigs = computed<SeasonalCycleSeasonConfig[]>(() =>
    store.debug.enabled ? act4IntroCycleConfig.seasons : [],
  );
  const getDebugSeasonSequenceLabel = (
    seasonId: SeasonalCycleSeasonConfig["id"],
  ) => {
    if (seasonId === "winter") {
      return t("story.acts.act4.debug.startWinterSequence");
    }
    if (seasonId === "spring") {
      return t("story.acts.act4.debug.startSpringSequence");
    }
    if (seasonId === "summer") {
      return t("story.acts.act4.debug.startSummerSequence");
    }

    return t("story.acts.act4.debug.startAutumnSequence");
  };
  const currentSeasonTheme = computed(() => {
    if (store.sequenceStatus === "periodTransition") {
      return ACT4_PERIOD_TRANSITION_THEME;
    }

    const season = store.currentSeason ?? currentSeason.value.id;

    return ACT4_SEASON_THEMES[season];
  });
  const climateActThemeStyle = computed(() => ({
    "--act4-season-background": currentSeasonTheme.value.background,
    "--act4-season-surface": currentSeasonTheme.value.surface,
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
