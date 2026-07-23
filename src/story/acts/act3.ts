import type { StoryAct } from "~/story/types";
import { act2 } from "~/story/acts/act2";
import { act3EasternRouteCycleDefinition } from "~/utils/storkStoryCycles";

export const act3 = {
  id: "act-3",
  title: "Act 3 - Western and Eastern Routes",
  titleKey: "story.acts.act3.title",
  layout: "migration-stage",
  instructorMovementId: "test-dance",
  scenes: [
    {
      id: "standard-cycle",
      title: "The familiar route",
      titleKey: "story.acts.act3.scenes.standardCycle.title",
      narration:
        "Begin with the standard migration cycle before comparing it to an eastern route.",
      narrationKey: "story.acts.act3.scenes.standardCycle.narration",
    },
    {
      id: "eastern-route",
      title: "The eastern route",
      titleKey: "story.acts.act3.scenes.easternRoute.title",
      narration:
        "Follow bird 7347 along its eastern migration into central Africa.",
      narrationKey: "story.acts.act3.scenes.easternRoute.narration",
    },
  ],
  migrationCycles: [
    {
      id: "standard-cycle",
      cycleId: act2.cycleId,
      cycleStartYear: act2.cycleStartYear,
      title: "Standard cycle",
      titleKey: "story.acts.act3.cycles.standard",
    },
    {
      id: "eastern-route-7347",
      cycleId: act3EasternRouteCycleDefinition.label,
      cycleStartYear: act3EasternRouteCycleDefinition.targetYear,
      title: "Bird 7347, 2020-2021",
      titleKey: "story.acts.act3.cycles.eastern",
      storyCycleDefinitions: [act3EasternRouteCycleDefinition],
    },
  ],
  nextActId: "act-4",
} satisfies StoryAct;
