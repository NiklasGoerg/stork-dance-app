import type { StoryAct, StoryMigrationCycle, StoryScene } from "~/story/types";

type TranslationParams = Record<string, string | number>;

export const useStoryTranslations = () => {
  const { t } = useI18n();

  const translate = (
    key: string | undefined,
    fallback: string,
    params?: TranslationParams,
  ) => (key ? t(key, params ?? {}) : fallback);

  const getActTitle = (act: StoryAct) => translate(act.titleKey, act.title);

  const getSceneTitle = (scene: StoryScene) =>
    translate(scene.titleKey, scene.title, scene.titleParams);

  const getSceneNarration = (scene: StoryScene) =>
    scene.narration
      ? translate(scene.narrationKey, scene.narration, scene.narrationParams)
      : "";

  const getMigrationCycleTitle = (cycle: StoryMigrationCycle) =>
    cycle.title
      ? translate(cycle.titleKey, cycle.title, cycle.titleParams)
      : "";

  return {
    t,
    translate,
    getActTitle,
    getSceneTitle,
    getSceneNarration,
    getMigrationCycleTitle,
  };
};
