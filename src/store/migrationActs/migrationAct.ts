import { defineStore } from "pinia";
import type {
  MigrationActCycleRun,
  MigrationActDebugState,
  MigrationActEvent,
  MigrationActEventDiagnostic,
  MigrationActEventStatus,
  MigrationActLatLng,
  MigrationActMapFrame,
  MigrationActNarrationEventPayload,
  MigrationActPauseReason,
  MigrationActPlaybackMode,
  MigrationActPlaybackState,
  MigrationActStoryNarrationState,
  MigrationActSurfaceId,
  MigrationCycleOverlayState,
  MigrationCycleTransitionTraceEntry,
  MigrationCycleTransitionOverlayState,
  MigrationMapCameraMode,
  GuidedMigrationState,
  MigrationSeasonAudioState,
  CycleTransitionState,
} from "~/types/migrationAct";
import type { StoryTimelineDay } from "~/utils/storyCycle";
import { getMigrationRuntimeSnapshot } from "~/utils/migrationActs/timeline";

type MigrationActState = {
  actId: MigrationActSurfaceId | null;
  playbackState: MigrationActPlaybackState;
  playbackMode: MigrationActPlaybackMode;
  cycleRuns: MigrationActCycleRun[];
  activeCycleIndex: number;
  selectedCycleRunId: string | null;
  completedCycleRunIds: string[];
  timeline: StoryTimelineDay[];
  events: MigrationActEvent[];
  currentElapsedMs: number;
  currentDate: string;
  currentTimelineDay: StoryTimelineDay | null;
  currentPhase: StoryTimelineDay["phase"] | null;
  activeEventId: string | null;
  pendingEventId: string | null;
  pauseReasons: MigrationActPauseReason[];
  transitionRemainingMs: number;
  playbackSessionId: number;
  seekRevision: number;
  lastMapFrame: MigrationActMapFrame | null;
  diagnostics: MigrationActEventDiagnostic[];
  seasonAudio: MigrationSeasonAudioState;
  temporaryMovementFeedbackId: string | null;
  initialCountdownNumber: number | null;
  cycleOverlay: MigrationCycleOverlayState;
  cycleTransitionOverlay: MigrationCycleTransitionOverlayState;
  cycleTransitionTrace: MigrationCycleTransitionTraceEntry[];
  mapCameraMode: MigrationMapCameraMode;
  lastNarrationEventIds: string[];
  latestNarrationEvent: MigrationActNarrationEventPayload | null;
  storyNarration: MigrationActStoryNarrationState;
  engagementNudge: {
    phaseKey: string | null;
    consecutiveLowParticipationBars: number;
    nudged: boolean;
  };
  debug: MigrationActDebugState;
  error: string;
  guided: GuidedMigrationState;
};

const getInitialGuidedState = (): GuidedMigrationState => ({
  phase: "idle",
  activeMovementId: null,
  activeGestureId: null,
  demonstrationIndex: 0,
  demonstrationCount: 2,
  successfulBars: 0,
  requiredSuccessfulBars: 3,
  learnedMovementIds: [],
  facilitatorCompletedPhases: [],
  completionCount: 0,
  status: "idle",
});

const getInitialSeasonAudioState = (): MigrationSeasonAudioState => ({
  currentSeason: null,
  isReady: false,
  error: "",
});

const getInitialCycleOverlayState = (): MigrationCycleOverlayState => ({
  visible: false,
  cycleRunId: null,
  title: "",
  subtitleKey: "",
  subtitleParams: {},
  remainingMs: 0,
});

const getInitialCycleTransitionOverlayState =
  (): MigrationCycleTransitionOverlayState => ({
    visible: false,
    state: "idle",
    fromTitle: "",
    toTitle: "",
    sourceCycleId: null,
    targetCycleId: null,
    targetDate: null,
    targetPhase: null,
    coverStartedTransportMs: null,
    revealTransportMs: null,
    oneBarDurationMs: 0,
    mapReady: false,
    mapReadyTransportMs: null,
    markerLatLng: null,
    cameraReady: false,
    remainingMs: 0,
  });

const getInitialStoryNarrationState = (): MigrationActStoryNarrationState => ({
  eventId: null,
  title: "",
  text: "",
});

const getInitialDebugState = (): MigrationActDebugState => ({
  enabled: false,
  autoProgressEnabled: false,
});

const getInitialState = (): MigrationActState => ({
  actId: null,
  playbackState: "idle",
  playbackMode: "story",
  cycleRuns: [],
  activeCycleIndex: 0,
  selectedCycleRunId: null,
  completedCycleRunIds: [],
  timeline: [],
  events: [],
  currentElapsedMs: 0,
  currentDate: "",
  currentTimelineDay: null,
  currentPhase: null,
  activeEventId: null,
  pendingEventId: null,
  pauseReasons: [],
  transitionRemainingMs: 0,
  playbackSessionId: 0,
  seekRevision: 0,
  lastMapFrame: null,
  diagnostics: [],
  seasonAudio: getInitialSeasonAudioState(),
  temporaryMovementFeedbackId: null,
  initialCountdownNumber: null,
  cycleOverlay: getInitialCycleOverlayState(),
  cycleTransitionOverlay: getInitialCycleTransitionOverlayState(),
  cycleTransitionTrace: [],
  mapCameraMode: "residence",
  lastNarrationEventIds: [],
  latestNarrationEvent: null,
  storyNarration: getInitialStoryNarrationState(),
  engagementNudge: {
    phaseKey: null,
    consecutiveLowParticipationBars: 0,
    nudged: false,
  },
  debug: getInitialDebugState(),
  error: "",
  guided: getInitialGuidedState(),
});

export const useMigrationActStore = defineStore("migrationAct", {
  state: getInitialState,
  getters: {
    activeCycleRun: (state) => state.cycleRuns[state.activeCycleIndex] ?? null,
    activeCycleId(): string | null {
      return this.activeCycleRun?.cycleId ?? null;
    },
    cycleDurationMs: (state) => state.timeline.at(-1)?.endMs ?? 0,
    isPlaying: (state) => state.playbackState === "playing",
    isGestureActive: (state) =>
      state.playbackState === "gesture_lead_in" ||
      state.playbackState === "gesture_playing",
    hasUserPause: (state) => state.pauseReasons.includes("user"),
  },
  actions: {
    setDebugEnabled(enabled: boolean) {
      this.debug.enabled = enabled;
      if (!enabled) this.debug.autoProgressEnabled = false;
    },
    setAutoProgressEnabled(enabled: boolean) {
      this.debug.autoProgressEnabled = this.debug.enabled && enabled;
    },
    prepare({
      actId,
      cycleRuns,
      activeCycleIndex = 0,
    }: {
      actId: MigrationActSurfaceId;
      cycleRuns: MigrationActCycleRun[];
      activeCycleIndex?: number;
    }) {
      const debug = { ...this.debug };

      Object.assign(this, getInitialState(), {
        actId,
        cycleRuns,
        activeCycleIndex,
        selectedCycleRunId: cycleRuns[activeCycleIndex]?.id ?? null,
        playbackSessionId: this.playbackSessionId + 1,
        debug,
      });
    },
    prepareCycle({
      activeCycleIndex,
      timeline,
      events,
    }: {
      activeCycleIndex: number;
      timeline: StoryTimelineDay[];
      events: MigrationActEvent[];
    }) {
      const snapshot = getMigrationRuntimeSnapshot(timeline, 0);

      this.activeCycleIndex = activeCycleIndex;
      this.selectedCycleRunId = this.cycleRuns[activeCycleIndex]?.id ?? null;
      this.timeline = timeline;
      this.events = events;
      this.currentElapsedMs = snapshot.elapsedMs;
      this.currentDate = snapshot.date;
      this.currentTimelineDay = snapshot.timelineDay;
      this.currentPhase = snapshot.phase;
      this.activeEventId = null;
      this.pendingEventId =
        events.find((event) => event.status === "pending")?.id ?? null;
      this.transitionRemainingMs = 0;
      this.lastMapFrame = null;
      this.error = "";
      this.seekRevision++;
      this.playbackSessionId++;
    },
    setElapsedMs(elapsedMs: number) {
      const snapshot = getMigrationRuntimeSnapshot(this.timeline, elapsedMs);

      this.currentElapsedMs = snapshot.elapsedMs;
      this.currentDate = snapshot.date;
      this.currentTimelineDay = snapshot.timelineDay;
      this.currentPhase = snapshot.phase;
    },
    setPlaybackState(state: MigrationActPlaybackState) {
      this.playbackState = state;
    },
    setPlaybackMode(mode: MigrationActPlaybackMode) {
      this.playbackMode = mode;
    },
    addPauseReason(reason: MigrationActPauseReason) {
      if (!this.pauseReasons.includes(reason)) this.pauseReasons.push(reason);
    },
    removePauseReason(reason: MigrationActPauseReason) {
      this.pauseReasons = this.pauseReasons.filter((item) => item !== reason);
    },
    clearPauseReasons() {
      this.pauseReasons = [];
    },
    setEventStatus(eventId: string, status: MigrationActEventStatus) {
      this.events = this.events.map((event) =>
        event.id === eventId ? { ...event, status } : event,
      );
      this.pendingEventId =
        this.events.find((event) => event.status === "pending")?.id ?? null;
    },
    replaceEvents(events: MigrationActEvent[]) {
      this.events = events;
      this.pendingEventId =
        events.find((event) => event.status === "pending")?.id ?? null;
    },
    setActiveEvent(eventId: string | null) {
      this.activeEventId = eventId;
    },
    markCycleCompleted(runId: string) {
      if (!this.completedCycleRunIds.includes(runId)) {
        this.completedCycleRunIds.push(runId);
      }
    },
    setTransitionRemainingMs(remainingMs: number) {
      this.transitionRemainingMs = Math.max(0, remainingMs);
    },
    reportMapFrame(frame: MigrationActMapFrame) {
      this.lastMapFrame = frame;
    },
    addDiagnostic(diagnostic: MigrationActEventDiagnostic) {
      const index = this.diagnostics.findIndex(
        (item) => item.eventId === diagnostic.eventId,
      );

      if (index === -1) this.diagnostics.push(diagnostic);
      else this.diagnostics[index] = diagnostic;
    },
    updateDiagnostic(
      eventId: string,
      patch: Partial<MigrationActEventDiagnostic>,
    ) {
      const diagnostic = this.diagnostics.find(
        (item) => item.eventId === eventId,
      );
      if (diagnostic) Object.assign(diagnostic, patch);
    },
    setSeasonAudioState(patch: Partial<MigrationSeasonAudioState>) {
      Object.assign(this.seasonAudio, patch);
    },
    setTemporaryMovementFeedback(id: string | null) {
      this.temporaryMovementFeedbackId = id;
    },
    setInitialCountdownNumber(count: number | null) {
      this.initialCountdownNumber = count;
    },
    showCycleOverlay({
      cycleRunId,
      title,
      subtitleKey,
      subtitleParams = {},
      durationMs,
    }: {
      cycleRunId: string;
      title: string;
      subtitleKey: string;
      subtitleParams?: Record<string, string | number>;
      durationMs: number;
    }) {
      this.cycleOverlay = {
        visible: true,
        cycleRunId,
        title,
        subtitleKey,
        subtitleParams,
        remainingMs: Math.max(0, durationMs),
      };
    },
    tickCycleOverlay(deltaMs: number) {
      if (!this.cycleOverlay.visible) return;

      const remainingMs = Math.max(0, this.cycleOverlay.remainingMs - deltaMs);
      this.cycleOverlay = {
        ...this.cycleOverlay,
        visible: remainingMs > 0,
        remainingMs,
      };
    },
    hideCycleOverlay() {
      this.cycleOverlay = getInitialCycleOverlayState();
    },
    appendCycleTransitionTrace(transportMs: number) {
      const transition = this.cycleTransitionOverlay;

      this.cycleTransitionTrace.push({
        state: transition.state,
        transportMs,
        sourceCycleId: transition.sourceCycleId,
        targetCycleId: transition.targetCycleId,
        targetDate: transition.targetDate,
        targetPhase: transition.targetPhase,
        mapReady: transition.mapReady,
        mapReadyTransportMs: transition.mapReadyTransportMs,
        markerLatLng: transition.markerLatLng,
        cameraReady: transition.cameraReady,
        oneBarDurationMs: transition.oneBarDurationMs,
      });
    },
    showCycleTransitionOverlay({
      fromTitle,
      toTitle,
      sourceCycleId,
      targetCycleId,
      targetDate,
      targetPhase,
      durationMs,
      coverStartedTransportMs,
    }: {
      fromTitle: string;
      toTitle: string;
      sourceCycleId: string;
      targetCycleId: string;
      targetDate: string;
      targetPhase: StoryTimelineDay["phase"];
      durationMs: number;
      coverStartedTransportMs: number;
    }) {
      this.cycleTransitionOverlay = {
        visible: true,
        state: "covering",
        fromTitle,
        toTitle,
        sourceCycleId,
        targetCycleId,
        targetDate,
        targetPhase,
        coverStartedTransportMs,
        revealTransportMs: null,
        oneBarDurationMs: Math.max(0, durationMs),
        mapReady: false,
        mapReadyTransportMs: null,
        markerLatLng: null,
        cameraReady: false,
        remainingMs: Math.max(0, durationMs),
      };
      this.appendCycleTransitionTrace(coverStartedTransportMs);
    },
    setCycleTransitionState(state: CycleTransitionState, transportMs: number) {
      this.cycleTransitionOverlay = {
        ...this.cycleTransitionOverlay,
        state,
        revealTransportMs:
          state === "revealing"
            ? transportMs
            : this.cycleTransitionOverlay.revealTransportMs,
      };
      this.appendCycleTransitionTrace(transportMs);
    },
    tickCycleTransitionOverlay(deltaMs: number) {
      if (!this.cycleTransitionOverlay.visible) return;

      const remainingMs = Math.max(
        0,
        this.cycleTransitionOverlay.remainingMs - deltaMs,
      );
      this.cycleTransitionOverlay = {
        ...this.cycleTransitionOverlay,
        remainingMs,
      };
    },
    markCycleTransitionMapReady({
      markerLatLng = null,
      cameraReady = true,
      transportMs,
    }: {
      markerLatLng?: MigrationActLatLng | null;
      cameraReady?: boolean;
      transportMs: number;
    }) {
      if (!this.cycleTransitionOverlay.visible) return;

      this.cycleTransitionOverlay = {
        ...this.cycleTransitionOverlay,
        state: "ready",
        mapReady: true,
        mapReadyTransportMs: transportMs,
        markerLatLng,
        cameraReady,
      };
      this.appendCycleTransitionTrace(transportMs);
    },
    hideCycleTransitionOverlay(transportMs = 0) {
      this.cycleTransitionOverlay = {
        ...this.cycleTransitionOverlay,
        visible: false,
        state: "idle",
        remainingMs: 0,
      };
      this.appendCycleTransitionTrace(transportMs);
      this.cycleTransitionOverlay = getInitialCycleTransitionOverlayState();
    },
    setMapCameraMode(mode: MigrationMapCameraMode) {
      this.mapCameraMode = mode;
    },
    recordNarrationEvent(event: MigrationActNarrationEventPayload) {
      this.latestNarrationEvent = event;
      if (!this.lastNarrationEventIds.includes(event.eventId)) {
        this.lastNarrationEventIds.push(event.eventId);
      }
    },
    setStoryNarration(narration: MigrationActStoryNarrationState) {
      this.storyNarration = narration;
    },
    clearStoryNarration() {
      this.storyNarration = getInitialStoryNarrationState();
    },
    resetEngagementNudge(phaseKey: string | null) {
      this.engagementNudge = {
        phaseKey,
        consecutiveLowParticipationBars: 0,
        nudged: false,
      };
    },
    recordEngagementEvaluation(status: "success" | "failed" | "not_evaluable") {
      this.engagementNudge.consecutiveLowParticipationBars =
        status === "success"
          ? 0
          : this.engagementNudge.consecutiveLowParticipationBars + 1;
    },
    markEngagementNudged() {
      this.engagementNudge.nudged = true;
    },
    setError(error: string) {
      this.error = error;
      this.playbackState = "error";
    },
    setGuidedState(patch: Partial<GuidedMigrationState>) {
      Object.assign(this.guided, patch);
    },
    markGuidedMovementLearned(movementId: string) {
      if (!this.guided.learnedMovementIds.includes(movementId)) {
        this.guided.learnedMovementIds.push(movementId);
      }
    },
    markGuidedPhaseFacilitatorCompleted(phase: GuidedMigrationState["phase"]) {
      if (!this.guided.facilitatorCompletedPhases.includes(phase)) {
        this.guided.facilitatorCompletedPhases.push(phase);
      }
    },
    resetGuidedState() {
      this.guided = getInitialGuidedState();
    },
    resetRuntime() {
      const actId = this.actId;
      const cycleRuns = [...this.cycleRuns];
      const diagnostics = this.diagnostics;
      const playbackSessionId = this.playbackSessionId + 1;
      const debug = { ...this.debug };

      Object.assign(this, getInitialState(), {
        actId,
        cycleRuns,
        diagnostics,
        playbackSessionId,
        debug,
      });
    },
    dispose() {
      Object.assign(this, getInitialState());
    },
  },
});
