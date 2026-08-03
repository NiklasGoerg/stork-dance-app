import type { StoryAct, StoryMigrationCycle } from "~/story/types";
import type { MigrationActCycleRun } from "~/types/migrationAct";
import { migrationStoryCycleDefinitions as storyCycleDefinitions } from "~/utils/migrationStoryData";

const getCycleDefinition = (cycleId: string) => {
  const cycle = storyCycleDefinitions.find((item) => item.label === cycleId);

  if (!cycle) {
    throw new Error(`Unknown prepared migration cycle "${cycleId}".`);
  }

  return cycle;
};

const getDefaultCycleTitle = (startYear: number) =>
  `${startYear}/${String(startYear + 1).slice(-2)}`;

export const resolveMigrationActCycleRuns = (
  act: StoryAct,
): MigrationActCycleRun[] => {
  const configuredCycles: StoryMigrationCycle[] = act.migrationCycles?.length
    ? act.migrationCycles
    : act.cycleId
      ? Array.from({ length: act.repeatCount ?? 1 }, (_, index) => ({
          id: `${act.cycleId}-${index + 1}`,
          cycleId: act.cycleId!,
          cycleStartYear: act.cycleStartYear,
        }))
      : [];

  if (!configuredCycles.length) {
    throw new Error(`${act.title} has no migration cycles configured.`);
  }

  return configuredCycles.map((cycle, index) => {
    const definition = getCycleDefinition(cycle.cycleId);
    const cycleStartYear = cycle.cycleStartYear ?? definition.targetYear;

    return {
      id: `${act.id}:${cycle.id}:${index}`,
      cycleId: cycle.cycleId,
      cycleStartYear,
      title: cycle.title ?? getDefaultCycleTitle(cycleStartYear),
      titleKey: cycle.titleKey,
      titleParams: cycle.titleParams,
    };
  });
};

export const getMigrationCycleButtonLabel = (cycle: MigrationActCycleRun) =>
  getDefaultCycleTitle(cycle.cycleStartYear);
