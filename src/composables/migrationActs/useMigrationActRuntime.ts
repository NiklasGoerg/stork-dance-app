import { computed } from "vue";
import {
  useMigrationActSeasonAudio,
  type MigrationActSeasonAudioService,
} from "~/composables/migrationActs/useMigrationActSeasonAudio";
import { useMigrationActGestures } from "~/composables/migrationActs/useMigrationActGestures";
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
  buildPreparedStoryTimeline,
  STORY_CYCLE_DURATION_MS,
} from "~/utils/storyCycle";
import { getMigrationStoryCyclePoints } from "~/utils/migrationStoryData";

type MigrationActRuntimeOptions = {
  act?: StoryAct;
  surfaceId?: MigrationActSurfaceId;
  cycleRuns?: MigrationActCycleRun[];
  transitionDurationMs?: number;
  runtimeDriver?: MigrationActRuntimeDriver;
  clock?: MigrationActClock;
  audioService?: MigrationActAudioService;
  gestureService?: MigrationActGestureService;
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
>;

export type MigrationActGestureService = ReturnType<
  typeof useMigrationActGestures
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
  seasonAudioService,
}: MigrationActRuntimeOptions) => {
  const store = useMigrationActStore();
  const audioStore = audioService ?? useAudioStore();
  const storyEngine = useStoryEngine();
  const storyRuntimeStore = useStoryRuntimeStore();
  const gestures = gestureService ?? useMigrationActGestures();
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

  const activeEvent = computed(
    () =>
      store.events.find((event) => event.id === store.activeEventId) ?? null,
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

  const scheduleFrame = () => {
    if (animationFrameId || disposed) return;

    animationFrameId = runtimeDriver.requestFrame(tick);
  };

  const synchronizeSeasonForCurrentDate = () => {
    if (!store.currentDate || store.playbackState === "completed") return;
    void seasonAudio.changeForDate(store.currentDate);
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

    store.prepareCycle({ activeCycleIndex: index, timeline, events });
    seasonAudio.prepare(store.currentDate);
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

    if (store.playbackState === "playing") {
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

  const completeGestureEvent = async (
    event: MigrationActEvent,
    currentRunId: number,
  ) => {
    const loadTiming = gestures.loadTimings.get(event.gestureId);

    try {
      const result = await gestures.start(event.gestureId);
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

    store.setElapsedMs(event.boundaryTimeMs);
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
    void completeGestureEvent(event, currentRunId);
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
      seasonAudio.reset();
      audioStore.resetBaseRhythmLoop();
      cancelFrame();
      if (act) storyRuntimeStore.completeAct();
      return;
    }

    store.addPauseReason("cycle_transition");
    store.setTransitionRemainingMs(transitionDurationMs);
    store.setPlaybackState("cycle_transition");
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

    if (store.playbackState === "playing") {
      if (hasBlockingPause(store.pauseReasons)) {
        store.setPlaybackState("paused");
      } else {
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
          store.setElapsedMs(advance.elapsedMs);
          if (store.currentDate !== previousDate) {
            synchronizeSeasonForCurrentDate();
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
    store.setPlaybackState("playing");
    lastFrameAtMs = null;
    scheduleFrame();
    await audioStore.startBaseRhythmLoop(0);
    await seasonAudio.start(store.currentDate);
  };

  const startStory = () => startAtIndex("story", 0);

  const startSingleCycle = (cycleRunId: string) => {
    const index = cycleRuns.findIndex((cycle) => cycle.id === cycleRunId);
    if (index < 0) throw new Error(`Unknown cycle run "${cycleRunId}".`);
    return startAtIndex("single_cycle", index);
  };

  const pause = () => {
    store.addPauseReason("user");
    if (!store.isGestureActive && store.playbackState !== "cycle_transition") {
      store.setPlaybackState("paused");
      cancelFrame();
      storyEngine.pauseStory();
    } else if (store.playbackState === "cycle_transition") {
      cancelFrame();
    }
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

    store.setPlaybackState("playing");
    storyEngine.resumeStory();
    lastFrameAtMs = null;
    scheduleFrame();
    await synchronizeAudioForPauseReasons();
  };

  const reset = async () => {
    nextRunId();
    cancelFrame();
    gestures.cancel();
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
    store.setActiveEvent(null);
    store.removePauseReason("gesture");
    store.setElapsedMs(elapsedMs);
    store.replaceEvents(
      reconcileMigrationActEventsForSeek(store.events, store.currentElapsedMs),
    );
    store.seekRevision++;

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

    store.addPauseReason("gesture");
    store.setPlaybackState("gesture_lead_in");
    scheduleFrame();
    await gestures.start(gestureId);
    store.removePauseReason("gesture");
    store.setPlaybackState(store.hasUserPause ? "paused" : "idle");
    await synchronizeAudioForPauseReasons();
  };

  const handlePoseFrame = (landmarks: PoseLandmarkLike[] | null) => {
    gestures.handlePoseFrame(landmarks);
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
    seasonAudio,
    activeEvent,
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
