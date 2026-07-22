import type { StoryAct } from "~/story/types";
import { act2 } from "~/story/acts/act2";
import { act3EasternRouteCycleDefinition } from "~/utils/storkStoryCycles";

export const act3 = {
  id: "act-3",
  title: "Act 3 - Western and Eastern Routes",
  layout: "migration-stage",
  instructorMovementId: "test-dance",
  scenes: [
    {
      id: "standard-cycle",
      title: "The familiar route",
      narration:
        "Begin with the standard migration cycle before comparing it to an eastern route.",
    },
    {
      id: "eastern-route",
      title: "The eastern route",
      narration:
        "Follow bird 7347 along its eastern migration into central Africa.",
    },
  ],
  migrationCycles: [
    {
      id: "standard-cycle",
      cycleId: act2.cycleId,
      cycleStartYear: act2.cycleStartYear,
      title: "Standard cycle",
    },
    {
      id: "eastern-route-7347",
      cycleId: act3EasternRouteCycleDefinition.label,
      cycleStartYear: act3EasternRouteCycleDefinition.targetYear,
      title: "Bird 7347, 2020-2021",
      storyCycleDefinitions: [act3EasternRouteCycleDefinition],
    },
  ],
  nextActId: "act-4",
} satisfies StoryAct;
