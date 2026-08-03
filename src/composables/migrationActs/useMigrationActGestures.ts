import { computed, ref } from "vue";
import { useMovementPlayback } from "~/composables/useMovementPlayback";
import { usePoseComparison } from "~/composables/usePoseComparison";
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
import type {
  PoseLandmarkLike,
  StablePoseResult,
  StoryPoseId,
} from "~/types/pose";
import { normalizeMovementRecordingToViewport } from "~/utils/movementFrames";

type MovementLoadTiming = {
  start: number;
  end: number;
};

export const useMigrationActGestures = () => {
  const audioStore = useAudioStore();
  const store = useStoryGestureStore();
  const poseLandmarks = ref<PoseLandmarkLike[] | null>(null);
  const freezeCalibration = computed(() =>
    ["attempt-playing", "retry-scheduled", "success-exit"].includes(
      store.state,
    ),
  );
  const poseComparison = usePoseComparison({
    landmarks: poseLandmarks,
    freezeCalibration,
  });
  const movementPlayback = useMovementPlayback();
  const recordings = new Map<StoryGestureId, MovementRecording>();
  const loadTimings = new Map<StoryGestureId, MovementLoadTiming>();
  let disposed = false;

  const preloadGesture = async (gestureId: StoryGestureId) => {
    if (recordings.has(gestureId)) return;

    const startedAt = performance.now();
    const result = await loadGestureMovement(
      getStoryGestureDefinition(gestureId),
    );
    const recording = normalizeMovementRecordingToViewport(result.recording, {
      targetAspect: 1,
    });

    if (disposed) return;

    recordings.set(gestureId, recording);
    loadTimings.set(gestureId, {
      start: startedAt,
      end: performance.now(),
    });
  };

  const preload = async () => {
    await Promise.all([
      preloadGesture("departure"),
      preloadGesture("arrival"),
      audioStore.loadBaseRhythmLoop(),
    ]);
  };

  const start = async (
    gestureId: StoryGestureId,
  ): Promise<StoryGestureResult> => {
    await preloadGesture(gestureId);
    if (disposed) return "cancelled";

    const recording = recordings.get(gestureId);
    if (!recording) return "error";

    const resultPromise = store.startGesture(gestureId);

    movementPlayback.loadRecording(recording);
    movementPlayback.seekToTime(0);

    if (!audioStore.baseRhythmLoop.isPlaying) {
      await audioStore.startBaseRhythmLoop(
        audioStore.baseRhythmLoop.currentOffsetSeconds,
      );
    }

    if (disposed || store.activeGestureId !== gestureId) return "cancelled";

    const transportTimeMs = audioStore.getBaseRhythmTransportTimeMs();
    store.markMovementLoaded(
      "recorded",
      transportTimeMs,
      audioStore.getMsUntilNextBaseRhythmBeat(4),
    );

    return resultPromise;
  };

  const tick = () => {
    if (!store.isActive) return;

    const previousKey = store.movementPlaybackKey;
    const transportTimeMs = audioStore.getBaseRhythmTransportTimeMs();

    store.updateTransportTime(transportTimeMs);
    if (store.movementPlaybackKey !== previousKey) {
      poseComparison.resetStability();
    }

    movementPlayback.seekToTime(store.currentSourceTimeMs);
    store.handlePoseSnapshot({
      stableResults: poseComparison.stableResults.value as Record<
        StoryPoseId,
        StablePoseResult | null
      >,
      hasPoseInput: Boolean(poseLandmarks.value?.length),
      calibration: poseComparison.calibration.value,
    });
  };

  const handlePoseFrame = (landmarks: PoseLandmarkLike[] | null) => {
    poseLandmarks.value = landmarks;
  };

  const cancel = () => {
    store.cancelGesture();
    movementPlayback.stop();
  };

  const cleanup = () => {
    disposed = true;
    store.cleanupGesture();
    movementPlayback.stop();
    recordings.clear();
    loadTimings.clear();
  };

  return {
    store,
    instructorFrame: movementPlayback.currentFrame,
    instructorSourceAspect: computed(() => {
      const source = movementPlayback.recording.value?.source;
      return source?.width && source.height ? source.width / source.height : 1;
    }),
    poseLandmarks,
    loadTimings,
    preload,
    start,
    tick,
    handlePoseFrame,
    cancel,
    cleanup,
  };
};
