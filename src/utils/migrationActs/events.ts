import type {
  MigrationActCycleRun,
  MigrationActEvent,
  MigrationActEventStatus,
} from "~/types/migrationAct";
import type { StorkMigrationEvent } from "~/types/stork";
import type { StoryGestureId } from "~/story/gestures";
import type { StoryTimelineDay } from "~/utils/storyCycle";

const gestureByEvent: Record<StorkMigrationEvent, StoryGestureId> = {
  autumn_departure: "departure",
  autumn_arrival: "arrival",
  spring_departure: "departure",
  spring_arrival: "arrival",
};

export const createMigrationActEvents = (
  cycleRun: MigrationActCycleRun,
  timeline: StoryTimelineDay[],
): MigrationActEvent[] =>
  timeline.flatMap((day) => {
    if (!day.event) return [];

    return [
      {
        id: `${cycleRun.id}:${day.event}`,
        cycleRunId: cycleRun.id,
        cycleId: cycleRun.cycleId,
        eventType: day.event,
        gestureId: gestureByEvent[day.event],
        boundaryDate: day.date,
        boundaryTimeMs: day.startMs,
        status: "pending" as const,
      },
    ];
  });

export const getCrossedMigrationActEvents = (
  events: MigrationActEvent[],
  previousElapsedMs: number,
  currentElapsedMs: number,
) =>
  events
    .filter(
      (event) =>
        event.status === "pending" &&
        previousElapsedMs < event.boundaryTimeMs &&
        currentElapsedMs >= event.boundaryTimeMs,
    )
    .sort((first, second) => first.boundaryTimeMs - second.boundaryTimeMs);

export const reconcileMigrationActEventsForSeek = (
  events: MigrationActEvent[],
  elapsedMs: number,
): MigrationActEvent[] =>
  events.map((event) => ({
    ...event,
    status: (event.boundaryTimeMs <= elapsedMs
      ? "skipped"
      : "pending") as MigrationActEventStatus,
  }));
