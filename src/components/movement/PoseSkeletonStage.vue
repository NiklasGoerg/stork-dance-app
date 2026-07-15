<template>
  <canvas ref="canvas" class="pose-skeleton-stage" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const props = defineProps<{
  landmarks: NormalizedLandmark[] | null;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);

let ctx: CanvasRenderingContext2D | null = null;
let resizeObserver: ResizeObserver | null = null;
let width = 0;
let height = 0;

const bodyConnections: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

const resizeCanvas = () => {
  if (!canvas.value) return;

  const rect = canvas.value.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;

  width = Math.max(rect.width, 1);
  height = Math.max(rect.height, 1);
  canvas.value.width = Math.floor(width * pixelRatio);
  canvas.value.height = Math.floor(height * pixelRatio);

  ctx = canvas.value.getContext("2d");
  ctx?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  draw();
};

const getDrawRect = (landmarks: NormalizedLandmark[]) => {
  const trackedPoints = landmarks
    .slice(0, 29)
    .filter(
      (landmark) => Number.isFinite(landmark.x) && Number.isFinite(landmark.y),
    );

  if (!trackedPoints.length) return null;

  const minX = Math.min(...trackedPoints.map((landmark) => landmark.x));
  const maxX = Math.max(...trackedPoints.map((landmark) => landmark.x));
  const minY = Math.min(...trackedPoints.map((landmark) => landmark.y));
  const maxY = Math.max(...trackedPoints.map((landmark) => landmark.y));
  const sourceWidth = Math.max(maxX - minX, 0.2);
  const sourceHeight = Math.max(maxY - minY, 0.35);
  const stagePadding = 0.14;
  const availableWidth = width * (1 - stagePadding * 2);
  const availableHeight = height * (1 - stagePadding * 2);
  const scale = Math.min(
    availableWidth / sourceWidth,
    availableHeight / sourceHeight,
  );
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;

  return {
    minX,
    minY,
    scale,
    x: (width - drawWidth) / 2,
    y: (height - drawHeight) / 2,
  };
};

const draw = () => {
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  if (!props.landmarks?.length) return;

  const landmarks = props.landmarks;
  const drawRect = getDrawRect(landmarks);

  if (!drawRect) return;

  const point = (index: number) => ({
    x:
      width -
      (drawRect.x +
        ((landmarks[index]?.x ?? 0) - drawRect.minX) * drawRect.scale),
    y:
      drawRect.y +
      ((landmarks[index]?.y ?? 0) - drawRect.minY) * drawRect.scale,
  });

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1f2f28";
  ctx.lineWidth = Math.max(width * 0.012, 5);

  for (const [start, end] of bodyConnections) {
    const startPoint = point(start);
    const endPoint = point(end);

    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();
  }

  const nose = point(0);
  const leftEar = point(7);
  const rightEar = point(8);
  const leftShoulder = point(11);
  const rightShoulder = point(12);
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const headRadius = Math.max(shoulderWidth * 0.34, 16);

  ctx.lineWidth = Math.max(width * 0.006, 3);
  ctx.beginPath();
  ctx.arc(nose.x, nose.y, headRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(leftEar.x, leftEar.y);
  ctx.lineTo(rightEar.x, rightEar.y);
  ctx.stroke();

  ctx.fillStyle = "#f7fbf7";
  for (const index of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    const landmarkPoint = point(index);

    ctx.beginPath();
    ctx.arc(
      landmarkPoint.x,
      landmarkPoint.y,
      Math.max(width * 0.008, 4),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.restore();
};

onMounted(() => {
  if (!canvas.value) return;

  resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvas.value);
  resizeCanvas();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

watch(() => props.landmarks, draw, { deep: true });
</script>

<style scoped>
.pose-skeleton-stage {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
