import { ref } from "vue";

import type {
  MovementLoopRegion,
  MovementRecording,
  LandmarkFrame,
} from "~/types/movement";
import { getInterpolatedMovementFrame } from "~/utils/movementFrames";
import {
  getMovementRecordingDurationMs,
  normalizeMovementRecordingFrameTimes,
} from "~/utils/movementPlaybackTiming";

export const useMovementPlayback = () => {
  const recording = ref<MovementRecording | null>(null);

  const currentFrame = ref<LandmarkFrame | null>(null);

  const isPlaying = ref(false);
  const currentTimeMs = ref(0);
  const durationMs = ref(0);
  const hasCompleted = ref(false);

  let frameIndex = 0;
  let animationFrameId = 0;
  let playbackStart = 0;
  let shouldLoop = false;
  let loopRegion: MovementLoopRegion | null = null;
  let onComplete: (() => void) | null = null;

  type PlayOptions = {
    loop?: boolean;
    loopRegion?: MovementLoopRegion;
    restart?: boolean;
    onComplete?: () => void;
  };

  // Loads a recording and prepares the first frame without starting playback.
  const loadRecording = (data: MovementRecording) => {
    pause();

    const normalizedRecording = normalizeMovementRecordingFrameTimes(data);

    recording.value = normalizedRecording;

    frameIndex = 0;
    shouldLoop = false;
    loopRegion = null;
    currentTimeMs.value = 0;
    durationMs.value = getMovementRecordingDurationMs(normalizedRecording);
    hasCompleted.value = false;
    onComplete = null;

    currentFrame.value = normalizedRecording.frames[0] || null;
  };

  // Starts RAF-driven playback from the current frame or from the beginning.
  const play = (options: PlayOptions = {}) => {
    if (!recording.value) return;
    if (isPlaying.value) return;

    shouldLoop = options.loop ?? false;
    loopRegion = options.loopRegion ?? null;
    onComplete = options.onComplete ?? null;

    if (options.restart) {
      frameIndex = 0;
      currentTimeMs.value = 0;
      currentFrame.value = recording.value.frames[0] || null;
    }

    hasCompleted.value = false;
    isPlaying.value = true;

    playbackStart = performance.now() - currentTimeMs.value;

    loop();
  };

  // Advances normal playback using recorded frame timestamps.
  const loop = () => {
    if (!recording.value) return;
    if (!isPlaying.value) return;

    const now = performance.now();
    const frames = recording.value.frames;
    const firstFrameTime = frames[0]?.time ?? 0;
    const lastFrameTime = frames[frames.length - 1]?.time ?? firstFrameTime;
    const targetTime = firstFrameTime + (now - playbackStart);

    if (loopRegion && targetTime - firstFrameTime >= loopRegion.endMs) {
      const loopDurationMs = Math.max(loopRegion.endMs - loopRegion.startMs, 1);
      const sourceTimeMs =
        loopRegion.startMs +
        ((targetTime - firstFrameTime - loopRegion.startMs) % loopDurationMs);

      currentTimeMs.value = sourceTimeMs;
      currentFrame.value = getInterpolatedMovementFrame(
        recording.value,
        sourceTimeMs,
      );
      animationFrameId = requestAnimationFrame(loop);
      return;
    }

    if (shouldLoop && targetTime >= lastFrameTime) {
      frameIndex = 0;
      playbackStart = now;
      currentTimeMs.value = 0;
      hasCompleted.value = false;
      currentFrame.value = frames[0] ?? null;
      animationFrameId = requestAnimationFrame(loop);

      return;
    }

    if (!shouldLoop && targetTime >= lastFrameTime) {
      frameIndex = frames.length - 1;
      currentTimeMs.value = lastFrameTime - firstFrameTime;
      currentFrame.value = frames[frameIndex] ?? null;
      isPlaying.value = false;
      hasCompleted.value = true;

      const complete = onComplete;
      onComplete = null;

      if (complete) {
        complete();
      }

      return;
    }

    while (
      frameIndex < frames.length - 1 &&
      frames[frameIndex]!.time < targetTime
    ) {
      frameIndex++;
    }

    currentFrame.value = frames[frameIndex] ?? null;
    currentTimeMs.value = Math.max(0, targetTime - firstFrameTime);

    animationFrameId = requestAnimationFrame(loop);
  };

  const pause = () => {
    isPlaying.value = false;

    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = 0;
  };

  const stop = () => {
    pause();

    frameIndex = 0;
    shouldLoop = false;
    loopRegion = null;
    currentTimeMs.value = 0;
    hasCompleted.value = false;
    onComplete = null;

    currentFrame.value = recording.value?.frames[0] || null;
  };

  // Samples one interpolated frame for externally timed playback, such as gestures.
  const seekToTime = (timeMs: number) => {
    if (!recording.value) return;

    pause();
    frameIndex = 0;
    shouldLoop = false;
    currentTimeMs.value = Math.max(0, timeMs);
    hasCompleted.value = false;
    onComplete = null;
    currentFrame.value = getInterpolatedMovementFrame(
      recording.value,
      currentTimeMs.value,
    );
  };

  return {
    recording,
    currentFrame,

    isPlaying,
    currentTimeMs,
    durationMs,
    hasCompleted,

    loadRecording,

    play,
    pause,
    stop,
    seekToTime,
  };
};
