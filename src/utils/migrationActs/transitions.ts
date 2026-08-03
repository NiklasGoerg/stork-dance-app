import type { MigrationActEvent } from "~/types/migrationAct";
import type { StoryTimelineDay } from "~/utils/storyCycle";
import { getCrossedMigrationActEvents } from "~/utils/migrationActs/events";
import { clampMigrationElapsedMs } from "~/utils/migrationActs/timeline";

export type MigrationPlaybackAdvance = {
  elapsedMs: number;
  detectedElapsedMs: number;
  crossedEvent: MigrationActEvent | null;
  completed: boolean;
};

export const getMigrationPlaybackAdvance = ({
  timeline,
  events,
  previousElapsedMs,
  deltaMs,
}: {
  timeline: StoryTimelineDay[];
  events: MigrationActEvent[];
  previousElapsedMs: number;
  deltaMs: number;
}): MigrationPlaybackAdvance => {
  const detectedElapsedMs = clampMigrationElapsedMs(
    timeline,
    previousElapsedMs + Math.max(0, deltaMs),
  );
  const crossedEvent =
    getCrossedMigrationActEvents(
      events,
      previousElapsedMs,
      detectedElapsedMs,
    )[0] ?? null;
  const elapsedMs = crossedEvent?.boundaryTimeMs ?? detectedElapsedMs;
  const durationMs = timeline.at(-1)?.endMs ?? 0;

  return {
    elapsedMs,
    detectedElapsedMs,
    crossedEvent,
    completed: !crossedEvent && elapsedMs >= durationMs,
  };
};
