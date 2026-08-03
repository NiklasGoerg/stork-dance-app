import type { StorkDataPoint } from "~/types/stork";
import {
  getPreparedStoryTimelineDiagnostic,
  type StoryTimelineDay,
} from "~/utils/storyCycle";

const loggedTimelineKeys = new Set<string>();

export const logPreparedStoryTimelineDiagnosticOnce = (
  points: StorkDataPoint[],
  timeline: StoryTimelineDay[],
) => {
  if (!import.meta.dev || !timeline.length) return;

  const diagnostic = getPreparedStoryTimelineDiagnostic(points, timeline);
  const logKey = `${diagnostic.cycleId}:${diagnostic.cycleDurationMs}`;

  if (loggedTimelineKeys.has(logKey)) return;
  loggedTimelineKeys.add(logKey);

  console.info("[StoryTiming] Prepared migration timeline", {
    cycleId: diagnostic.cycleId,
    cycleDurationMs: diagnostic.cycleDurationMs,
    migrationDayCount: diagnostic.migrationDayCount,
    restDayCount: diagnostic.restDayCount,
    referenceFastDayCount: diagnostic.referenceFastDayCount,
    referenceNormalDayCount: diagnostic.referenceNormalDayCount,
    referenceTotalWeight: diagnostic.referenceTotalWeight,
    migrationDayDurationMs: diagnostic.migrationDayDurationMs,
    restDayDurationMs: diagnostic.restDayDurationMs,
    migrationBudgetMs: diagnostic.migrationBudgetMs,
    restBudgetMs: diagnostic.restBudgetMs,
    firstTimelineDate: diagnostic.firstTimelineDate,
    lastTimelineDate: diagnostic.lastTimelineDate,
  });
  console.info("[StoryTiming] Planned phase durations", diagnostic.phases);
};
