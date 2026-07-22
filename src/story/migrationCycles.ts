import type { StorkStoryCycleDefinition } from "~/types/stork";
import type { StoryAct, StoryMigrationCycle } from "~/story/types";
import { storyCycleDefinitions } from "~/utils/storkStoryCycles";
import { STORY_CYCLE_DURATION_MS } from "~/utils/storyCycle";

export const getMigrationCycleDefinitions = (
  cycle: StoryMigrationCycle | null | undefined,
) => {
  const definitions = [...storyCycleDefinitions];

  for (const definition of cycle?.storyCycleDefinitions ?? []) {
    if (definitions.some((known) => known.label === definition.label)) continue;

    definitions.push(definition);
  }

  return definitions;
};

export const findMigrationCycleDefinition = (
  cycle: StoryMigrationCycle,
): StorkStoryCycleDefinition | undefined =>
  getMigrationCycleDefinitions(cycle).find(
    (definition) => definition.label === cycle.cycleId,
  );

export const resolveMigrationActCycles = (
  act: StoryAct,
): StoryMigrationCycle[] => {
  if (act.migrationCycles?.length) return act.migrationCycles;
  if (!act.cycleId) return [];

  const repeatCount = act.repeatCount ?? 1;

  return Array.from({ length: repeatCount }, (_, index) => ({
    id: `${act.cycleId}-${index + 1}`,
    cycleId: act.cycleId,
    cycleStartYear: act.cycleStartYear,
    cycleDurationMs: act.cycleDurationMs ?? STORY_CYCLE_DURATION_MS,
  }));
};
