import { computed } from "vue";
import { useAct5Store } from "~/store/act5Store";
import { act5IntroCycleConfig } from "~/story/act5IntroCycle";
import type {
  SeasonalCyclePlaybackState,
  SeasonalCycleSeasonConfig,
} from "~/utils/seasonalCycle";

export const useAct5ControlsModel = ({
  playbackState,
}: {
  playbackState: { value: SeasonalCyclePlaybackState };
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

  return {
    isDebugMode: computed(() => store.debug.enabled),
    isAutoProgressEnabled: computed(() => store.debug.autoProgressEnabled),
    playbackToggleLabel,
    debugSeasonConfigs,
    getDebugSeasonSequenceLabel,
  };
};
