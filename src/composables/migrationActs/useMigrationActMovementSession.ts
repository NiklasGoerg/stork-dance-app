import { computed, ref } from "vue";
import { useMigrationGestureNarration } from "~/composables/migrationActs/useMigrationGestureNarration";
import { useMovementPlayback } from "~/composables/useMovementPlayback";
import { useSkeletonVisualFeedback } from "~/composables/useSkeletonVisualFeedback";
import { buildMigrationGestureDiagnostics } from "~/composables/migrationActs/useMigrationGestureDiagnostics";
import { loadGestureMovement } from "~/story/gestureMovements";
import {
  getStoryGestureDefinition,
  type StoryGestureId,
} from "~/story/gestures";
import { useAudioStore } from "~/store/audioStore";
import {
  useStoryGestureStore,
  type StoryGestureResult,
} from "~/store/storyGestureStore";
import type { MovementRecording } from "~/types/movement";
import type { PoseLandmarkLike } from "~/types/pose";
import {
  buildMigrationGestureResult,
  collectMovementPoseBaseline,
  evaluateMigrationCheckpoint,
  type MigrationCheckpointEvaluation,
  type MovementPoseBaseline,
  type MovementPoseMetrics,
  type TimedMigrationPoseSample,
} from "~/utils/migrationActs/migrationMovementEvaluation";
import {
  getMigrationCheckpointWindow,
  getMigrationGestureBeatForCheckpoint,
  getMigrationGestureMovementDefinition,
  resolveGestureCountdownSourceTime,
} from "~/utils/migrationActs/migrationMovementDefinitions";
import { normalizeMovementRecordingToViewport } from "~/utils/movementFrames";
import { resolveNextGuidedBarBoundary } from "~/utils/act2/guidedTiming";

type MovementLoadTiming = { start: number; end: number };
type GestureStartOptions = {
  countdownStartTransportMs?: number;
  preparationBars?: number;
  handoverStartBarOffsetMs?: number;
  onPreparationBar?: (barIndex: number) => void;
  onCountdown?: (count: number) => void;
  onHandoverStart?: () => void;
  onAttemptStart?: () => void;
  autoProgressEnabled?: () => boolean;
};

const sampleBufferDurationMs = 2_000;
const diagnosticsIntervalMs = 120;

export const useMigrationActMovementSession = () => {
  const audio = useAudioStore();
  const gestureNarration = useMigrationGestureNarration();
  const store = useStoryGestureStore();
  const playback = useMovementPlayback();
  const skeleton = useSkeletonVisualFeedback();
  const instructorSourceAspect = ref(1);
  const demonstrationActive = ref(false);
  const demonstrationSourceTimeMs = ref(0);
  const recordings = new Map<StoryGestureId, MovementRecording>();
  const loadTimings = new Map<StoryGestureId, MovementLoadTiming>();

  let definition: ReturnType<
    typeof getMigrationGestureMovementDefinition
  > | null = null;
  let segmentStartTransportMs: number | null = null;
  let samples: TimedMigrationPoseSample[] = [];
  let baseline: MovementPoseBaseline | null = null;
  let baselineSamples: TimedMigrationPoseSample[] = [];
  let checkpointEvaluations: MigrationCheckpointEvaluation[] = [];
  let checkpointIndex = 0;
  let crouchReference: MovementPoseMetrics | undefined;
  let handsUpReference: MovementPoseMetrics | undefined;
  let armsOutReference: MovementPoseMetrics | undefined;
  let collectingPreroll = false;
  let disposed = false;
  let lastDiagnosticsAt = Number.NEGATIVE_INFINITY;
  let lastPoseSampleTimestampMs: number | null = null;
  let demonstrationDefinition: ReturnType<
    typeof getMigrationGestureMovementDefinition
  > | null = null;
  let demonstrationStartTransportMs: number | null = null;
  let demonstrationResolver: (() => void) | null = null;
  let gestureSessionId = 0;
  let activeAttemptStarted = false;
  let preparationBars = 0;
  let activePreparationBar = 0;
  let activeCountdownValue: number | null = null;
  let onPreparationBar: ((barIndex: number) => void) | null = null;
  let onCountdown: ((count: number) => void) | null = null;
  let handoverStartBarOffsetMs = 0;
  let handoverStarted = false;
  let onHandoverStart: (() => void) | null = null;
  let onAttemptStart: (() => void) | null = null;
  let isAutoProgressEnabled: (() => boolean) | null = null;
  let attemptBeat1TransportMs: number | null = null;
  let baselineCollectionStartMs: number | null = null;
  let baselineCollectionEndMs: number | null = null;
  const publishedCheckpointFeedbackIds = new Set<string>();
  let publishedFailedCheckpointFeedback = false;
  const preloadGesture = async (id: StoryGestureId) => {
    if (recordings.has(id)) return;
    const startedAt = performance.now();
    const loaded = await loadGestureMovement(getStoryGestureDefinition(id));
    const recording = normalizeMovementRecordingToViewport(loaded.recording, {
      targetAspect: 1,
    });
    if (disposed) return;
    recordings.set(id, recording);
    loadTimings.set(id, { start: startedAt, end: performance.now() });
  };

  const preload = () =>
    Promise.all([
      preloadGesture("departure"),
      preloadGesture("arrival"),
      audio.loadBaseRhythmLoop(),
    ]).then(() => undefined);

  const resetAttemptData = () => {
    samples = [];
    baseline = null;
    baselineSamples = [];
    checkpointEvaluations = [];
    checkpointIndex = 0;
    publishedCheckpointFeedbackIds.clear();
    publishedFailedCheckpointFeedback = false;
    crouchReference = undefined;
    handsUpReference = undefined;
    armsOutReference = undefined;
    collectingPreroll = false;
    activeAttemptStarted = false;
    activePreparationBar = 0;
    activeCountdownValue = null;
    handoverStarted = false;
    attemptBeat1TransportMs = null;
    baselineCollectionStartMs = null;
    baselineCollectionEndMs = null;
    lastPoseSampleTimestampMs = null;
    skeleton.resetSkeletonFeedback();
  };

  const beginCountdown = (
    transportTimeMs: number,
    options: Pick<
      GestureStartOptions,
      | "preparationBars"
      | "handoverStartBarOffsetMs"
      | "onPreparationBar"
      | "onCountdown"
      | "onHandoverStart"
      | "onAttemptStart"
      | "autoProgressEnabled"
    > = {},
  ) => {
    resetAttemptData();
    segmentStartTransportMs = transportTimeMs;
    preparationBars = Math.max(0, Math.round(options.preparationBars ?? 0));
    onPreparationBar = options.onPreparationBar ?? null;
    onCountdown = options.onCountdown ?? null;
    handoverStartBarOffsetMs = Math.max(
      0,
      options.handoverStartBarOffsetMs ?? 0,
    );
    onHandoverStart = options.onHandoverStart ?? null;
    onAttemptStart = options.onAttemptStart ?? null;
    isAutoProgressEnabled = options.autoProgressEnabled ?? null;
    store.setSessionState({
      state: "waiting-for-lead-in",
      countdownNumber: null,
      currentSourceTimeMs: definition!.prerollMs,
    });
    if (preparationBars > 0) {
      activePreparationBar = 1;
      onPreparationBar?.(1);
    }
  };

  const beginAttempt = (scheduledStartMs: number) => {
    if (activeAttemptStarted) return;
    activeAttemptStarted = true;
    baselineCollectionEndMs = scheduledStartMs;
    baseline = collectMovementPoseBaseline(baselineSamples);
    segmentStartTransportMs = scheduledStartMs;
    attemptBeat1TransportMs = scheduledStartMs;
    samples = [];
    checkpointEvaluations = [];
    checkpointIndex = 0;
    publishedCheckpointFeedbackIds.clear();
    publishedFailedCheckpointFeedback = false;
    crouchReference = undefined;
    handsUpReference = undefined;
    armsOutReference = undefined;
    collectingPreroll = false;
    store.setSessionState({
      state: "attempt-playing",
      attemptCount: store.attemptCount + 1,
      countdownNumber: null,
      latestEvaluationResult: null,
      canContinue: false,
      currentSourceTimeMs: definition!.prerollMs,
    });
    onAttemptStart?.();
  };

  const getCountdownSourceTime = (
    elapsedMs: number,
    beatDurationMs: number,
  ) => {
    const durationMs = beatDurationMs * definition!.feedbackBeats;
    return resolveGestureCountdownSourceTime({
      definition: definition!,
      elapsedMs,
      durationMs,
    });
  };

  const publishCountdownValue = (count: number | null) => {
    if (activeCountdownValue === count) return;
    activeCountdownValue = count;
    if (count !== null) onCountdown?.(count);
  };

  const publishCheckpointFeedback = (
    evaluation: MigrationCheckpointEvaluation,
  ) => {
    const beat = getMigrationGestureBeatForCheckpoint(evaluation.checkpointId);
    if (!beat || publishedCheckpointFeedbackIds.has(evaluation.checkpointId)) {
      return;
    }

    publishedCheckpointFeedbackIds.add(evaluation.checkpointId);
    if (evaluation.status === "not_evaluable") return;

    const result = evaluation.status === "success" ? "passed" : "failed";
    if (result === "failed") {
      publishedFailedCheckpointFeedback = true;
    }

    skeleton.triggerBeatFeedback({
      evaluationId: `${gestureSessionId}:${store.activeGestureId}:${store.attemptCount}:checkpoint:${evaluation.checkpointId}`,
      flowId: "migration-gesture",
      flowStepId: store.activeGestureId ?? "gesture",
      measureIndex: store.attemptCount,
      beatIndex: beat,
      result,
      pulseDurationMs: 300,
    });
  };

  const rememberReferences = (evaluation: MigrationCheckpointEvaluation) => {
    if (!evaluation.selectedPose) return;
    if (
      evaluation.criteria.some((item) => item.criterion === "moderate_crouch")
    ) {
      crouchReference = evaluation.selectedPose;
    }
    if (evaluation.criteria.some((item) => item.criterion === "arms_out")) {
      armsOutReference = evaluation.selectedPose;
    }
    if (evaluation.criteria.some((item) => item.criterion === "hands_up")) {
      handsUpReference = evaluation.selectedPose;
    }
  };

  const evaluateClosedCheckpoints = (sourceTimeMs: number) => {
    while (definition && checkpointIndex < definition.checkpoints.length) {
      const checkpoint = definition.checkpoints[checkpointIndex]!;
      if (sourceTimeMs < getMigrationCheckpointWindow(checkpoint).endMs) return;
      const evaluation = evaluateMigrationCheckpoint({
        checkpoint,
        samples,
        baseline,
        references: {
          crouch: crouchReference,
          handsUp: handsUpReference,
          armsOut: armsOutReference,
        },
      });
      checkpointEvaluations.push(evaluation);
      rememberReferences(evaluation);
      publishCheckpointFeedback(evaluation);
      checkpointIndex++;
    }
  };

  const showResult = (transportTimeMs: number, forcedSuccess = false) => {
    if (!definition || !store.activeGestureId) return;
    const result = forcedSuccess
      ? buildMigrationGestureResult(
          store.activeGestureId,
          store.attemptCount,
          [],
        )
      : buildMigrationGestureResult(
          store.activeGestureId,
          store.attemptCount,
          checkpointEvaluations,
        );
    result.id = `${result.id}-${store.startedAt ?? 0}`;
    const beatDurationMs = audio.getBeatDurationMs();
    segmentStartTransportMs =
      result.status === "success"
        ? resolveNextGuidedBarBoundary(transportTimeMs, beatDurationMs, true) -
          beatDurationMs
        : transportTimeMs + audio.getMsUntilNextBaseRhythmBeat(1);
    store.setSessionState({
      state: result.status === "success" ? "success-exit" : "retry-scheduled",
      latestEvaluationResult: result,
      canContinue: result.status !== "success" && store.attemptCount >= 2,
      countdownNumber:
        result.status === "success" ? null : definition.feedbackBeats,
    });
    if (result.status === "success") {
      skeleton.triggerBeatFeedback({
        evaluationId: `${gestureSessionId}:${result.gestureId}:${result.attemptNumber}:beat:4`,
        flowId: "migration-gesture",
        flowStepId: result.gestureId,
        measureIndex: result.attemptNumber,
        beatIndex: 4,
        result: "passed",
        pulseDurationMs: 300,
      });
    } else {
      const shouldPublishAttemptFailure =
        result.status === "failed" && !publishedFailedCheckpointFeedback;
      resetAttemptData();
      if (shouldPublishAttemptFailure) {
        skeleton.triggerBeatFeedback({
          evaluationId: `${gestureSessionId}:${result.gestureId}:${result.attemptNumber}:attempt`,
          flowId: "migration-gesture",
          flowStepId: result.gestureId,
          measureIndex: result.attemptNumber,
          beatIndex: 4,
          result: "failed",
          pulseDurationMs: 300,
        });
      }
      preparationBars = 0;
      onPreparationBar = null;
    }
  };

  const updateDiagnostics = (transportTimeMs: number) => {
    if (
      !import.meta.dev ||
      transportTimeMs - lastDiagnosticsAt < diagnosticsIntervalMs
    )
      return;
    lastDiagnosticsAt = transportTimeMs;
    const checkpoint = definition?.checkpoints[checkpointIndex] ?? null;
    store.setDiagnostics(
      buildMigrationGestureDiagnostics({
        transportTimeMs,
        scheduledStartMs: segmentStartTransportMs,
        sourceTimeMs: store.currentSourceTimeMs,
        attemptBeat1TransportMs,
        attemptBeat1SourceTimeMs:
          store.state === "attempt-playing" && definition
            ? definition.prerollMs
            : null,
        baselineCollectionStartMs,
        baselineCollectionEndMs,
        attemptStarted: activeAttemptStarted,
        attemptCount: store.attemptCount,
        poseSampleTimestampMs: lastPoseSampleTimestampMs,
        checkpoint,
        samples,
        baseline,
        references: {
          crouch: crouchReference,
          handsUp: handsUpReference,
          armsOut: armsOutReference,
        },
        evaluations: checkpointEvaluations,
      }),
    );
  };

  const tick = () => {
    if (
      demonstrationActive.value &&
      demonstrationDefinition &&
      demonstrationStartTransportMs !== null
    ) {
      const sourceTimeMs = Math.max(
        0,
        audio.getBaseRhythmTransportTimeMs() - demonstrationStartTransportMs,
      );
      demonstrationSourceTimeMs.value = Math.min(
        sourceTimeMs,
        demonstrationDefinition.attemptEndSourceTimeMs,
      );
      playback.seekToTime(demonstrationSourceTimeMs.value);
      if (sourceTimeMs >= demonstrationDefinition.attemptEndSourceTimeMs) {
        demonstrationActive.value = false;
        demonstrationDefinition = null;
        demonstrationStartTransportMs = null;
        playback.stop();
        const resolve = demonstrationResolver;
        demonstrationResolver = null;
        resolve?.();
      }
      return;
    }

    if (!definition || segmentStartTransportMs === null || !store.isActive)
      return;
    const transportTimeMs = audio.getBaseRhythmTransportTimeMs();
    const beatDurationMs = audio.getBeatDurationMs();
    const control = store.consumeControlRequest();
    if (control === "success") showResult(transportTimeMs, true);
    if (control === "retry") showResult(transportTimeMs);

    if (
      store.state === "waiting-for-lead-in" ||
      store.state === "retry-scheduled"
    ) {
      const scheduledElapsedMs = transportTimeMs - segmentStartTransportMs;
      if (scheduledElapsedMs < 0) {
        store.setSessionState({ countdownNumber: null });
        publishCountdownValue(null);
        playback.seekToTime(definition.prerollMs);
        updateDiagnostics(transportTimeMs);
        return;
      }
      const elapsedMs = scheduledElapsedMs;
      if (
        store.state === "retry-scheduled" &&
        store.latestEvaluationResult?.status === "success"
      )
        return;
      const durationMs = beatDurationMs * definition.feedbackBeats;
      const preparationDurationMs = preparationBars * durationMs;
      const totalDurationMs = preparationDurationMs + durationMs;
      const preparationBar =
        preparationBars > 0 && elapsedMs < preparationDurationMs
          ? Math.floor(elapsedMs / durationMs) + 1
          : 0;
      if (preparationBar > 0 && preparationBar !== activePreparationBar) {
        activePreparationBar = preparationBar;
        onPreparationBar?.(preparationBar);
      }
      const countdownElapsedMs = elapsedMs - preparationDurationMs;
      if (!handoverStarted && countdownElapsedMs >= handoverStartBarOffsetMs) {
        handoverStarted = true;
        onHandoverStart?.();
      }
      const sourceTimeMs = getCountdownSourceTime(
        ((elapsedMs % durationMs) + durationMs) % durationMs,
        beatDurationMs,
      );
      const countdownNumber =
        countdownElapsedMs >= 0 && countdownElapsedMs < durationMs
          ? Math.max(
              1,
              Math.ceil((durationMs - countdownElapsedMs) / beatDurationMs),
            )
          : null;
      // The first-introduction baseline comes from the passive watch bars.
      // Known gestures have no watch bars, so their countdown remains the
      // only safe pre-attempt sampling window.
      collectingPreroll =
        preparationBars > 0 ? preparationBar > 0 : countdownNumber !== null;
      if (collectingPreroll) {
        baselineCollectionStartMs ??= transportTimeMs;
      }
      publishCountdownValue(countdownNumber);
      store.setSessionState({
        currentSourceTimeMs: sourceTimeMs,
        countdownNumber,
      });
      playback.seekToTime(sourceTimeMs);
      if (elapsedMs >= totalDurationMs) {
        beginAttempt(segmentStartTransportMs + totalDurationMs);
      }
    } else if (store.state === "attempt-playing") {
      const sourceTimeMs = Math.max(
        definition.prerollMs,
        definition.prerollMs + transportTimeMs - segmentStartTransportMs,
      );
      store.setSessionState({ currentSourceTimeMs: sourceTimeMs });
      playback.seekToTime(sourceTimeMs);
      samples = samples.filter(
        (sample) =>
          sample.sourceTimeMs >= sourceTimeMs - sampleBufferDurationMs,
      );
      evaluateClosedCheckpoints(sourceTimeMs);
      if (sourceTimeMs >= definition.attemptEndSourceTimeMs) {
        evaluateClosedCheckpoints(Number.POSITIVE_INFINITY);
        showResult(transportTimeMs, isAutoProgressEnabled?.() === true);
      }
    } else if (store.state === "success-exit") {
      if (transportTimeMs - segmentStartTransportMs >= beatDurationMs) {
        store.finishGesture("completed");
      }
    }
    updateDiagnostics(transportTimeMs);
  };

  const start = async (
    id: StoryGestureId,
    options: GestureStartOptions = {},
  ): Promise<StoryGestureResult> => {
    await preloadGesture(id);
    if (disposed) return "cancelled";
    const recording = recordings.get(id);
    if (!recording) return "error";
    definition = getMigrationGestureMovementDefinition(id);
    gestureSessionId++;
    const resultPromise = store.startGesture(id);
    playback.loadRecording(recording);
    instructorSourceAspect.value =
      recording.source?.width && recording.source.height
        ? recording.source.width / recording.source.height
        : 1;
    if (!audio.baseRhythmLoop.isPlaying) {
      await audio.startBaseRhythmLoop(
        audio.baseRhythmLoop.currentOffsetSeconds,
      );
    }
    const transportTimeMs = audio.getBaseRhythmTransportTimeMs();
    const countdownStartMs =
      options.countdownStartTransportMs ??
      transportTimeMs + audio.getMsUntilNextBaseRhythmBeat(1);
    store.setSessionState({
      movementLoaded: true,
      movementPlaybackSource: "recorded",
    });
    beginCountdown(countdownStartMs, options);
    const result = await resultPromise;
    resetAttemptData();
    playback.stop();
    definition = null;
    segmentStartTransportMs = null;
    onPreparationBar = null;
    onCountdown = null;
    onHandoverStart = null;
    onAttemptStart = null;
    isAutoProgressEnabled = null;
    return result;
  };

  const demonstrate = async (id: StoryGestureId) => {
    await preloadGesture(id);
    if (disposed || store.isActive) return;
    const recording = recordings.get(id);
    if (!recording) return;

    const nextDefinition = getMigrationGestureMovementDefinition(id);
    playback.loadRecording(recording);
    instructorSourceAspect.value =
      recording.source?.width && recording.source.height
        ? recording.source.width / recording.source.height
        : 1;
    if (!audio.baseRhythmLoop.isPlaying) {
      await audio.startBaseRhythmLoop(
        audio.baseRhythmLoop.currentOffsetSeconds,
      );
    }

    const transportTimeMs = audio.getBaseRhythmTransportTimeMs();
    const beatDurationMs = audio.getBeatDurationMs();
    let untilBeatOneMs = audio.getMsUntilNextBaseRhythmBeat(1);
    if (untilBeatOneMs < nextDefinition.prerollMs) {
      untilBeatOneMs += beatDurationMs * nextDefinition.feedbackBeats;
    }
    demonstrationDefinition = nextDefinition;
    demonstrationStartTransportMs =
      transportTimeMs + untilBeatOneMs - nextDefinition.prerollMs;
    demonstrationSourceTimeMs.value = 0;
    demonstrationActive.value = true;
    playback.seekToTime(0);

    return new Promise<void>((resolve) => {
      demonstrationResolver = resolve;
    });
  };

  const handlePoseFrame = (landmarks: PoseLandmarkLike[] | null) => {
    if (!landmarks?.length || !store.isActive) return;
    if (collectingPreroll) {
      baselineSamples.push({
        sourceTimeMs: store.currentSourceTimeMs,
        landmarks,
      });
      lastPoseSampleTimestampMs = store.currentSourceTimeMs;
      return;
    }
    if (store.state !== "attempt-playing") return;
    samples.push({ sourceTimeMs: store.currentSourceTimeMs, landmarks });
    lastPoseSampleTimestampMs = store.currentSourceTimeMs;
  };

  const forceComplete = () => {
    if (!definition || !store.isActive) return false;
    resetAttemptData();
    showResult(audio.getBaseRhythmTransportTimeMs(), true);
    return true;
  };

  const shiftTransportAnchors = (deltaMs: number) => {
    if (!Number.isFinite(deltaMs) || deltaMs === 0) return;

    if (segmentStartTransportMs !== null) segmentStartTransportMs += deltaMs;
    if (demonstrationStartTransportMs !== null) {
      demonstrationStartTransportMs += deltaMs;
    }
    if (attemptBeat1TransportMs !== null) attemptBeat1TransportMs += deltaMs;
    if (baselineCollectionStartMs !== null) {
      baselineCollectionStartMs += deltaMs;
    }
    if (baselineCollectionEndMs !== null) baselineCollectionEndMs += deltaMs;
  };

  const cancel = () => {
    store.cancelGesture();
    demonstrationActive.value = false;
    demonstrationSourceTimeMs.value = 0;
    demonstrationDefinition = null;
    demonstrationStartTransportMs = null;
    const resolve = demonstrationResolver;
    demonstrationResolver = null;
    resolve?.();
  };
  const cleanup = () => {
    disposed = true;
    gestureNarration.cleanup();
    store.cleanupGesture();
    playback.stop();
    recordings.clear();
    resetAttemptData();
  };

  return {
    store,
    instructorFrame: playback.currentFrame,
    instructorSourceAspect: computed(() => instructorSourceAspect.value),
    demonstrationActive,
    demonstrationSourceTimeMs,
    loadTimings,
    skeletonFeedbackState: skeleton.skeletonFeedbackState,
    pulseProgress: skeleton.pulseProgress,
    preload,
    start,
    demonstrate,
    tick,
    handlePoseFrame,
    forceComplete,
    shiftTransportAnchors,
    setNarrationEnabled: gestureNarration.setEnabled,
    cancel,
    cleanup,
  };
};
