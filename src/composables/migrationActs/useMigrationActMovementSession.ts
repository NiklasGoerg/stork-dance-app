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
  getMigrationGestureMovementDefinition,
} from "~/utils/migrationActs/migrationMovementDefinitions";
import { normalizeMovementRecordingToViewport } from "~/utils/movementFrames";

type MovementLoadTiming = { start: number; end: number };

const sampleBufferDurationMs = 2_000;
const diagnosticsIntervalMs = 120;

export const useMigrationActMovementSession = () => {
  const audio = useAudioStore();
  const gestureNarration = useMigrationGestureNarration();
  const store = useStoryGestureStore();
  const playback = useMovementPlayback();
  const skeleton = useSkeletonVisualFeedback();
  const instructorSourceAspect = ref(1);
  const recordings = new Map<StoryGestureId, MovementRecording>();
  const loadTimings = new Map<StoryGestureId, MovementLoadTiming>();

  let definition: ReturnType<
    typeof getMigrationGestureMovementDefinition
  > | null = null;
  let segmentStartTransportMs: number | null = null;
  let samples: TimedMigrationPoseSample[] = [];
  let baseline: MovementPoseBaseline | null = null;
  let checkpointEvaluations: MigrationCheckpointEvaluation[] = [];
  let checkpointIndex = 0;
  let crouchReference: MovementPoseMetrics | undefined;
  let handsUpReference: MovementPoseMetrics | undefined;
  let armsOutReference: MovementPoseMetrics | undefined;
  let collectingPreroll = false;
  let disposed = false;
  let lastDiagnosticsAt = Number.NEGATIVE_INFINITY;
  let lastPoseSampleTimestampMs: number | null = null;
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
    checkpointEvaluations = [];
    checkpointIndex = 0;
    crouchReference = undefined;
    handsUpReference = undefined;
    armsOutReference = undefined;
    collectingPreroll = false;
    lastPoseSampleTimestampMs = null;
    skeleton.resetSkeletonFeedback();
  };

  const beginCountdown = (transportTimeMs: number) => {
    resetAttemptData();
    segmentStartTransportMs = transportTimeMs;
    store.setSessionState({
      state: "waiting-for-lead-in",
      countdownNumber: definition!.feedbackBeats,
      currentSourceTimeMs: 0,
    });
  };

  const beginAttempt = (scheduledStartMs: number) => {
    baseline = collectMovementPoseBaseline(
      samples.filter((sample) => sample.sourceTimeMs <= definition!.prerollMs),
    );
    segmentStartTransportMs = scheduledStartMs;
    checkpointEvaluations = [];
    checkpointIndex = 0;
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
  };

  const getCountdownSourceTime = (
    elapsedMs: number,
    beatDurationMs: number,
  ) => {
    const previewDurationMs = beatDurationMs * (definition!.feedbackBeats - 1);
    collectingPreroll = elapsedMs >= previewDurationMs;
    return collectingPreroll
      ? elapsedMs - previewDurationMs
      : elapsedMs % Math.max(definition!.attemptEndSourceTimeMs, 1);
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
    segmentStartTransportMs =
      result.status === "success"
        ? transportTimeMs
        : transportTimeMs + audio.getMsUntilNextBaseRhythmBeat(1);
    store.setSessionState({
      state: result.status === "success" ? "success-exit" : "retry-scheduled",
      latestEvaluationResult: result,
      canContinue: result.status !== "success" && store.attemptCount >= 2,
      countdownNumber:
        result.status === "success" ? null : definition.feedbackBeats,
    });
    if (result.status === "success") {
      skeleton.triggerBeatSuccess({
        evaluationId: result.id,
        flowId: "migration-gesture",
        flowStepId: result.gestureId,
        measureIndex: result.attemptNumber,
        beatIndex: 4,
        result: "passed",
        pulseDurationMs: 300,
      });
    } else resetAttemptData();
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
      const elapsedMs = Math.max(0, transportTimeMs - segmentStartTransportMs);
      if (
        store.state === "retry-scheduled" &&
        store.latestEvaluationResult?.status === "success"
      )
        return;
      const durationMs = beatDurationMs * definition.feedbackBeats;
      const sourceTimeMs = getCountdownSourceTime(elapsedMs, beatDurationMs);
      store.setSessionState({
        currentSourceTimeMs: sourceTimeMs,
        countdownNumber: Math.max(
          1,
          Math.ceil((durationMs - elapsedMs) / beatDurationMs),
        ),
      });
      playback.seekToTime(sourceTimeMs);
      if (elapsedMs >= durationMs) {
        beginAttempt(
          segmentStartTransportMs +
            beatDurationMs * (definition.feedbackBeats - 1),
        );
      }
    } else if (store.state === "attempt-playing") {
      const sourceTimeMs = Math.max(
        0,
        transportTimeMs - segmentStartTransportMs,
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
        showResult(transportTimeMs);
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
    options: { countdownStartTransportMs?: number } = {},
  ): Promise<StoryGestureResult> => {
    await preloadGesture(id);
    if (disposed) return "cancelled";
    const recording = recordings.get(id);
    if (!recording) return "error";
    definition = getMigrationGestureMovementDefinition(id);
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
    beginCountdown(countdownStartMs);
    const result = await resultPromise;
    resetAttemptData();
    playback.stop();
    definition = null;
    segmentStartTransportMs = null;
    return result;
  };

  const handlePoseFrame = (landmarks: PoseLandmarkLike[] | null) => {
    if (!landmarks?.length || !store.isActive) return;
    if (store.state !== "attempt-playing" && !collectingPreroll) return;
    samples.push({ sourceTimeMs: store.currentSourceTimeMs, landmarks });
    lastPoseSampleTimestampMs = store.currentSourceTimeMs;
  };

  const cancel = () => store.cancelGesture();
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
    loadTimings,
    skeletonFeedbackState: skeleton.skeletonFeedbackState,
    pulseProgress: skeleton.pulseProgress,
    preload,
    start,
    tick,
    handlePoseFrame,
    cancel,
    cleanup,
  };
};
