import { ref } from "vue";

import type { LandmarkFrame, MovementRecording } from "~/types/movement";

const FPS = 30;
const FRAME_INTERVAL = 1000 / FPS;

type RecordableLandmark = {
  x: number;
  y: number;
  z: number;
};

type StartRecordingOptions = {
  skipCountdown?: boolean;
  source?: MovementRecording["source"];
};

const isRecording = ref(false);

const countdown = ref(0);

const recording = ref<MovementRecording | null>(null);

let frames: LandmarkFrame[] = [];

let startTime = 0;
let lastFrameTime = 0;

// ========================================
// START
// ========================================

const startRecording = async (
  movementName: string,
  options: StartRecordingOptions = {},
) => {
  if (isRecording.value) return;

  countdown.value = options.skipCountdown ? 0 : 3;

  if (!options.skipCountdown) {
    await runCountdown();
  }

  frames = [];

  startTime = performance.now();
  lastFrameTime = 0;

  const nextRecording: MovementRecording = {
    name: movementName,
    fps: FPS,
    createdAt: new Date().toISOString(),
    frames,
  };

  if (options.source) {
    nextRecording.source = options.source;
  }

  recording.value = nextRecording;

  isRecording.value = true;
};

// ========================================
// STOP
// ========================================

const stopRecording = () => {
  isRecording.value = false;
};

// ========================================
// COUNTDOWN
// ========================================

const runCountdown = () => {
  return new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      countdown.value--;

      if (countdown.value <= 0) {
        clearInterval(interval);

        resolve();
      }
    }, 1000);
  });
};

// ========================================
// RECORD FRAME
// ========================================

const recordFrame = (landmarks: RecordableLandmark[]) => {
  if (!isRecording.value) return;

  const now = performance.now();

  // 30 FPS sampling
  if (now - lastFrameTime < FRAME_INTERVAL) return;

  lastFrameTime = now;

  const frame: LandmarkFrame = {
    time: now - startTime,

    landmarks: landmarks.map((l) => ({
      x: l.x,
      y: l.y,
      z: l.z,
    })),
  };

  frames.push(frame);
};

// ========================================
// EXPORT
// ========================================

const exportRecording = () => {
  if (!recording.value) return;

  const data = JSON.stringify(recording.value, null, 2);

  const blob = new Blob([data], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;

  a.download = `${recording.value.name}.json`;

  a.click();

  URL.revokeObjectURL(url);
};

export const useMovementRecorder = () => {
  return {
    isRecording,
    countdown,
    recording,

    startRecording,
    stopRecording,
    recordFrame,
    exportRecording,
  };
};
