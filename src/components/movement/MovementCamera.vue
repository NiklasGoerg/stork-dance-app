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
import { ref, onBeforeUnmount, onMounted } from "vue";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { ViewMode } from "~/types/view";
import { usePose } from "~/composables/usePose";
import { useHands } from "~/composables/useHands";
import { useMovementRecorder } from "~/composables/useMovementRecorder";
import { useLandmarkSmoothing } from "~/composables/useLandmarkSmoothing";
import {
  SKELETON_VISUAL_CONFIG,
  type SkeletonVisualMode,
} from "~/utils/movement/skeletonVisualFeedback";

const props = withDefaults(
  defineProps<{
    mode: ViewMode;
    showHands?: boolean;
    fixed?: boolean;
    skeletonVisualMode?: SkeletonVisualMode;
    skeletonPulseProgress?: number;
  }>(),
  {
    fixed: true,
    skeletonVisualMode: "neutral",
    skeletonPulseProgress: 1,
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
let animationFrameId = 0;
let mediaStream: MediaStream | null = null;

// 👉 kleinere interne Auflösung (Performance!)
const WIDTH = 480;
const HEIGHT = 360;

// 👉 Hand throttling
let lastHandDetection = 0;
const HAND_INTERVAL = 100;
let lastHandResult: { landmarks: NormalizedLandmark[][] } | null = null;

const bodyConnections: Array<[number, number]> = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

const bodyJointIndices = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

// ==============================
// INIT
// ==============================

onMounted(async () => {
  if (!canvas.value || !video.value) return;

  canvas.value.width = WIDTH;
  canvas.value.height = HEIGHT;

  ctx = canvas.value.getContext("2d");

  let stream: MediaStream;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: WIDTH,
        height: HEIGHT,
      },
    });
  } catch (error) {
    console.warn("[MovementCamera] Camera unavailable.", error);
    emit("poseLandmarks", null);
    return;
  }

  mediaStream = stream;
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
  animationFrameId = requestAnimationFrame(detectFrame);

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

const stopCamera = () => {
  running = false;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  }

  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;

  if (video.value) {
    video.value.srcObject = null;
    video.value.onloadeddata = null;
  }

  resetLandmarkSmoothing();
  lastHandResult = null;
  emit("poseLandmarks", null);
};

onBeforeUnmount(stopCamera);

// ==============================
// DRAW HELPERS
// ==============================

const getPoint = (landmarks: NormalizedLandmark[], i: number) => ({
  x: (landmarks[i]?.x ?? 0) * WIDTH,
  y: (landmarks[i]?.y ?? 0) * HEIGHT,
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const hexToRgb = (color: string) => {
  const normalized = color.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const mixColor = (from: string, to: string, amount: number) => {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const t = clamp(amount, 0, 1);

  return `rgb(${Math.round(start.r + (end.r - start.r) * t)}, ${Math.round(
    start.g + (end.g - start.g) * t,
  )}, ${Math.round(start.b + (end.b - start.b) * t)})`;
};

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

const getSkeletonStyle = () => {
  const progress = clamp(props.skeletonPulseProgress, 0, 1);
  const isSuccessPulse = props.skeletonVisualMode === "successPulse";
  const isMissPulse = props.skeletonVisualMode === "missPulse";
  const isTerminalPulse = isSuccessPulse || isMissPulse;
  const pulseStrength = isTerminalPulse ? Math.sin(Math.PI * progress) : 0;
  const pulseColor = isMissPulse
    ? SKELETON_VISUAL_CONFIG.innerMissColor
    : SKELETON_VISUAL_CONFIG.innerSuccessColor;
  const innerColor = isTerminalPulse
    ? mixColor(
        pulseColor,
        SKELETON_VISUAL_CONFIG.innerColor,
        easeOutCubic(progress),
      )
    : SKELETON_VISUAL_CONFIG.innerColor;

  return {
    innerColor,
    outerColor: SKELETON_VISUAL_CONFIG.outerNeutralColor,
    outerLineWidth: SKELETON_VISUAL_CONFIG.outerLineWidth,
    innerLineWidth:
      SKELETON_VISUAL_CONFIG.innerLineWidth +
      pulseStrength * SKELETON_VISUAL_CONFIG.pulseAdditionalLineWidth,
    outerJointRadius: SKELETON_VISUAL_CONFIG.outerJointRadius,
    innerJointRadius:
      SKELETON_VISUAL_CONFIG.innerJointRadius +
      pulseStrength * SKELETON_VISUAL_CONFIG.pulseAdditionalJointRadius,
    outerHeadLineWidth: SKELETON_VISUAL_CONFIG.outerHeadLineWidth,
    innerHeadLineWidth:
      SKELETON_VISUAL_CONFIG.innerHeadLineWidth +
      pulseStrength * SKELETON_VISUAL_CONFIG.pulseAdditionalLineWidth,
    glowBlur: pulseStrength * SKELETON_VISUAL_CONFIG.pulseGlowBlur,
    opacity:
      props.skeletonVisualMode === "trackingLimited"
        ? SKELETON_VISUAL_CONFIG.trackingLimitedOpacity
        : 1,
  };
};

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

  const line = (a: number, b: number) => {
    const p1 = getPoint(landmarks, a);
    const p2 = getPoint(landmarks, b);

    context.beginPath();
    context.moveTo(p1.x, p1.y);
    context.lineTo(p2.x, p2.y);
    context.stroke();
  };

  // ==============================
  // STYLE
  // ==============================

  if (isSkeleton) {
    const style = getSkeletonStyle();

    context.globalAlpha = style.opacity;
    context.shadowColor = style.outerColor;
    context.shadowBlur = style.glowBlur;
    context.strokeStyle = style.outerColor;
    context.lineWidth = style.outerLineWidth;

    for (const [a, b] of bodyConnections) {
      line(a, b);
    }

    context.shadowBlur = 0;
    context.strokeStyle = style.innerColor;
    context.lineWidth = style.innerLineWidth;

    for (const [a, b] of bodyConnections) {
      line(a, b);
    }

    for (const index of bodyJointIndices) {
      const point = getPoint(landmarks, index);

      context.fillStyle = style.outerColor;
      context.beginPath();
      context.arc(point.x, point.y, style.outerJointRadius, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = style.innerColor;
      context.beginPath();
      context.arc(point.x, point.y, style.innerJointRadius, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
    return;
  }

  if (isSilhouette) {
    context.strokeStyle = "white";
    context.lineWidth = 18;
  }

  bodyConnections.forEach(([a, b]) => line(a, b));

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
    const style = getSkeletonStyle();

    context.globalAlpha = style.opacity;
    context.shadowColor = style.outerColor;
    context.shadowBlur = style.glowBlur;
    context.strokeStyle = style.outerColor;
    context.lineWidth = style.outerHeadLineWidth;

    context.beginPath();
    context.arc(nose.x, nose.y, radius, 0, Math.PI * 2);
    context.stroke();

    context.beginPath();
    context.moveTo(leftEar.x, leftEar.y);
    context.lineTo(rightEar.x, rightEar.y);
    context.stroke();

    context.shadowBlur = 0;
    context.strokeStyle = style.innerColor;
    context.lineWidth = style.innerHeadLineWidth;

    context.beginPath();
    context.arc(nose.x, nose.y, radius, 0, Math.PI * 2);
    context.stroke();

    context.beginPath();
    context.moveTo(leftEar.x, leftEar.y);
    context.lineTo(rightEar.x, rightEar.y);
    context.stroke();

    context.restore();
    return;
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
