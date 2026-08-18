import type {
  MigrationActMapFrame,
  MigrationActRuntimeSnapshot,
} from "~/types/migrationAct";
import type { StorkDataPoint } from "~/types/stork";
import type { StoryTimelineDay } from "~/utils/storyCycle";

export const clampMigrationElapsedMs = (
  timeline: StoryTimelineDay[],
  elapsedMs: number,
) => {
  const durationMs = timeline.at(-1)?.endMs ?? 0;

  return Math.min(
    Math.max(Number.isFinite(elapsedMs) ? elapsedMs : 0, 0),
    durationMs,
  );
};

export const getMigrationTimelineDayAtElapsedMs = (
  timeline: StoryTimelineDay[],
  elapsedMs: number,
) => {
  const firstDay = timeline[0];
  const lastDay = timeline.at(-1);

  if (!firstDay || !lastDay) return null;

  const clampedElapsedMs = clampMigrationElapsedMs(timeline, elapsedMs);
  if (clampedElapsedMs >= lastDay.endMs) return lastDay;

  let low = 0;
  let high = timeline.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const day = timeline[middle];

    if (!day) break;
    if (clampedElapsedMs < day.startMs) {
      high = middle - 1;
    } else if (clampedElapsedMs >= day.endMs) {
      low = middle + 1;
    } else {
      return day;
    }
  }

  return lastDay;
};

export const getMigrationRuntimeSnapshot = (
  timeline: StoryTimelineDay[],
  elapsedMs: number,
): MigrationActRuntimeSnapshot => {
  const timelineDay = getMigrationTimelineDayAtElapsedMs(timeline, elapsedMs);

  if (!timelineDay) {
    throw new Error("Migration runtime requires a prepared timeline.");
  }

  return {
    elapsedMs: clampMigrationElapsedMs(timeline, elapsedMs),
    date: timelineDay.date,
    timelineDay,
    phase: timelineDay.phase,
  };
};

export const getMigrationMapFrame = (
  cycleId: string,
  timeline: StoryTimelineDay[],
  points: StorkDataPoint[],
  elapsedMs: number,
): MigrationActMapFrame | null => {
  const day = getMigrationTimelineDayAtElapsedMs(timeline, elapsedMs);
  const point = day ? points[day.relativeDay] : null;

  if (!day || !point || point.story?.cycleId !== cycleId) return null;

  return {
    cycleId,
    date: point.date,
    phase: day.phase,
    event: day.event,
    markerLatLng: {
      lat: point.lat,
      lng: point.lng,
    },
    cameraReady: true,
  };
};
