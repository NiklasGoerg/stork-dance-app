<template>
  <div
    class="container"
    :class="{ 'container--fixed': fixed }"
    :style="{
      backgroundColor: mode === 'silhouette' ? 'black' : 'transparent',
    }"
  >
    <video
      ref="video"
      autoplay
      playsinline
      class="video"
      :style="{
        opacity: mode === 'camera' ? 1 : 0,
      }"
    />
    <canvas ref="canvas" class="canvas" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { ViewMode } from "~/types/view";
import { usePose } from "~/composables/usePose";
import { useHands } from "~/composables/useHands";
import { useMovementRecorder } from "~/composables/useMovementRecorder";
import { useLandmarkSmoothing } from "~/composables/useLandmarkSmoothing";

const props = withDefaults(
  defineProps<{
    mode: ViewMode;
    showHands?: boolean;
    fixed?: boolean;
  }>(),
  {
    fixed: true,
  },
);

const emit = defineEmits<{
  poseLandmarks: [landmarks: NormalizedLandmark[] | null];
}>();

const video = ref<HTMLVideoElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const { recordFrame } = useMovementRecorder();
const { smoothLandmarks, reset: resetLandmarkSmoothing } =
  useLandmarkSmoothing();

let ctx: CanvasRenderingContext2D | null = null;
let pose: Awaited<ReturnType<typeof usePose>> | null = null;
let hands: Awaited<ReturnType<typeof useHands>> | null = null;

let running = false;

// 👉 kleinere interne Auflösung (Performance!)
const WIDTH = 480;
const HEIGHT = 360;

// 👉 Hand throttling
let lastHandDetection = 0;
const HAND_INTERVAL = 100;
let lastHandResult: { landmarks: NormalizedLandmark[][] } | null = null;

// ==============================
// INIT
// ==============================

onMounted(async () => {
  if (!canvas.value || !video.value) return;

  canvas.value.width = WIDTH;
  canvas.value.height = HEIGHT;

  ctx = canvas.value.getContext("2d");

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: WIDTH,
      height: HEIGHT,
    },
  });

  video.value.srcObject = stream;

  video.value.onloadeddata = async () => {
    pose = await usePose();
    hands = await useHands();

    resetLandmarkSmoothing();
    running = true;
    detectFrame();
  };
});

// ==============================
// LOOP
// ==============================

const detectFrame = () => {
  if (!running) return;
  requestAnimationFrame(detectFrame);

  if (!video.value || !ctx || !pose) return;

  const now = performance.now();

  const poseResult = pose.detectForVideo(video.value, now);

  // Hände throttled
  if (props.showHands && hands && now - lastHandDetection > HAND_INTERVAL) {
    lastHandResult = hands.detectForVideo(video.value, now);
    lastHandDetection = now;
  }

  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  const smoothedPoseLandmarks = smoothLandmarks(
    poseResult?.landmarks?.[0] as NormalizedLandmark[] | undefined,
  );

  if (smoothedPoseLandmarks) {
    emit("poseLandmarks", smoothedPoseLandmarks);
    drawBody(smoothedPoseLandmarks);
    drawHead(smoothedPoseLandmarks);
    recordFrame(smoothedPoseLandmarks);
  } else {
    emit("poseLandmarks", null);
  }

  const handLandmarks = lastHandResult?.landmarks;

  if (props.showHands && handLandmarks && handLandmarks.length > 0) {
    drawHands(handLandmarks);
  }
};

// ==============================
// DRAW HELPERS
// ==============================

const getPoint = (landmarks: NormalizedLandmark[], i: number) => ({
  x: (landmarks[i]?.x ?? 0) * WIDTH,
  y: (landmarks[i]?.y ?? 0) * HEIGHT,
});

// ==============================
// BODY
// ==============================

const drawBody = (landmarks: NormalizedLandmark[]) => {
  if (!ctx) return;

  const context = ctx;

  context.save();
  context.scale(-1, 1);
  context.translate(-WIDTH, 0);

  const isSkeleton = props.mode === "skeleton" || props.mode === "camera";
  const isSilhouette = props.mode === "silhouette";

  context.lineCap = "round";

  // ==============================
  // STYLE
  // ==============================

  if (isSkeleton) {
    context.strokeStyle = "lime";
    context.lineWidth = 6;
  }

  if (isSilhouette) {
    context.strokeStyle = "white";
    context.lineWidth = 18;
  }

  const line = (a: number, b: number) => {
    const p1 = getPoint(landmarks, a);
    const p2 = getPoint(landmarks, b);

    context.beginPath();
    context.moveTo(p1.x, p1.y);
    context.lineTo(p2.x, p2.y);
    context.stroke();
  };

  // ==============================
  // BODY
  // ==============================

  // Arme
  line(11, 13);
  line(13, 15);

  line(12, 14);
  line(14, 16);

  // Schultern
  line(11, 12);

  // Torso
  line(11, 23);
  line(12, 24);
  line(23, 24);

  // Beine
  line(23, 25);
  line(25, 27);

  line(24, 26);
  line(26, 28);

  context.restore();
};

// ==============================
// HEAD (NEU + verbessert)
// ==============================

const drawHead = (landmarks: NormalizedLandmark[]) => {
  if (!ctx) return;

  const context = ctx;

  context.save();
  context.scale(-1, 1);
  context.translate(-WIDTH, 0);

  const nose = getPoint(landmarks, 0);
  const leftEar = getPoint(landmarks, 7);
  const rightEar = getPoint(landmarks, 8);
  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);

  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const radius = shoulderWidth * 0.35;

  const isSkeleton = props.mode === "skeleton" || props.mode === "camera";
  const isSilhouette = props.mode === "silhouette";

  if (isSkeleton) {
    context.strokeStyle = "white";
    context.lineWidth = 3;
  }

  if (isSilhouette) {
    context.strokeStyle = "white";
    context.lineWidth = 10;
  }

  // Kopf
  context.beginPath();
  context.arc(nose.x, nose.y, radius, 0, Math.PI * 2);
  context.stroke();

  // Orientierung (Tilt)
  context.beginPath();
  context.moveTo(leftEar.x, leftEar.y);
  context.lineTo(rightEar.x, rightEar.y);
  context.stroke();

  context.restore();
};

// ==============================
// HANDS
// ==============================

const drawHands = (handsLandmarks: NormalizedLandmark[][]) => {
  if (!ctx) return;

  const context = ctx;

  context.save();
  context.scale(-1, 1);
  context.translate(-WIDTH, 0);

  const isSilhouette = props.mode === "silhouette";

  context.strokeStyle = isSilhouette ? "white" : "cyan";
  context.lineWidth = isSilhouette ? 8 : 2;

  const connections: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [5, 9],
    [9, 10],
    [10, 11],
    [11, 12],
    [9, 13],
    [13, 14],
    [14, 15],
    [15, 16],
    [13, 17],
    [17, 18],
    [18, 19],
    [19, 20],
    [0, 17],
  ];

  handsLandmarks.forEach((hand) => {
    const point = (i: number) => ({
      x: (hand[i]?.x ?? 0) * WIDTH,
      y: (hand[i]?.y ?? 0) * HEIGHT,
    });

    connections.forEach(([a, b]) => {
      const p1 = point(a);
      const p2 = point(b);

      context.beginPath();
      context.moveTo(p1.x, p1.y);
      context.lineTo(p2.x, p2.y);
      context.stroke();
    });
  });

  context.restore();
};
</script>

<style scoped>
.container {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.container--fixed {
  position: fixed;
}

.video,
.canvas {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video {
  transform: scaleX(-1);
}
</style>
