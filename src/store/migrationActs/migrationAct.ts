import { defineStore } from "pinia";
import type {
  MigrationActCycleRun,
  MigrationActEvent,
  MigrationActEventDiagnostic,
  MigrationActEventStatus,
  MigrationActMapFrame,
  MigrationActPauseReason,
  MigrationActPlaybackMode,
  MigrationActPlaybackState,
  MigrationActSurfaceId,
  GuidedMigrationState,
  MigrationSeasonAudioState,
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
    prepare({
      actId,
      cycleRuns,
      activeCycleIndex = 0,
    }: {
      actId: MigrationActSurfaceId;
      cycleRuns: MigrationActCycleRun[];
      activeCycleIndex?: number;
    }) {
      Object.assign(this, getInitialState(), {
        actId,
        cycleRuns,
        activeCycleIndex,
        selectedCycleRunId: cycleRuns[activeCycleIndex]?.id ?? null,
        playbackSessionId: this.playbackSessionId + 1,
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

      Object.assign(this, getInitialState(), {
        actId,
        cycleRuns,
        diagnostics,
        playbackSessionId,
      });
    },
    dispose() {
      Object.assign(this, getInitialState());
    },
  },
});
