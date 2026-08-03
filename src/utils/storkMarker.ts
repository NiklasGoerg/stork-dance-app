import type {
  StorkMigrationPhase,
  StorkMarkerVisual,
  StorkStoryCycleDefinition,
} from "~/types/stork";
import {
  formatStoryDate,
  getCycleSegments,
  type StoryDateInput,
} from "~/utils/storyCycle";

export const resolveStorkMarkerVisualForPhase = (
  phase: StorkMigrationPhase,
): StorkMarkerVisual => {
  switch (phase) {
    case "autumn_migration":
      return { kind: "flying", mirrored: true };
    case "winter_rest":
      return { kind: "eating", mirrored: false };
    case "spring_migration":
      return { kind: "flying", mirrored: false };
    case "summer_rest":
      return { kind: "nesting", mirrored: false };
  }
};

export const resolveStorkMarkerVisual = (
  cycle: StorkStoryCycleDefinition,
  date: StoryDateInput,
  cycleStart: StoryDateInput = `${cycle.targetYear}-06-01`,
): StorkMarkerVisual => {
  const formattedDate = formatStoryDate(date);
  const segment = getCycleSegments(cycle, cycleStart).find(
    ({ startDate, endDate }) =>
      formattedDate >= startDate && formattedDate < endDate,
  );

  switch (segment?.type) {
    case "autumnMigration":
      return { kind: "flying", mirrored: true };
    case "winterResidence":
      return { kind: "eating", mirrored: false };
    case "springMigration":
      return { kind: "flying", mirrored: false };
    case "breedingResidence":
    case "postReturnResidence":
    default:
      return { kind: "nesting", mirrored: false };
  }
};
