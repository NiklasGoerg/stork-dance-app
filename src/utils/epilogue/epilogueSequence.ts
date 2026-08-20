import { migrationStoryCycleDefinitions } from "~/utils/migrationStoryData";
import { getStorkRouteColor } from "~/utils/storkRouteColors";

export const EPILOGUE_CUE_PAUSE_MS = 450;
export const EPILOGUE_FINAL_REFLECTION_PAUSE_MS = 2_600;

export const epilogueNarrationCueKeys = [
  "story.acts.epilogue.narration.migrationRecap",
  "story.acts.epilogue.narration.climateContext",
  "story.acts.epilogue.narration.causalLimitation",
  "story.acts.epilogue.narration.otherInfluences",
  "story.acts.epilogue.narration.finalReflection",
] as const;

export const epilogueRouteLegend = migrationStoryCycleDefinitions.map(
  (cycle, index) => ({
    id: cycle.label,
    label: `${cycle.targetYear}-${cycle.targetYear + 1}`,
    color: getStorkRouteColor(index),
  }),
);
