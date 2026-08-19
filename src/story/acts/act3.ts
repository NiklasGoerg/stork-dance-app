import type { StoryAct } from "~/story/types";
import { migrationStoryCycleDefinitions as storyCycleDefinitions } from "~/utils/migrationStoryData";

export const act3 = {
  id: "act-3",
  title: "Act 3 - Changing Cycles",
  titleKey: "story.acts.act3.title",
  layout: "migration-stage",
  instructorMovementId: "test-dance",
  scenes: storyCycleDefinitions.map((cycle) => ({
    id: cycle.label,
    title: `Cycle ${cycle.step}: ${cycle.targetYear}-${cycle.targetYear + 1}`,
    titleKey: "story.acts.act3.cycleTitle",
    narration: `Follow the ${cycle.targetYear}-${cycle.targetYear + 1} ${cycle.wintering} migration cycle.`,
    narrationKey: "story.acts.act3.cycleNarration",
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
    titleKey: "story.acts.act3.cycleTitle",
    titleParams: {
      step: cycle.step,
      startYear: cycle.targetYear,
      endYear: cycle.targetYear + 1,
    },
  })),
  nextActId: "act-4",
} satisfies StoryAct;
