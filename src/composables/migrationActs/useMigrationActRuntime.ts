import { computed } from "vue";
import {
  useMigrationActSeasonAudio,
  type MigrationActSeasonAudioService,
} from "~/composables/migrationActs/useMigrationActSeasonAudio";
import { useMigrationActMovementSession } from "~/composables/migrationActs/useMigrationActMovementSession";
import { useMigrationActMovement } from "~/composables/migrationActs/useMigrationActMovement";
import { useMigrationActMovementRecognition } from "~/composables/migrationActs/useMigrationActMovementRecognition";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useAudioStore } from "~/store/audioStore";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import type { StoryAct } from "~/story/types";
import type {
  MigrationActCycleRun,
  MigrationActEvent,
  MigrationActMapFrame,
  MigrationActPauseReason,
  MigrationActSurfaceId,
} from "~/types/migrationAct";
import type { PoseLandmarkLike } from "~/types/pose";
import {
  createMigrationActEvents,
  reconcileMigrationActEventsForSeek,
} from "~/utils/migrationActs/events";
import { resolveMigrationActCycleRuns } from "~/utils/migrationActs/config";
import { getMigrationMapFrame } from "~/utils/migrationActs/timeline";
import { getMigrationPlaybackAdvance } from "~/utils/migrationActs/transitions";
import {
  getMigrationMovementDirection,
  getMigrationMovementPhaseTiming,
  resolveMigrationMovement,
} from "~/utils/migrationActs/migrationMovementSelection";
import { getMigrationGestureMovementDefinition } from "~/utils/migrationActs/migrationMovementDefinitions";
import {
  buildPreparedStoryTimeline,
  STORY_CYCLE_DURATION_MS,
} from "~/utils/storyCycle";
import {
  getMigrationStoryCyclePoints,
  migrationStoryCycleDefinitions,
} from "~/utils/migrationStoryData";

type MigrationActRuntimeOptions = {
  act?: StoryAct;
  surfaceId?: MigrationActSurfaceId;
  cycleRuns?: MigrationActCycleRun[];
  transitionDurationMs?: number;
  runtimeDriver?: MigrationActRuntimeDriver;
  clock?: MigrationActClock;
  audioService?: MigrationActAudioService;
  gestureService?: MigrationActGestureService;
  movementService?: MigrationActMovementService;
  movementRecognitionService?: MigrationActMovementRecognitionService;
  seasonAudioService?: MigrationActSeasonAudioService;
};

export type MigrationActRuntimeDriver = {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (frameId: number) => void;
};

export type MigrationActClock = {
  now: () => number;
};

export type MigrationActAudioService = Pick<
  ReturnType<typeof useAudioStore>,
  | "baseRhythmLoop"
  | "startBaseRhythmLoop"
  | "pauseBaseRhythmLoop"
  | "resumeBaseRhythmLoop"
  | "stopBaseRhythmLoop"
  | "resetBaseRhythmLoop"
  | "getBaseRhythmTransportTimeMs"
  | "getBeatDurationMs"
  | "getMsUntilNextBaseRhythmBeat"
>;

export type MigrationActGestureService = ReturnType<
  typeof useMigrationActMovementSession
>;

export type MigrationActMovementService = ReturnType<
  typeof useMigrationActMovement
>;

export type MigrationActMovementRecognitionService = ReturnType<
  typeof useMigrationActMovementRecognition
>;

const browserRuntimeDriver: MigrationActRuntimeDriver = {
  requestFrame: (callback) =>
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(callback)
      : 0,
  cancelFrame: (frameId) => {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(frameId);
    }
  },
};

const browserClock: MigrationActClock = {
  now: () =>
    typeof performance === "undefined" ? Date.now() : performance.now(),
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown migration runtime error.";

const hasBlockingPause = (pauseReasons: MigrationActPauseReason[]) =>
  pauseReasons.includes("user") || pauseReasons.includes("system");

export const useMigrationActRuntime = ({
  act,
  surfaceId = act?.id ?? "story-stage",
  cycleRuns: providedCycleRuns,
  transitionDurationMs = 1_800,
  runtimeDriver = browserRuntimeDriver,
  clock = browserClock,
  audioService,
  gestureService,
  movementService,
  movementRecognitionService,
  seasonAudioService,
}: MigrationActRuntimeOptions) => {
  const store = useMigrationActStore();
  const audioStore = audioService ?? useAudioStore();
  const storyEngine = useStoryEngine();
  const storyRuntimeStore = useStoryRuntimeStore();
  const gestures = gestureService ?? useMigrationActMovementSession();
  const movement = movementService ?? useMigrationActMovement();
  const movementRecognition =
    movementRecognitionService ?? useMigrationActMovementRecognition();
  const seasonAudio =
    seasonAudioService ??
    useMigrationActSeasonAudio({
      getTransportSeconds: () =>
        audioStore.getBaseRhythmTransportTimeMs() / 1000,
    });
  const cycleRuns =
    providedCycleRuns ?? (act ? resolveMigrationActCycleRuns(act) : []);

  let animationFrameId = 0;
  let lastFrameAtMs: number | null = null;
  let runId = 0;
  let disposed = false;
  let initialized = false;
  let movementFeedbackExpiresAtMs: number | null = null;
  let handledMovementFeedbackId: string | null = null;
  let initialCountdownStartTransportMs: number | null = null;
  let previewEventId: string | null = null;
  let previewResult: ReturnType<MigrationActGestureService["start"]> | null =
    null;
  let pausedFromState: "initial_countdown" | "playing" | null = null;
  let phaseMovementScheduledStartTransportMs: number | null = null;

  const activeEvent = computed(
    () =>
      store.events.find((event) => event.id === store.activeEventId) ?? null,
  );
  const movementPhaseTiming = computed(() =>
    getMigrationMovementPhaseTiming(store.timeline, store.currentTimelineDay),
  );
  const migrationPhaseDurationSeconds = computed(
    () => (movementPhaseTiming.value?.durationMs ?? 0) / 1_000,
  );

  const nextRunId = () => {
    runId++;
    return runId;
  };

  const isCurrentRun = (candidate: number) => !disposed && candidate === runId;

  const cancelFrame = () => {
    if (!animationFrameId) return;

    runtimeDriver.cancelFrame(animationFrameId);
    animationFrameId = 0;
  };

  const clearMovementFeedback = () => {
    movementFeedbackExpiresAtMs = null;
    store.setTemporaryMovementFeedback(null);
  };

  const showMovementSuccessFeedback = (evaluationId: string) => {
    if (handledMovementFeedbackId === evaluationId) return;

    handledMovementFeedbackId = evaluationId;
    clearMovementFeedback();
    store.setTemporaryMovementFeedback(evaluationId);
    movementFeedbackExpiresAtMs =
      audioStore.getBaseRhythmTransportTimeMs() + 1_000;
  };

  const scheduleFrame = () => {
    if (animationFrameId || disposed) return;

    animationFrameId = runtimeDriver.requestFrame(tick);
  };

  const synchronizeSeasonForCurrentDate = () => {
    if (!store.currentDate || store.playbackState === "completed") return;
    void seasonAudio.changeForDate(store.currentDate);
  };

  const getActiveTargetRegion = () => {
    const cycleId = store.activeCycleId;

    return (
      migrationStoryCycleDefinitions.find((cycle) => cycle.label === cycleId)
        ?.wintering ?? null
    );
  };

  const resolveCurrentPhaseMovement = () => {
    const phase = store.currentPhase;
    const timing = movementPhaseTiming.value;

    if (!phase || !timing) return null;

    return resolveMigrationMovement({
      phase,
      direction: getMigrationMovementDirection(phase),
      phaseDurationMs: timing.durationMs,
      targetRegion: getActiveTargetRegion(),
    });
  };

  const selectMovementForCurrentPhase = () => {
    const resolved = resolveCurrentPhaseMovement();

    movement.select(resolved);
    return resolved;
  };

  const prepareRecognitionForCurrentPhase = () => {
    const resolved = resolveCurrentPhaseMovement();

    movementRecognition.prepare(resolved?.recognitionProfile ?? null);
  };

  const getCurrentPhaseElapsedMs = () =>
    Math.max(
      0,
      store.currentElapsedMs - (movementPhaseTiming.value?.startMs ?? 0),
    );

  const getCurrentMovementElapsedMs = () =>
    getCurrentPhaseElapsedMs() +
    (resolveCurrentPhaseMovement()?.playbackTiming.prerollMs ?? 0);

  const getTransportMovementElapsedMs = () =>
    phaseMovementScheduledStartTransportMs === null
      ? getCurrentMovementElapsedMs()
      : Math.max(
          0,
          audioStore.getBaseRhythmTransportTimeMs() -
            phaseMovementScheduledStartTransportMs,
        );

  const startMovementForCurrentPhase = async () => {
    const sessionId = store.playbackSessionId;
    const resolved = selectMovementForCurrentPhase();

    if (!resolved) return;

    const phaseElapsedMs = getCurrentMovementElapsedMs();
    phaseMovementScheduledStartTransportMs =
      audioStore.getBaseRhythmTransportTimeMs() - phaseElapsedMs;

    movementRecognition.start(resolved.recognitionProfile, {
      transportTimeMs: audioStore.getBaseRhythmTransportTimeMs(),
      movementElapsedMs: phaseElapsedMs,
      prerollMs: resolved.playbackTiming.prerollMs,
    });
    await movement.start(resolved, phaseElapsedMs);

    if (
      disposed ||
      sessionId !== store.playbackSessionId ||
      store.playbackState !== "playing" ||
      hasBlockingPause(store.pauseReasons)
    ) {
      movement.pause();
    }
  };

  const prepareCycle = (index: number) => {
    const cycleRun = store.cycleRuns[index];
    if (!cycleRun) throw new Error(`Invalid migration cycle index ${index}.`);

    const points = getMigrationStoryCyclePoints(cycleRun.cycleId);
    const timeline = buildPreparedStoryTimeline(
      points,
      STORY_CYCLE_DURATION_MS,
    );
    const events = createMigrationActEvents(cycleRun, timeline);

    movement.stop();
    store.prepareCycle({ activeCycleIndex: index, timeline, events });
    seasonAudio.prepare(store.currentDate);
    selectMovementForCurrentPhase();
    prepareRecognitionForCurrentPhase();
  };

  const synchronizeAudioForPauseReasons = async () => {
    if (hasBlockingPause(store.pauseReasons)) {
      seasonAudio.pause();
      audioStore.pauseBaseRhythmLoop();
      return;
    }

    if (store.pauseReasons.includes("gesture")) {
      await audioStore.resumeBaseRhythmLoop();
      await seasonAudio.resume();
      return;
    }

    if (store.playbackState === "cycle_transition") {
      await audioStore.resumeBaseRhythmLoop();
      return;
    }

    if (
      store.playbackState === "playing" ||
      store.playbackState === "initial_countdown"
    ) {
      await audioStore.resumeBaseRhythmLoop();
      await seasonAudio.resume();
    }
  };

  const warnEventMismatch = (event: MigrationActEvent) => {
    if (!import.meta.dev) return;

    if (store.currentDate !== event.boundaryDate) {
      console.warn("[MigrationAct] Event date does not match story date.", {
        event: event.eventType,
        eventDate: event.boundaryDate,
        currentDate: store.currentDate,
      });
    }
    if (store.lastMapFrame && store.lastMapFrame.date !== event.boundaryDate) {
      console.warn("[MigrationAct] Event date does not match map point.", {
        event: event.eventType,
        eventDate: event.boundaryDate,
        mapDate: store.lastMapFrame.date,
      });
    }
  };

  const startEventPreviewIfNeeded = () => {
    if (previewEventId || gestures.store.isActive) return;
    const event = store.events.find((item) => item.status === "pending");
    if (!event) return;
    const remainingMs = event.boundaryTimeMs - store.currentElapsedMs;
    const previewDurationMs =
      audioStore.getBeatDurationMs() *
      getMigrationGestureMovementDefinition(event.gestureId).feedbackBeats;
    if (remainingMs <= 0 || remainingMs > previewDurationMs) return;

    const boundaryTransportMs =
      audioStore.getBaseRhythmTransportTimeMs() + remainingMs;
    previewEventId = event.id;
    movement.pause();
    movementRecognition.pause();
    clearMovementFeedback();
    previewResult = gestures.start(event.gestureId, {
      countdownStartTransportMs: boundaryTransportMs - previewDurationMs,
    });
  };

  const completeGestureEvent = async (
    event: MigrationActEvent,
    currentRunId: number,
    preparedResult?: ReturnType<MigrationActGestureService["start"]>,
  ) => {
    const loadTiming = gestures.loadTimings.get(event.gestureId);

    try {
      const result = await (preparedResult ?? gestures.start(event.gestureId));
      if (!isCurrentRun(currentRunId)) return;

      store.setEventStatus(
        event.id,
        result === "completed" ? "completed" : "skipped",
      );
      store.updateDiagnostic(event.id, {
        movementLoadStart: loadTiming?.start ?? null,
        movementLoadEnd: loadTiming?.end ?? null,
        gestureCompleted: clock.now(),
      });
    } catch (error) {
      if (!isCurrentRun(currentRunId)) return;
      store.setEventStatus(event.id, "skipped");
      console.error("[MigrationAct] Gesture failed.", error);
    } finally {
      if (isCurrentRun(currentRunId)) {
        previewEventId = null;
        previewResult = null;
        store.setActiveEvent(null);
        store.removePauseReason("gesture");
        store.updateDiagnostic(event.id, {
          storyResumed: hasBlockingPause(store.pauseReasons)
            ? null
            : clock.now(),
        });

        if (hasBlockingPause(store.pauseReasons)) {
          store.setPlaybackState("paused");
          cancelFrame();
          await synchronizeAudioForPauseReasons();
        } else {
          store.setPlaybackState("playing");
          synchronizeSeasonForCurrentDate();
          void startMovementForCurrentPhase();
          await synchronizeAudioForPauseReasons();
          lastFrameAtMs = null;
          scheduleFrame();
        }
      }
    }
  };

  const triggerEvent = (
    event: MigrationActEvent,
    detectedElapsedMs: number,
  ) => {
    const currentRunId = runId;
    const previousElapsedMs = store.currentElapsedMs;

    movement.pause();
    movementRecognition.pause();
    clearMovementFeedback();
    store.setElapsedMs(event.boundaryTimeMs);
    selectMovementForCurrentPhase();
    prepareRecognitionForCurrentPhase();
    store.setEventStatus(event.id, "triggered");
    store.setActiveEvent(event.id);
    store.addPauseReason("gesture");
    store.setPlaybackState("gesture_lead_in");
    store.addDiagnostic({
      eventId: event.id,
      actId: store.actId ?? surfaceId,
      playbackMode: store.playbackMode,
      cycleId: event.cycleId,
      eventType: event.eventType,
      eventDate: event.boundaryDate,
      boundaryTimeMs: event.boundaryTimeMs,
      previousElapsedMs,
      detectedElapsedMs,
      detectionLatencyMs: Math.max(0, detectedElapsedMs - event.boundaryTimeMs),
      pausedElapsedMs: store.currentElapsedMs,
      pausedDate: store.currentDate,
      movementLoadStart: null,
      movementLoadEnd: null,
      leadInStart: clock.now(),
      movementFirstFrame: null,
      gestureCompleted: null,
      storyResumed: null,
      selectedMapPointDate: store.lastMapFrame?.date ?? null,
    });
    const preparedResult =
      previewEventId === event.id ? (previewResult ?? undefined) : undefined;
    void completeGestureEvent(event, currentRunId, preparedResult);
  };

  const enterCycleTransition = () => {
    const cycleRun = store.activeCycleRun;
    if (!cycleRun) return;

    store.markCycleCompleted(cycleRun.id);

    const hasNextCycle =
      store.playbackMode === "story" &&
      store.activeCycleIndex < store.cycleRuns.length - 1;

    if (!hasNextCycle) {
      store.setPlaybackState("completed");
      movement.stop();
      movementRecognition.reset();
      seasonAudio.reset();
      audioStore.resetBaseRhythmLoop();
      cancelFrame();
      if (act) storyRuntimeStore.completeAct();
      return;
    }

    store.addPauseReason("cycle_transition");
    store.setTransitionRemainingMs(transitionDurationMs);
    store.setPlaybackState("cycle_transition");
    movement.stop();
    movementRecognition.reset();
    seasonAudio.fadeOutForCycle();
  };

  const finishCycleTransition = async () => {
    const nextIndex = store.activeCycleIndex + 1;

    prepareCycle(nextIndex);
    store.removePauseReason("cycle_transition");

    if (hasBlockingPause(store.pauseReasons)) {
      store.setPlaybackState("paused");
      return;
    }

    store.setPlaybackState("playing");
    void startMovementForCurrentPhase();
    await audioStore.resumeBaseRhythmLoop();
    await seasonAudio.start(store.currentDate);
    lastFrameAtMs = null;
  };

  function tick(nowMs: number) {
    animationFrameId = 0;
    if (disposed) return;

    const deltaMs =
      lastFrameAtMs === null ? 0 : Math.max(0, nowMs - lastFrameAtMs);
    lastFrameAtMs = nowMs;

    if (
      movementFeedbackExpiresAtMs !== null &&
      audioStore.getBaseRhythmTransportTimeMs() >= movementFeedbackExpiresAtMs
    ) {
      clearMovementFeedback();
    }

    if (store.playbackState === "initial_countdown") {
      const transportTimeMs = audioStore.getBaseRhythmTransportTimeMs();
      const beatDurationMs = audioStore.getBeatDurationMs();
      const elapsedMs = Math.max(
        0,
        transportTimeMs - (initialCountdownStartTransportMs ?? transportTimeMs),
      );
      const previewDurationMs = beatDurationMs * 3;
      const countdownDurationMs = beatDurationMs * 4;
      const movementElapsedMs =
        elapsedMs >= previewDurationMs
          ? elapsedMs - previewDurationMs
          : elapsedMs % countdownDurationMs;

      movement.tick(movementElapsedMs);
      store.setInitialCountdownNumber(
        Math.max(
          1,
          Math.ceil((countdownDurationMs - elapsedMs) / beatDurationMs),
        ),
      );

      if (elapsedMs >= countdownDurationMs) {
        store.setInitialCountdownNumber(null);
        store.setPlaybackState("playing");
        initialCountdownStartTransportMs = null;
        void startMovementForCurrentPhase();
      }
    } else if (store.playbackState === "playing") {
      if (hasBlockingPause(store.pauseReasons)) {
        store.setPlaybackState("paused");
      } else {
        if (gestures.store.isActive) gestures.tick();
        const previousElapsedMs = store.currentElapsedMs;
        const advance = getMigrationPlaybackAdvance({
          timeline: store.timeline,
          events: store.events,
          previousElapsedMs,
          deltaMs,
        });
        const event = advance.crossedEvent;

        if (event) {
          triggerEvent(event, advance.detectedElapsedMs);
        } else {
          const previousDate = store.currentDate;
          const previousPhase = store.currentPhase;
          store.setElapsedMs(advance.elapsedMs);
          startEventPreviewIfNeeded();
          if (store.currentDate !== previousDate) {
            synchronizeSeasonForCurrentDate();
          }
          if (store.currentPhase !== previousPhase) {
            void startMovementForCurrentPhase();
          } else {
            movement.tick(getTransportMovementElapsedMs());
          }
          if (advance.completed) {
            enterCycleTransition();
          }
        }
      }
    } else if (
      store.playbackState === "gesture_lead_in" ||
      store.playbackState === "gesture_playing"
    ) {
      const frozenElapsedMs = store.currentElapsedMs;
      gestures.tick();
      const diagnostic = store.diagnostics.find(
        (item) => item.eventId === store.activeEventId,
      );
      if (
        diagnostic &&
        diagnostic.movementFirstFrame === null &&
        gestures.store.currentSourceTimeMs > 0
      ) {
        store.updateDiagnostic(diagnostic.eventId, {
          movementFirstFrame: clock.now(),
        });
      }
      store.setPlaybackState(
        gestures.store.state === "waiting-for-lead-in" ||
          gestures.store.state === "loading-movement"
          ? "gesture_lead_in"
          : "gesture_playing",
      );

      if (store.currentElapsedMs !== frozenElapsedMs && import.meta.dev) {
        console.warn("[MigrationAct] Story advanced during a gesture.");
        store.setElapsedMs(frozenElapsedMs);
      }
    } else if (store.playbackState === "cycle_transition") {
      if (!hasBlockingPause(store.pauseReasons)) {
        const remainingMs = Math.max(0, store.transitionRemainingMs - deltaMs);
        store.setTransitionRemainingMs(remainingMs);
        if (remainingMs === 0) void finishCycleTransition();
      }
    }

    if (
      store.playbackState === "playing" ||
      store.playbackState === "initial_countdown" ||
      store.playbackState === "gesture_lead_in" ||
      store.playbackState === "gesture_playing" ||
      store.playbackState === "cycle_transition"
    ) {
      scheduleFrame();
    }
  }

  const initialize = async () => {
    const currentRunId = nextRunId();

    disposed = false;
    cancelFrame();
    store.prepare({ actId: surfaceId, cycleRuns });
    prepareCycle(0);
    store.setPlaybackState("idle");
    if (act) storyEngine.prepareAct(act.id);

    try {
      await Promise.all([gestures.preload(), seasonAudio.preload()]);
      if (!isCurrentRun(currentRunId)) return;
      initialized = true;
    } catch (error) {
      if (!isCurrentRun(currentRunId)) return;
      store.setError(getErrorMessage(error));
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
  };

  const resetForMode = (mode: "story" | "single_cycle", index: number) => {
    nextRunId();
    cancelFrame();
    gestures.cancel();
    previewEventId = null;
    previewResult = null;
    initialCountdownStartTransportMs = null;
    phaseMovementScheduledStartTransportMs = null;
    movement.reset();
    movementRecognition.reset();
    clearMovementFeedback();
    handledMovementFeedbackId = null;
    seasonAudio.reset();
    audioStore.stopBaseRhythmLoop();
    store.prepare({ actId: surfaceId, cycleRuns });
    store.setPlaybackMode(mode);
    prepareCycle(index);
    store.clearPauseReasons();
  };

  const startAtIndex = async (
    mode: "story" | "single_cycle",
    index: number,
  ) => {
    if (!initialized) {
      await Promise.all([gestures.preload(), seasonAudio.preload()]);
      initialized = true;
    }
    resetForMode(mode, index);
    if (act) storyEngine.startAct(act.id);
    await audioStore.startBaseRhythmLoop(0);
    await seasonAudio.start(store.currentDate);
    const resolved = selectMovementForCurrentPhase();
    prepareRecognitionForCurrentPhase();
    if (resolved) await movement.start(resolved, 0);
    initialCountdownStartTransportMs =
      audioStore.getBaseRhythmTransportTimeMs();
    store.setInitialCountdownNumber(4);
    store.setPlaybackState("initial_countdown");
    lastFrameAtMs = null;
    scheduleFrame();
  };

  const startStory = () => startAtIndex("story", 0);

  const startSingleCycle = (cycleRunId: string) => {
    const index = cycleRuns.findIndex((cycle) => cycle.id === cycleRunId);
    if (index < 0) throw new Error(`Unknown cycle run "${cycleRunId}".`);
    return startAtIndex("single_cycle", index);
  };

  const pause = () => {
    if (
      store.playbackState === "initial_countdown" ||
      store.playbackState === "playing"
    ) {
      pausedFromState = store.playbackState;
    }
    store.addPauseReason("user");
    if (!store.isGestureActive && store.playbackState !== "cycle_transition") {
      store.setPlaybackState("paused");
      cancelFrame();
      storyEngine.pauseStory();
    } else if (store.playbackState === "cycle_transition") {
      cancelFrame();
    }
    movement.pause();
    movementRecognition.pause();
    void synchronizeAudioForPauseReasons();
  };

  const resume = async () => {
    store.removePauseReason("user");
    if (store.isGestureActive) {
      await synchronizeAudioForPauseReasons();
      return;
    }
    if (store.playbackState === "cycle_transition") {
      await synchronizeAudioForPauseReasons();
      lastFrameAtMs = null;
      scheduleFrame();
      return;
    }
    if (
      store.playbackState !== "paused" ||
      hasBlockingPause(store.pauseReasons)
    ) {
      return;
    }

    if (pausedFromState === "initial_countdown") {
      store.setPlaybackState("initial_countdown");
      storyEngine.resumeStory();
      await synchronizeAudioForPauseReasons();
      movement.resume(0);
      pausedFromState = null;
      lastFrameAtMs = null;
      scheduleFrame();
      return;
    }

    if (gestures.store.isActive) {
      store.setPlaybackState("playing");
      storyEngine.resumeStory();
      await synchronizeAudioForPauseReasons();
      pausedFromState = null;
      lastFrameAtMs = null;
      scheduleFrame();
      return;
    }

    store.setPlaybackState("playing");
    void startMovementForCurrentPhase();
    storyEngine.resumeStory();
    lastFrameAtMs = null;
    scheduleFrame();
    await synchronizeAudioForPauseReasons();
    pausedFromState = null;
  };

  const reset = async () => {
    nextRunId();
    cancelFrame();
    gestures.cancel();
    previewEventId = null;
    previewResult = null;
    initialCountdownStartTransportMs = null;
    phaseMovementScheduledStartTransportMs = null;
    movement.reset();
    movementRecognition.reset();
    clearMovementFeedback();
    handledMovementFeedbackId = null;
    seasonAudio.reset();
    audioStore.stopBaseRhythmLoop();
    store.prepare({ actId: surfaceId, cycleRuns });
    prepareCycle(0);
    store.setPlaybackState("idle");
    if (act) storyEngine.prepareAct(act.id);
    try {
      await Promise.all([gestures.preload(), seasonAudio.preload()]);
      initialized = true;
    } catch (error) {
      store.setError(getErrorMessage(error));
    }
  };

  const seekToElapsedMs = async (elapsedMs: number) => {
    const wasPlaying = store.playbackState === "playing";

    nextRunId();
    gestures.cancel();
    previewEventId = null;
    previewResult = null;
    phaseMovementScheduledStartTransportMs = null;
    movementRecognition.pause();
    store.setActiveEvent(null);
    store.removePauseReason("gesture");
    store.setElapsedMs(elapsedMs);
    store.replaceEvents(
      reconcileMigrationActEventsForSeek(store.events, store.currentElapsedMs),
    );
    store.seekRevision++;

    if (wasPlaying) void startMovementForCurrentPhase();
    else {
      selectMovementForCurrentPhase();
      prepareRecognitionForCurrentPhase();
    }

    await seasonAudio.seek(store.currentDate);

    if (wasPlaying) {
      lastFrameAtMs = null;
      scheduleFrame();
    }
  };

  const selectCycle = (cycleId: string) => {
    const index = store.cycleRuns.findIndex(
      (cycle) => cycle.cycleId === cycleId,
    );
    if (index < 0) return;

    resetForMode("single_cycle", index);
    store.setPlaybackState("idle");
  };

  const startManualGesture = async (gestureId: "departure" | "arrival") => {
    if (store.playbackState === "playing" || store.isGestureActive) return;

    movement.pause();
    movementRecognition.pause();
    store.addPauseReason("gesture");
    store.setPlaybackState("gesture_lead_in");
    scheduleFrame();
    await gestures.start(gestureId);
    store.removePauseReason("gesture");
    store.setPlaybackState(store.hasUserPause ? "paused" : "idle");
    await synchronizeAudioForPauseReasons();
  };

  const handlePoseFrame = (landmarks: PoseLandmarkLike[] | null) => {
    if (hasBlockingPause(store.pauseReasons)) return;
    gestures.handlePoseFrame(landmarks);
    if (store.playbackState === "playing" && !store.isGestureActive) {
      movementRecognition.handlePoseFrame({
        landmarks,
        transportTimeMs: audioStore.getBaseRhythmTransportTimeMs(),
      });
      const evaluationId = movementRecognition.lastSuccessfulEvaluationId.value;
      if (evaluationId) showMovementSuccessFeedback(evaluationId);
    }
  };

  const reportMapFrame = (frame: MigrationActMapFrame) => {
    store.reportMapFrame(frame);
    const event = activeEvent.value;
    if (event) {
      store.updateDiagnostic(event.id, { selectedMapPointDate: frame.date });
      warnEventMismatch(event);
    }
  };

  const getCurrentMapFrame = () => {
    const cycleId = store.activeCycleId;
    if (!cycleId) return null;

    return getMigrationMapFrame(
      cycleId,
      store.timeline,
      getMigrationStoryCyclePoints(cycleId),
      store.currentElapsedMs,
    );
  };

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      store.addPauseReason("system");
      void synchronizeAudioForPauseReasons();
      cancelFrame();
      movement.pause();
      movementRecognition.pause();
      if (store.playbackState === "playing") store.setPlaybackState("paused");
      return;
    }

    store.removePauseReason("system");
    lastFrameAtMs = null;
    if (store.isGestureActive) {
      void synchronizeAudioForPauseReasons();
      scheduleFrame();
    } else if (store.playbackState === "paused" && !store.hasUserPause) {
      void resume();
    } else if (store.playbackState === "cycle_transition") {
      scheduleFrame();
    }
  }

  const dispose = () => {
    disposed = true;
    nextRunId();
    cancelFrame();
    gestures.cleanup();
    previewEventId = null;
    previewResult = null;
    initialCountdownStartTransportMs = null;
    phaseMovementScheduledStartTransportMs = null;
    movement.cleanup();
    movementRecognition.cleanup();
    clearMovementFeedback();
    seasonAudio.dispose();
    audioStore.stopBaseRhythmLoop();
    storyEngine.stopStoryEngine();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    store.dispose();
  };

  return {
    store,
    gestures,
    movement,
    movementRecognition,
    seasonAudio,
    activeEvent,
    movementPhaseTiming,
    migrationPhaseDurationSeconds,
    initialize,
    startStory,
    startSingleCycle,
    pause,
    resume,
    reset,
    seekToElapsedMs,
    selectCycle,
    startManualGesture,
    handlePoseFrame,
    reportMapFrame,
    getCurrentMapFrame,
    dispose,
  };
};
