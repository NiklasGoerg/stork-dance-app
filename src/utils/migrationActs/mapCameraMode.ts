import type {
  MigrationMapCameraMode,
  ResolvedMigrationMovement,
} from "~/types/migrationAct";
import type { StoryGestureId } from "~/story/gestures";
import type { StorkMigrationEvent, StorkMigrationPhase } from "~/types/stork";

export const getMigrationMapCameraModeForMovement = (
  movement: Pick<ResolvedMigrationMovement, "movementType"> | null | undefined,
): MigrationMapCameraMode =>
  movement?.movementType === "migration" ? "migration" : "residence";

export const getMigrationMapCameraModeForPhase = (
  phase: StorkMigrationPhase | null | undefined,
): MigrationMapCameraMode =>
  phase === "autumn_migration" || phase === "spring_migration"
    ? "migration"
    : "residence";

export const getMigrationMapCameraModeForGesture = (
  gestureId: StoryGestureId | null | undefined,
): MigrationMapCameraMode =>
  gestureId === "departure" || gestureId === "arrival"
    ? "migration"
    : "residence";

export const getMigrationMapCameraModeForEvent = (
  eventType: StorkMigrationEvent | null | undefined,
): MigrationMapCameraMode =>
  eventType === "autumn_departure" ||
  eventType === "autumn_arrival" ||
  eventType === "spring_departure" ||
  eventType === "spring_arrival"
    ? "migration"
    : "residence";
