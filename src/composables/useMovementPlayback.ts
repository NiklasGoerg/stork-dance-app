import { ref } from "vue";

import type { MovementRecording, LandmarkFrame } from "~/types/movement";
import { getInterpolatedMovementFrame } from "~/utils/movementFrames";

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
  let onComplete: (() => void) | null = null;

  type PlayOptions = {
    loop?: boolean;
    restart?: boolean;
    onComplete?: () => void;
  };

  // Loads a recording and prepares the first frame without starting playback.
  const loadRecording = (data: MovementRecording) => {
    pause();

    recording.value = data;

    frameIndex = 0;
    shouldLoop = false;
    currentTimeMs.value = 0;
    durationMs.value =
      (data.frames[data.frames.length - 1]?.time ?? 0) -
      (data.frames[0]?.time ?? 0);
    hasCompleted.value = false;
    onComplete = null;

    currentFrame.value = data.frames[0] || null;
  };

  // Starts RAF-driven playback from the current frame or from the beginning.
  const play = (options: PlayOptions = {}) => {
    if (!recording.value) return;
    if (isPlaying.value) return;

    shouldLoop = options.loop ?? false;
    onComplete = options.onComplete ?? null;

    if (options.restart) {
      frameIndex = 0;
      currentTimeMs.value = 0;
      currentFrame.value = recording.value.frames[0] || null;
    }

    hasCompleted.value = false;
    isPlaying.value = true;

    const firstFrameTime = recording.value.frames[0]?.time ?? 0;
    const currentFrameTime =
      recording.value.frames[frameIndex]?.time ?? firstFrameTime;

    playbackStart = performance.now() - (currentFrameTime - firstFrameTime);

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

    cancelAnimationFrame(animationFrameId);
  };

  const stop = () => {
    pause();

    frameIndex = 0;
    shouldLoop = false;
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
