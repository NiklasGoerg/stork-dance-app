import type { StoryGestureId } from "~/story/gestures";
import type { StorkStoryCycleDefinition } from "~/types/stork";
import {
  formatStoryDate,
  getCycleSegments,
  getNextStoryCycleStart,
  getWeightedStoryTimelineElapsedMsForDate,
  type StoryDateInput,
  type StoryWeightedTimelineDay,
} from "~/utils/storyCycle";

export type StoryGestureMigration = "autumn" | "spring";
export type StoryGestureEventStatus =
  "pending" | "active" | "completed" | "skipped";

export type StoryGestureEvent = {
  id: string;
  cycleId: string;
  type: StoryGestureId;
  migration: StoryGestureMigration;
  boundaryTimeMs: number;
  boundaryDate: string;
  status: StoryGestureEventStatus;
};

const createEvent = ({
  cycle,
  timeline,
  migration,
  type,
  boundaryDate,
  cycleEndDate,
}: {
  cycle: StorkStoryCycleDefinition;
  timeline: StoryWeightedTimelineDay[];
  migration: StoryGestureMigration;
  type: StoryGestureId;
  boundaryDate: string;
  cycleEndDate: string;
}): StoryGestureEvent => ({
  id: `${cycle.label}:${migration}:${type}`,
  cycleId: cycle.label,
  type,
  migration,
  boundaryTimeMs:
    boundaryDate === cycleEndDate
      ? (timeline[timeline.length - 1]?.endMs ?? 0)
      : getWeightedStoryTimelineElapsedMsForDate(timeline, boundaryDate),
  boundaryDate,
  status: "pending",
});

// Builds the gesture checkpoints from curated cycle segments, not from fixed dates.
export const createStoryGestureEvents = (
  cycle: StorkStoryCycleDefinition,
  timeline: StoryWeightedTimelineDay[],
  cycleStart: StoryDateInput,
): StoryGestureEvent[] => {
  const segments = getCycleSegments(cycle, cycleStart);
  const cycleEndDate = formatStoryDate(getNextStoryCycleStart(cycleStart));
  const autumnMigration = segments.find(
    (segment) => segment.type === "autumnMigration",
  );
  const springMigration = segments.find(
    (segment) => segment.type === "springMigration",
  );

  return [
    autumnMigration
      ? createEvent({
          cycle,
          timeline,
          migration: "autumn",
          type: "departure",
          boundaryDate: autumnMigration.startDate,
          cycleEndDate,
        })
      : null,
    autumnMigration
      ? createEvent({
          cycle,
          timeline,
          migration: "autumn",
          type: "arrival",
          boundaryDate: autumnMigration.endDate,
          cycleEndDate,
        })
      : null,
    springMigration
      ? createEvent({
          cycle,
          timeline,
          migration: "spring",
          type: "departure",
          boundaryDate: springMigration.startDate,
          cycleEndDate,
        })
      : null,
    springMigration
      ? createEvent({
          cycle,
          timeline,
          migration: "spring",
          type: "arrival",
          boundaryDate: springMigration.endDate,
          cycleEndDate,
        })
      : null,
  ]
    .filter((event): event is StoryGestureEvent => Boolean(event))
    .sort((first, second) => first.boundaryTimeMs - second.boundaryTimeMs);
};

export const formatStoryGestureEventLabel = (event: StoryGestureEvent) =>
  `${event.migration} ${event.type}`;

export const getStoryGestureEventLabelParams = (event: StoryGestureEvent) => ({
  migrationKey:
    event.migration === "autumn"
      ? "gestures.events.autumn"
      : "gestures.events.spring",
  typeKey:
    event.type === "departure"
      ? "gestures.events.departure"
      : "gestures.events.arrival",
});
