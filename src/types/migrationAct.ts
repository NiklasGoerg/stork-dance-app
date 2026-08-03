import type { StoryActId } from "~/story/types";
import type { StorkMigrationEvent, StorkMigrationPhase } from "~/types/stork";
import type { StoryGestureId } from "~/story/gestures";
import type { StorySeasonId, StoryTimelineDay } from "~/utils/storyCycle";

export type MigrationActSurfaceId = StoryActId | "story-stage" | "map-stage";

export type MigrationActPlaybackState =
  | "idle"
  | "playing"
  | "paused"
  | "gesture_lead_in"
  | "gesture_playing"
  | "cycle_transition"
  | "completed"
  | "error";

export type MigrationActPlaybackMode = "story" | "single_cycle";

export type MigrationActPauseReason =
  "user" | "gesture" | "cycle_transition" | "system";

export type MigrationActEventStatus =
  "pending" | "triggered" | "completed" | "skipped";

export type MigrationActCycleRun = {
  id: string;
  cycleId: string;
  cycleStartYear: number;
  title: string;
  titleKey?: string;
  titleParams?: Record<string, string | number>;
};

export type MigrationActEvent = {
  id: string;
  cycleRunId: string;
  cycleId: string;
  eventType: StorkMigrationEvent;
  gestureId: StoryGestureId;
  boundaryDate: string;
  boundaryTimeMs: number;
  status: MigrationActEventStatus;
};

export type MigrationActMapFrame = {
  cycleId: string;
  date: string;
  phase: StorkMigrationPhase;
  event: StorkMigrationEvent | null;
};

export type MigrationActEventDiagnostic = {
  eventId: string;
  actId: MigrationActSurfaceId;
  playbackMode: MigrationActPlaybackMode;
  cycleId: string;
  eventType: StorkMigrationEvent;
  eventDate: string;
  boundaryTimeMs: number;
  previousElapsedMs: number;
  detectedElapsedMs: number;
  detectionLatencyMs: number;
  pausedElapsedMs: number;
  pausedDate: string;
  movementLoadStart: number | null;
  movementLoadEnd: number | null;
  leadInStart: number | null;
  movementFirstFrame: number | null;
  gestureCompleted: number | null;
  storyResumed: number | null;
  selectedMapPointDate: string | null;
};

export type MigrationActRuntimeSnapshot = {
  elapsedMs: number;
  date: string;
  timelineDay: StoryTimelineDay;
  phase: StorkMigrationPhase;
};

export type MigrationSeasonAudioState = {
  currentSeason: StorySeasonId | null;
  isReady: boolean;
  error: string;
};
