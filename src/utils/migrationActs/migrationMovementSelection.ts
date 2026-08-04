import type {
  MigrationMovementDirection,
  MigrationMovementSpeed,
  ResolvedMigrationMovement,
} from "~/types/migrationAct";
import type { StorkMigrationPhase } from "~/types/stork";
import type { StoryTimelineDay } from "~/utils/storyCycle";
import {
  MIGRATION_MOVEMENT_SPEED_THRESHOLDS_MS,
  migrationMovementConfig,
} from "~/utils/migrationActs/migrationMovementConfig";

export type MigrationMovementPhaseTiming = {
  startMs: number;
  endMs: number;
  durationMs: number;
};

export const classifyMigrationMovementSpeed = (
  phaseDurationMs: number,
): MigrationMovementSpeed => {
  if (phaseDurationMs <= MIGRATION_MOVEMENT_SPEED_THRESHOLDS_MS.fastMaxMs) {
    return "fast";
  }

  if (phaseDurationMs <= MIGRATION_MOVEMENT_SPEED_THRESHOLDS_MS.mediumMaxMs) {
    return "medium";
  }

  return "slow";
};

export const getMigrationMovementDirection = (
  phase: StorkMigrationPhase,
): MigrationMovementDirection => {
  if (phase === "autumn_migration") return "outbound";
  if (phase === "spring_migration") return "return";

  return "stationary";
};

export const getMigrationMovementPhaseTiming = (
  timeline: StoryTimelineDay[],
  currentDay: StoryTimelineDay | null,
): MigrationMovementPhaseTiming | null => {
  if (!currentDay) return null;

  const currentIndex = timeline.findIndex(
    (day) =>
      day.relativeDay === currentDay.relativeDay &&
      day.date === currentDay.date,
  );

  if (currentIndex < 0) return null;

  let firstIndex = currentIndex;
  let lastIndex = currentIndex;

  while (
    firstIndex > 0 &&
    timeline[firstIndex - 1]?.phase === currentDay.phase
  ) {
    firstIndex--;
  }

  while (
    lastIndex < timeline.length - 1 &&
    timeline[lastIndex + 1]?.phase === currentDay.phase
  ) {
    lastIndex++;
  }

  const firstDay = timeline[firstIndex];
  const lastDay = timeline[lastIndex];

  if (!firstDay || !lastDay) return null;

  return {
    startMs: firstDay.startMs,
    endMs: lastDay.endMs,
    durationMs: lastDay.endMs - firstDay.startMs,
  };
};

export const resolveMigrationMovement = ({
  phase,
  direction = getMigrationMovementDirection(phase),
  phaseDurationMs,
  targetRegion = null,
}: {
  phase: StorkMigrationPhase;
  direction?: MigrationMovementDirection;
  phaseDurationMs: number;
  targetRegion?: string | null;
}): ResolvedMigrationMovement => {
  if (phase === "summer_rest" || phase === "winter_rest") {
    const slot =
      phase === "summer_rest"
        ? migrationMovementConfig.summerRest
        : migrationMovementConfig.winterRest;

    return {
      ...slot,
      movementType: "rest",
      speedClass: null,
      direction: "stationary",
      targetRegion,
    };
  }

  const speedClass = classifyMigrationMovementSpeed(phaseDurationMs);
  const resolvedDirection =
    phase === "autumn_migration" ? "outbound" : "return";
  const slot = migrationMovementConfig[resolvedDirection][speedClass];

  return {
    ...slot,
    movementType: "migration",
    speedClass,
    direction: direction === resolvedDirection ? direction : resolvedDirection,
    targetRegion,
  };
};
