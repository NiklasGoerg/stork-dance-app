<template>
  <div
    class="container"
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
import type { ViewMode } from "~/types/view";
import { usePose } from "~/composables/usePose";
import { useHands } from "~/composables/useHands";

const props = defineProps<{
  mode: ViewMode;
  showHands?: boolean;
}>();

const video = ref<HTMLVideoElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

let ctx: CanvasRenderingContext2D | null = null;
let pose: any = null;
let hands: any = null;

let running = false;

// 👉 kleinere interne Auflösung (Performance!)
const WIDTH = 480;
const HEIGHT = 360;

// 👉 Hand throttling
let lastHandDetection = 0;
const HAND_INTERVAL = 100;
let lastHandResult: any = null;

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

  if (poseResult?.landmarks?.length > 0) {
    drawBody(poseResult.landmarks[0]);
    drawHead(poseResult.landmarks[0]);
  }

  if (props.showHands && lastHandResult?.landmarks?.length > 0) {
    drawHands(lastHandResult.landmarks);
  }
};

// ==============================
// DRAW HELPERS
// ==============================

const getPoint = (landmarks: any[], i: number) => ({
  x: landmarks[i].x * WIDTH,
  y: landmarks[i].y * HEIGHT,
});

// ==============================
// BODY
// ==============================

const drawBody = (landmarks: any[]) => {
  if (!ctx) return;

  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-WIDTH, 0);

  const isSkeleton = props.mode === "skeleton" || props.mode === "camera";
  const isSilhouette = props.mode === "silhouette";

  ctx.lineCap = "round";

  // ==============================
  // STYLE
  // ==============================

  if (isSkeleton) {
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 6;
  }

  if (isSilhouette) {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 18;
  }

  const line = (a: number, b: number) => {
    const p1 = getPoint(landmarks, a);
    const p2 = getPoint(landmarks, b);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
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

  ctx.restore();
};

// ==============================
// HEAD (NEU + verbessert)
// ==============================

const drawHead = (landmarks: any[]) => {
  if (!ctx) return;

  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-WIDTH, 0);

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
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
  }

  if (isSilhouette) {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 10;
  }

  // Kopf
  ctx.beginPath();
  ctx.arc(nose.x, nose.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Orientierung (Tilt)
  ctx.beginPath();
  ctx.moveTo(leftEar.x, leftEar.y);
  ctx.lineTo(rightEar.x, rightEar.y);
  ctx.stroke();

  ctx.restore();
};

// ==============================
// HANDS
// ==============================

const drawHands = (handsLandmarks: any[]) => {
  if (!ctx) return;

  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-WIDTH, 0);

  const isSilhouette = props.mode === "silhouette";

  ctx.strokeStyle = isSilhouette ? "white" : "cyan";
  ctx.lineWidth = isSilhouette ? 8 : 2;

  const connections = [
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
      x: hand[i].x * WIDTH,
      y: hand[i].y * HEIGHT,
    });

    connections.forEach(([a, b]) => {
      const p1 = point(a);
      const p2 = point(b);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });
  });

  ctx.restore();
};
</script>

<style scoped>
.container {
  position: fixed;
  inset: 0;
  overflow: hidden;
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
