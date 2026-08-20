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
  "user" | "gesture" | "tutorial" | "cycle_transition" | "system";

export type MigrationMapCameraMode = "residence" | "migration";

export type CycleTransitionState =
  "idle" | "covering" | "swapping" | "ready" | "revealing";

export type MigrationActLatLng = {
  lat: number;
  lng: number;
};

export type MigrationCycleTransitionTraceEntry = {
  state: CycleTransitionState;
  transportMs: number;
  sourceCycleId: string | null;
  targetCycleId: string | null;
  targetDate: string | null;
  targetPhase: StorkMigrationPhase | null;
  mapReady: boolean;
  mapReadyTransportMs: number | null;
  markerLatLng: MigrationActLatLng | null;
  cameraReady: boolean;
  oneBarDurationMs: number;
};

export type MigrationCycleOverlayState = {
  visible: boolean;
  cycleRunId: string | null;
  title: string;
  subtitleKey: string;
  subtitleParams: Record<string, string | number>;
  remainingMs: number;
};

export type MigrationCycleTransitionOverlayState = {
  visible: boolean;
  state: CycleTransitionState;
  fromTitle: string;
  toTitle: string;
  sourceCycleId: string | null;
  targetCycleId: string | null;
  targetDate: string | null;
  targetPhase: StorkMigrationPhase | null;
  coverStartedTransportMs: number | null;
  revealTransportMs: number | null;
  oneBarDurationMs: number;
  mapReady: boolean;
  mapReadyTransportMs: number | null;
  markerLatLng: MigrationActLatLng | null;
  cameraReady: boolean;
  remainingMs: number;
};

export type MigrationActStoryNarrationState = {
  eventId: string | null;
  title: string;
  text: string;
};

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
  markerLatLng?: MigrationActLatLng | null;
  cameraReady?: boolean;
};

export type MigrationActNarrationSemanticEvent =
  | "flowIntro"
  | "cycleIntro"
  | "cycleTransition"
  | "summerResidenceTiming"
  | "autumnDeparturePrepare"
  | "winterReflection"
  | "winterResidenceTiming"
  | "springDeparturePrepare"
  | "breedingReflection"
  | "cycleSummary"
  | "engagementNudge"
  | "actSummary"
  | "transitionToClimate";

export type MigrationActNarrationDirection = "south" | "north" | null;
export type MigrationActNarrationCueRole =
  | "actIntro"
  | "cycleIntro"
  | "cycleTransition"
  | "summerTiming"
  | "autumnPrepare"
  | "winterReflection"
  | "winterTiming"
  | "springPrepare"
  | "breedingReflection"
  | "actCompletion";

export type MigrationActNarrationEventPayload = {
  event: MigrationActNarrationSemanticEvent;
  eventId: string;
  cueId?: string;
  cueRole?: MigrationActNarrationCueRole;
  cycleRunId: string | null;
  cycleId: string | null;
  step: number | null;
  totalCycles: number;
  startYear: number | null;
  endYear: number | null;
  currentPhase: StorkMigrationPhase | null;
  realDepartureDate?: string;
  realArrivalDate?: string;
  realMigrationDurationDays?: number;
  experienceMigrationDurationSeconds?: number;
  experienceMigrationDurationSecondsExact?: number;
  experienceMigrationDurationSecondsSpoken?: number;
  direction?: MigrationActNarrationDirection;
  winterRegion?: string | null;
  previousWinterRegion?: string | null;
  referenceWinterRegion?: string | null;
};

export type MigrationActDebugSnapshot = {
  cycle: string;
  currentStoryDate: string;
  experienceTimeSeconds: number;
  nextEvent: StorkMigrationEvent | null;
  nextEventExperienceTimeSeconds: number | null;
  phase: StorkMigrationPhase | null;
  mapCameraMode: MigrationMapCameraMode;
  overlayVisible: boolean;
  cycleTransitionOverlayVisible: boolean;
};

export type MigrationActDebugState = {
  enabled: boolean;
  autoProgressEnabled: boolean;
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
  "summer_rest" | "winter_rest" | "migration" | "migration-guided";

export type AvatarPlaybackOwner =
  | "summer"
  | "winter"
  | "autumn-migration"
  | "spring-migration"
  | "departure"
  | "arrival"
  | "idle";

export interface GuidedOwnerSwitchTrace {
  fromOwner: AvatarPlaybackOwner;
  toOwner: AvatarPlaybackOwner;
  scheduledTransportMs: number;
  actualTransportMs: number;
  reason: string;
}

export interface GuidedAct2Trace {
  runtimeRunId: number;
  guidedInterludeRevision: number;
  playbackState: string;
  pauseReasons: MigrationActPauseReason[];
  masterTransportMs: number;
  masterBarIndex: number;
  masterBeatIndex: number;
  musicSourceTimeMs: number;
  storyTimeMs: number;
  seasonalThemeId: StorySeasonId | null;
  seasonalThemeSourceTimeMs: number | null;
  guidedPhase: GuidedMigrationPhase;
  tutorialPlaybackMode: "demonstration" | "practice" | "story" | null;
  guidedRecognitionPurpose: "idle" | "practice-gating" | "passive-feedback";
  gestureState: string;
  gestureId: StoryGestureId | null;
  gestureCompletionStatus: MigrationGestureEvaluationStatus | null;
  avatarPlaybackOwner: AvatarPlaybackOwner;
  renderedMovementId: string | null;
  avatarSourceTimeMs: number;
  recognitionSessionId: number | null;
  recognitionProfile: MigrationMovementRecognitionProfile | null;
  recognitionMovementId: string | null;
  recognitionBarIndex: number | null;
  recognitionBeatIndex: MigrationMovementBeatIndex | null;
  recognitionSourceTimeMs: number | null;
  scheduledNextOwner: AvatarPlaybackOwner | null;
  scheduledOwnerSwitchMs: number | null;
  lastOwnerSwitchReason: string | null;
  ownerSwitchPromisePending: boolean;
  demonstrationPromisePending: boolean;
  storyTransitionPromisePending: boolean;
  guidedBarWaitsPending: number;
  movementLoaded: boolean;
  movementLoadError: string | null;
}

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

export interface MigrationMovementBarEvaluation {
  evaluationId: string;
  sessionId: number;
  profile: MigrationMovementRecognitionProfile;
  movementId: string;
  barIndex: number;
  status: Exclude<MigrationMovementEvaluationStatus, "idle">;
  beatResults: MigrationMovementBeatEvaluation[];
  criteria: {
    wingBeat: MigrationMovementCriterionStatus;
    stepActivity: MigrationMovementCriterionStatus;
    stanceWidthChange: MigrationMovementCriterionStatus;
    verticalBounce: MigrationMovementCriterionStatus;
  };
  evaluatedAtMs: number;
}

export type MigrationMovementBeatIndex = 1 | 2 | 3 | 4;
export type MigrationMovementPhraseIndex = 1 | 2;

export interface MigrationMovementBeatEvaluation {
  evaluationId: string;
  sessionId: number;
  profile: MigrationMovementRecognitionProfile;
  movementId: string;
  barIndex: number;
  beatIndex: MigrationMovementBeatIndex;
  status: MigrationMovementCriterionStatus;
  detectedSide: "left" | "right" | null;
  criteria: {
    footActivity: MigrationMovementCriterionStatus;
    returnToBaseline: MigrationMovementCriterionStatus;
    stanceChange: MigrationMovementCriterionStatus;
    armsUp: MigrationMovementCriterionStatus;
    armsDown: MigrationMovementCriterionStatus;
    direction: MigrationMovementCriterionStatus;
  };
  metrics: {
    activeSide: "left" | "right" | null;
    activeFootDelta: number | null;
    baselineFootX: number | null;
    actionFootX: number | null;
    returnFootX: number | null;
    returnDelta: number | null;
    returnStartDistance: number | null;
    returnFinalDistance: number | null;
    returnMovement: number | null;
    sampleWindowStartMs: number | null;
    sampleWindowEndMs: number | null;
    stanceChange: number | null;
    actionStanceWidth: number | null;
    returnStanceWidth: number | null;
    validSampleCount: number;
    actionSampleCount: number;
    directionScore: number | null;
    expectedDirection: MigrationMovementDirection | null;
  };
  evaluatedAtMs: number;
}

export interface MigrationMovementPhraseEvaluation {
  evaluationId: string;
  sessionId: number;
  profile: MigrationMovementRecognitionProfile;
  movementId: string;
  barIndex: number;
  phraseIndex: MigrationMovementPhraseIndex;
  status: Exclude<MigrationMovementEvaluationStatus, "idle">;
  beatResults: MigrationMovementBeatEvaluation[];
  evaluatedAtMs: number;
}

export type GuidedMigrationPhase =
  | "idle"
  | "journey-introduction"
  | "summer-context"
  | "summer-demonstration"
  | "summer-practice-prompt"
  | "summer-practice"
  | "summer-success"
  | "summer-story-transition"
  | "autumn-departure-context"
  | "autumn-departure-demonstration"
  | "autumn-departure-practice-prompt"
  | "autumn-departure-practice"
  | "autumn-departure-success"
  | "autumn-migration-context"
  | "autumn-migration-demonstration"
  | "autumn-migration-practice-prompt"
  | "autumn-migration-practice"
  | "autumn-migration-success"
  | "autumn-migration-story"
  | "autumn-arrival-context"
  | "autumn-arrival-demonstration"
  | "autumn-arrival-practice-prompt"
  | "autumn-arrival-practice"
  | "autumn-arrival-success"
  | "winter-context"
  | "winter-demonstration"
  | "winter-practice-prompt"
  | "winter-practice"
  | "winter-success"
  | "winter-story-transition"
  | "spring-departure-context"
  | "spring-departure-practice-prompt"
  | "spring-departure-practice"
  | "spring-departure-success"
  | "spring-migration-context"
  | "spring-migration-demonstration"
  | "spring-migration-practice-prompt"
  | "spring-migration-practice"
  | "spring-migration-success"
  | "spring-migration-story"
  | "spring-arrival-context"
  | "spring-arrival-practice-prompt"
  | "spring-arrival-practice"
  | "spring-arrival-success"
  | "cycle-complete";

export type GuidedMigrationStatus =
  | "idle"
  | "context"
  | "demonstrating"
  | "prompt"
  | "practicing"
  | "success"
  | "transition"
  | "completed";

export interface GuidedMigrationState {
  phase: GuidedMigrationPhase;
  activeMovementId: string | null;
  activeGestureId: StoryGestureId | null;
  demonstrationIndex: number;
  demonstrationCount: number;
  successfulBars: number;
  requiredSuccessfulBars: number;
  learnedMovementIds: string[];
  facilitatorCompletedPhases: GuidedMigrationPhase[];
  completionCount: number;
  status: GuidedMigrationStatus;
}

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
  | "storyNarration"
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
  | "continueToNextAct"
  | "startGuidedJourney"
  | "forceCompleteGuidedStep";

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
  progress?: {
    current: number;
    total: number;
    label: string;
  };
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
