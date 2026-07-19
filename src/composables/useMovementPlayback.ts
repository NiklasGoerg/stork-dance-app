import { ref } from "vue";

import type { MovementRecording, LandmarkFrame } from "~/types/movement";

const recording = ref<MovementRecording | null>(null);

const currentFrame = ref<LandmarkFrame | null>(null);

const isPlaying = ref(false);

let frameIndex = 0;
let animationFrameId = 0;
let playbackStart = 0;
let shouldLoop = false;

type PlayOptions = {
  loop?: boolean;
};

// ========================================
// LOAD
// ========================================

const loadRecording = (data: MovementRecording) => {
  pause();

  recording.value = data;

  frameIndex = 0;
  shouldLoop = false;

  currentFrame.value = data.frames[0] || null;
};

// ========================================
// PLAY
// ========================================

const play = (options: PlayOptions = {}) => {
  if (!recording.value) return;
  if (isPlaying.value) return;

  shouldLoop = options.loop ?? false;
  isPlaying.value = true;

  const firstFrameTime = recording.value.frames[0]?.time ?? 0;
  const currentFrameTime =
    recording.value.frames[frameIndex]?.time ?? firstFrameTime;

  playbackStart = performance.now() - (currentFrameTime - firstFrameTime);

  loop();
};

// ========================================
// LOOP
// ========================================

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
    currentFrame.value = frames[0] ?? null;
    animationFrameId = requestAnimationFrame(loop);

    return;
  }

  while (
    frameIndex < frames.length - 1 &&
    frames[frameIndex].time < targetTime
  ) {
    frameIndex++;
  }

  currentFrame.value = frames[frameIndex];

  animationFrameId = requestAnimationFrame(loop);
};

// ========================================
// PAUSE
// ========================================

const pause = () => {
  isPlaying.value = false;

  cancelAnimationFrame(animationFrameId);
};

// ========================================
// STOP
// ========================================

const stop = () => {
  pause();

  frameIndex = 0;
  shouldLoop = false;

  currentFrame.value = recording.value?.frames[0] || null;
};

export const useMovementPlayback = () => {
  return {
    recording,
    currentFrame,

    isPlaying,

    loadRecording,

    play,
    pause,
    stop,
  };
};
