import { ref } from "vue";

import type { MovementRecording, LandmarkFrame } from "~/types/movement";

const recording = ref<MovementRecording | null>(null);

const currentFrame = ref<LandmarkFrame | null>(null);

const isPlaying = ref(false);

let frameIndex = 0;
let animationFrameId = 0;
let playbackStart = 0;

// ========================================
// LOAD
// ========================================

const loadRecording = (data: MovementRecording) => {
  recording.value = data;

  frameIndex = 0;

  currentFrame.value = data.frames[0] || null;
};

// ========================================
// PLAY
// ========================================

const play = () => {
  if (!recording.value) return;
  if (isPlaying.value) return;

  isPlaying.value = true;

  playbackStart = performance.now();

  loop();
};

// ========================================
// LOOP
// ========================================

const loop = () => {
  if (!recording.value) return;
  if (!isPlaying.value) return;

  const now = performance.now();

  const elapsed = now - playbackStart;

  const frames = recording.value.frames;

  while (frameIndex < frames.length - 1 && frames[frameIndex].time < elapsed) {
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
