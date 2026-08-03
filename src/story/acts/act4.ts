import type { StoryAct } from "~/story/types";
import { migrationStoryCycleDefinitions as storyCycleDefinitions } from "~/utils/migrationStoryData";

export const act4 = {
  id: "act-4",
  title: "Act 4 - Changing Cycles",
  titleKey: "story.acts.act4.title",
  layout: "migration-stage",
  instructorMovementId: "test-dance",
  scenes: storyCycleDefinitions.map((cycle) => ({
    id: cycle.label,
    title: `Cycle ${cycle.step}: ${cycle.targetYear}-${cycle.targetYear + 1}`,
    titleKey: "story.acts.act4.cycleTitle",
    narration: `Follow the ${cycle.targetYear}-${cycle.targetYear + 1} ${cycle.wintering} migration cycle.`,
    narrationKey: "story.acts.act4.cycleNarration",
    titleParams: {
      step: cycle.step,
      startYear: cycle.targetYear,
      endYear: cycle.targetYear + 1,
    },
    narrationParams: {
      startYear: cycle.targetYear,
      endYear: cycle.targetYear + 1,
      wintering: cycle.wintering,
    },
  })),
  migrationCycles: storyCycleDefinitions.map((cycle) => ({
    id: cycle.label,
    cycleId: cycle.label,
    cycleStartYear: cycle.targetYear,
    title: `Cycle ${cycle.step}: ${cycle.targetYear}-${cycle.targetYear + 1}`,
    titleKey: "story.acts.act4.cycleTitle",
    titleParams: {
      step: cycle.step,
      startYear: cycle.targetYear,
      endYear: cycle.targetYear + 1,
    },
  })),
  nextActId: "act-5",
} satisfies StoryAct;
