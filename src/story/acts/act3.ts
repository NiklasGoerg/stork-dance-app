import type { StoryAct } from "~/story/types";
import { act2 } from "~/story/acts/act2";
import { migrationStoryCycleDefinitions as storyCycleDefinitions } from "~/utils/migrationStoryData";

const comparisonCycle = storyCycleDefinitions[1]!;

export const act3 = {
  id: "act-3",
  title: "Act 3 - Comparing African Routes",
  titleKey: "story.acts.act3.title",
  layout: "migration-stage",
  instructorMovementId: "test-dance",
  scenes: [
    {
      id: "standard-cycle",
      title: "The familiar route",
      titleKey: "story.acts.act3.scenes.standardCycle.title",
      narration:
        "Begin with the familiar migration cycle before comparing it to a later African route.",
      narrationKey: "story.acts.act3.scenes.standardCycle.narration",
    },
    {
      id: "comparison-route",
      title: "A later African route",
      titleKey: "story.acts.act3.scenes.easternRoute.title",
      narration: "Follow bird 3339 on the 2016-2017 route to Morocco.",
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
      id: "comparison-route-3339",
      cycleId: comparisonCycle.label,
      cycleStartYear: comparisonCycle.targetYear,
      title: "Bird 3339, 2016-2017",
      titleKey: "story.acts.act3.cycles.eastern",
    },
  ],
  nextActId: "act-4",
} satisfies StoryAct;
