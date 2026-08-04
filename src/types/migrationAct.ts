import type { StoryActId } from "~/story/types";
import type { StorkMigrationEvent, StorkMigrationPhase } from "~/types/stork";
import type { StoryGestureId } from "~/story/gestures";
import type { StorySeasonId, StoryTimelineDay } from "~/utils/storyCycle";
import type { MovementPlaybackTiming } from "~/types/movement";

export type MigrationActSurfaceId = StoryActId | "story-stage" | "map-stage";

export type MigrationActPlaybackState =
  | "idle"
  | "initial_countdown"
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

export type MigrationMovementSpeed = "slow" | "medium" | "fast";

export type MigrationMovementDirection = "stationary" | "outbound" | "return";

export type MigrationMovementType = "rest" | "migration";

export type MigrationMovementRecognitionProfile =
  "summer_rest" | "winter_rest" | "migration";

export type MigrationMovementCriterionKey =
  | "wingBeat"
  | "stepActivity"
  | "stanceWidthChange"
  | "verticalBounce"
  | "directionTrend"
  | "depthTrend"
  | "lean";

export type MigrationMovementEvaluationStatus =
  "idle" | "success" | "failed" | "not_evaluable";

export type MigrationGestureEvaluationStatus =
  "success" | "failed" | "not_evaluable";

export type MigrationGestureFeedbackCode =
  | "SUCCESS"
  | "CHECKPOINT_NOT_EVALUABLE"
  | "CROUCH_LOWER"
  | "RISE_UP"
  | "HANDS_UP"
  | "ARMS_OUT"
  | "LOWER_ARMS"
  | "TRY_AGAIN";

export interface MigrationGestureEvaluationResult {
  id: string;
  status: MigrationGestureEvaluationStatus;
  gestureId: StoryGestureId;
  attemptNumber: number;
  checkpointId: string | null;
  failedCriteria: readonly string[];
  primaryFeedbackCode: MigrationGestureFeedbackCode;
}

export type MigrationInfoPanelMode =
  | "phaseInstruction"
  | "gestureInstruction"
  | "gestureFeedback"
  | "movementFeedback"
  | "cycleTransition"
  | "completed"
  | "systemError";

export type MigrationInfoPanelTone =
  "neutral" | "success" | "warning" | "error";

export interface MigrationMovementListItem {
  id: string;
  label: string;
  type: "rest" | "migration" | "departure" | "arrival";
  state: "completed" | "current" | "upcoming";
}

export type MigrationInfoPanelActionId =
  | "cancelGesture"
  | "markGestureSuccessful"
  | "repeatGesture"
  | "continueGesture"
  | "continueToNextAct";

export interface MigrationInfoPanelAction {
  id: MigrationInfoPanelActionId;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}

export interface MigrationActInfoPanelModel {
  mode: MigrationInfoPanelMode;
  title: string;
  instruction?: string;
  detail?: string;
  status?: string;
  feedbackTitle?: string;
  feedbackText?: string;
  tone: MigrationInfoPanelTone;
  movements: readonly MigrationMovementListItem[];
  actions: readonly MigrationInfoPanelAction[];
}

export type MigrationMovementCriterionStatus = Exclude<
  MigrationMovementEvaluationStatus,
  "idle"
>;

export type MigrationMovementWingState =
  "up" | "down" | "neutral" | "not_evaluable";

export interface MigrationMovementRecognitionConfig {
  enabled: boolean;
  blocking: false;
  pulseDurationMs: number;
  requiredCriteria: readonly MigrationMovementCriterionKey[];
  optionalCriteria: readonly MigrationMovementCriterionKey[];
}

export interface MigrationMovementRootMotion {
  startHipX: number;
  startHipY: number;
  endHipX: number;
  endHipY: number;
  displacementX: number;
  displacementY: number;
}

export type ResolvedMigrationMovement = {
  movementId: string;
  movementType: MigrationMovementType;
  speedClass: MigrationMovementSpeed | null;
  loop: boolean;
  direction: MigrationMovementDirection;
  targetRegion: string | null;
  recognitionProfile: MigrationMovementRecognitionProfile;
  playbackTiming: MovementPlaybackTiming;
};
