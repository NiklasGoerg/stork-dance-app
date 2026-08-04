import { getMigrationGestureMovementDefinition } from "~/utils/migrationActs/migrationMovementDefinitions";

export type StoryGestureId = "departure" | "arrival";

export type GestureInteractionState =
  | "inactive"
  | "loading-movement"
  | "waiting-for-lead-in"
  | "attempt-playing"
  | "retry-scheduled"
  | "success-exit"
  | "completed"
  | "cancelled";

export type StoryGestureDefinition = {
  id: StoryGestureId;
  label: string;
  labelKey: string;
  movementId: string;
};

export const getStoryGestureDefinition = (
  id: StoryGestureId,
): StoryGestureDefinition => ({
  id,
  label: id === "departure" ? "Departure" : "Arrival",
  labelKey: `gestures.${id}.label`,
  movementId: getMigrationGestureMovementDefinition(id).movementId,
});
