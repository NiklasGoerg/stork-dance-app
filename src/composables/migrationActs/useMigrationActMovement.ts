import { computed, ref } from "vue";
import { useMovementPlayback } from "~/composables/useMovementPlayback";
import type { ResolvedMigrationMovement } from "~/types/migrationAct";
import type { MovementRecording } from "~/types/movement";
import { normalizeMovementRecordingToViewport } from "~/utils/movementFrames";
import { migrationMovementRecognitionConfig } from "~/utils/migrationActs/migrationMovementConfig";
import {
  getMovementRecordingDurationMs,
  resolveMovementPlaybackPosition,
} from "~/utils/movementPlaybackTiming";

const movementLoaders = import.meta.glob<MovementRecording>(
  "../../assets/movement_library/migration/*.json",
  { import: "default" },
);

export const useMigrationActMovement = () => {
  const playback = useMovementPlayback();
  const resolvedMovement = ref<ResolvedMigrationMovement | null>(null);
  const movementLoaded = ref(false);
  const movementPlaying = ref(false);
  const movementLoopCount = ref(0);
  const movementSourceFps = ref<number | null>(null);
  const movementFrameCount = ref(0);
  const movementSourceDurationMs = ref(0);
  const movementPrerollMs = ref(0);
  const movementLoopStartMs = ref(0);
  const movementLoopEndMs = ref(0);
  const movementSourceTimeMs = ref(0);
  const movementLoadError = ref<string | null>(null);
  const sourceAspect = ref(1);
  const cachedRecordings = new Map<string, MovementRecording>();
  const warnedMovementIds = new Set<string>();

  let loadedMovementId: string | null = null;
  let activeLoadRevision = 0;

  const recognitionEnabled = computed(() => {
    const profile = resolvedMovement.value?.recognitionProfile;

    return profile
      ? migrationMovementRecognitionConfig[profile].enabled
      : false;
  });

  const instructorFrame = computed(() =>
    movementLoaded.value ? playback.currentFrame.value : null,
  );

  const warnUnavailable = (movementId: string, error?: unknown) => {
    if (!import.meta.dev || warnedMovementIds.has(movementId)) return;

    warnedMovementIds.add(movementId);
    console.warn(
      `[MigrationAct] Phase movement "${movementId}" could not be loaded from assets/movement_library/migration/${movementId}.json; story playback will continue without it.`,
      error ??
        "Add the matching JSON file to assets/movement_library/migration.",
    );
  };

  const loadMovement = async (movementId: string) => {
    const cached = cachedRecordings.get(movementId);
    if (cached) return cached;

    const path = `../../assets/movement_library/migration/${movementId}.json`;
    const loader = movementLoaders[path];

    if (!loader) {
      movementLoadError.value = `Movement "${movementId}" is unavailable.`;
      warnUnavailable(movementId);
      return null;
    }

    try {
      const recording = normalizeMovementRecordingToViewport(await loader(), {
        targetAspect: 1,
      });
      cachedRecordings.set(movementId, recording);
      movementLoadError.value = null;
      return recording;
    } catch (error) {
      movementLoadError.value =
        error instanceof Error
          ? error.message
          : `Failed to load ${movementId}.`;
      warnUnavailable(movementId, error);
      return null;
    }
  };

  const preload = async (movement: ResolvedMigrationMovement) =>
    Boolean(await loadMovement(movement.movementId));

  const select = (movement: ResolvedMigrationMovement | null) => {
    if (resolvedMovement.value?.movementId === movement?.movementId) {
      resolvedMovement.value = movement;
      return;
    }

    activeLoadRevision++;
    playback.stop();
    resolvedMovement.value = movement;
    loadedMovementId = null;
    movementLoaded.value = false;
    movementPlaying.value = false;
    movementLoopCount.value = 0;
    movementSourceFps.value = null;
    movementFrameCount.value = 0;
    movementSourceDurationMs.value = 0;
    movementPrerollMs.value = 0;
    movementLoopStartMs.value = 0;
    movementLoopEndMs.value = 0;
    movementSourceTimeMs.value = 0;
    sourceAspect.value = 1;
  };

  const tick = (phaseElapsedMs: number) => {
    const movement = resolvedMovement.value;
    const recording = playback.recording.value;

    if (!movementPlaying.value || !movement || !recording) return;

    const durationMs = getMovementRecordingDurationMs(recording);
    const elapsedMs = Math.max(0, phaseElapsedMs);
    const position = resolveMovementPlaybackPosition({
      elapsedMs,
      sourceDurationMs: durationMs,
      timing: movement.playbackTiming,
    });

    movementLoopCount.value = movement.loop ? position.loopCount : 0;
    movementSourceTimeMs.value = movement.loop
      ? position.sourceTimeMs
      : Math.min(elapsedMs, durationMs);
    playback.seekToTime(movementSourceTimeMs.value);
  };

  const activate = (
    movement: ResolvedMigrationMovement,
    phaseElapsedMs = 0,
  ) => {
    select(movement);
    movementSourceFps.value = movement.playbackTiming.sourceFps;
    movementPrerollMs.value = movement.playbackTiming.prerollMs;
    movementLoopStartMs.value = movement.playbackTiming.loopStartMs;
    movementLoopEndMs.value = movement.playbackTiming.loopEndMs;
    const recording = cachedRecordings.get(movement.movementId) ?? null;
    if (!recording) {
      movementLoaded.value = false;
      movementPlaying.value = false;
      movementLoadError.value = `Movement "${movement.movementId}" was not preloaded.`;
      return false;
    }

    if (loadedMovementId !== movement.movementId) {
      playback.loadRecording(recording);
      loadedMovementId = movement.movementId;
      sourceAspect.value =
        recording.source?.width && recording.source.height
          ? recording.source.width / recording.source.height
          : 1;
    }

    movementLoaded.value = true;
    movementPlaying.value = true;
    movementSourceFps.value = recording.fps;
    movementFrameCount.value = recording.frames.length;
    movementSourceDurationMs.value = getMovementRecordingDurationMs(recording);
    movementPrerollMs.value = movement.playbackTiming.prerollMs;
    movementLoopStartMs.value = movement.playbackTiming.loopStartMs;
    movementLoopEndMs.value = Math.min(
      movement.playbackTiming.loopEndMs,
      movementSourceDurationMs.value,
    );
    tick(phaseElapsedMs);
    return true;
  };

  const start = async (
    movement: ResolvedMigrationMovement,
    phaseElapsedMs = 0,
  ) => {
    const revision = activeLoadRevision;
    const loaded = await preload(movement);
    if (!loaded || revision !== activeLoadRevision) return false;
    return activate(movement, phaseElapsedMs);
  };

  const pause = () => {
    movementPlaying.value = false;
    playback.pause();
  };

  const resume = (phaseElapsedMs: number) => {
    if (!movementLoaded.value || !resolvedMovement.value) return;

    movementPlaying.value = true;
    tick(phaseElapsedMs);
  };

  const stop = () => {
    activeLoadRevision++;
    movementLoaded.value = false;
    movementPlaying.value = false;
    movementLoopCount.value = 0;
    movementSourceFps.value = null;
    movementFrameCount.value = 0;
    movementSourceDurationMs.value = 0;
    movementPrerollMs.value = 0;
    movementLoopStartMs.value = 0;
    movementLoopEndMs.value = 0;
    movementSourceTimeMs.value = 0;
    movementLoadError.value = null;
    playback.stop();
  };

  const reset = () => {
    stop();
    resolvedMovement.value = null;
    loadedMovementId = null;
    movementLoaded.value = false;
    sourceAspect.value = 1;
  };

  const cleanup = () => {
    reset();
    cachedRecordings.clear();
  };

  return {
    resolvedMovement,
    instructorFrame,
    sourceAspect,
    movementLoaded,
    movementPlaying,
    movementLoopCount,
    movementSourceFps,
    movementFrameCount,
    movementSourceDurationMs,
    movementPrerollMs,
    movementLoopStartMs,
    movementLoopEndMs,
    movementSourceTimeMs,
    movementLoadError,
    recognitionEnabled,
    select,
    preload,
    activate,
    start,
    tick,
    pause,
    resume,
    stop,
    reset,
    cleanup,
  };
};
