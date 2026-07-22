import type { StoryAct } from "~/story/types";
import { storyCycleDefinitions } from "~/utils/storkStoryCycles";

export const act4 = {
  id: "act-4",
  title: "Act 4 - Changing Cycles",
  layout: "migration-stage",
  instructorMovementId: "test-dance",
  scenes: storyCycleDefinitions.map((cycle) => ({
    id: cycle.label,
    title: `Cycle ${cycle.step}: ${cycle.targetYear}-${cycle.targetYear + 1}`,
    narration: `Follow the ${cycle.targetYear}-${cycle.targetYear + 1} ${cycle.wintering} migration cycle.`,
  })),
  migrationCycles: storyCycleDefinitions.map((cycle) => ({
    id: cycle.label,
    cycleId: cycle.label,
    cycleStartYear: cycle.targetYear,
    title: `Cycle ${cycle.step}: ${cycle.targetYear}-${cycle.targetYear + 1}`,
  })),
  nextActId: "act-5",
} satisfies StoryAct;
