<template>
  <canvas ref="canvas" class="canvas" />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";

import type { LandmarkFrame } from "~/types/movement";

import { useMovementPlayback } from "~/composables/useMovementPlayback";

const canvas = ref<HTMLCanvasElement | null>(null);

let WIDTH = 1280;
let HEIGHT = 720;

let ctx: CanvasRenderingContext2D | null = null;

const { currentFrame } = useMovementPlayback();

// ========================================
// INIT
// ========================================

onMounted(() => {
  resizeCanvas();

  if (!canvas.value) return;

  ctx = canvas.value.getContext("2d");

  window.addEventListener("resize", resizeCanvas);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeCanvas);
});

// ========================================
// WATCH FRAME
// ========================================

watch(currentFrame, (frame) => {
  if (!frame || !ctx) return;

  drawSkeleton(frame.landmarks);
  drawHead(frame.landmarks);
});

// ========================================
// DRAW
// ========================================

const drawSkeleton = (landmarks: LandmarkFrame["landmarks"]) => {
  if (!ctx) return;

  const context = ctx;

  context.clearRect(0, 0, WIDTH, HEIGHT);

  context.save();

  // mirror
  context.scale(-1, 1);
  context.translate(-WIDTH, 0);

  context.strokeStyle = "white";
  context.lineWidth = 6;
  context.lineCap = "round";

  const point = (i: number) => ({
    x: (landmarks[i]?.x ?? 0) * WIDTH,
    y: (landmarks[i]?.y ?? 0) * HEIGHT,
  });

  const line = (a: number, b: number) => {
    const p1 = point(a);
    const p2 = point(b);

    context.beginPath();
    context.moveTo(p1.x, p1.y);
    context.lineTo(p2.x, p2.y);
    context.stroke();
  };

  // body
  line(11, 12);

  line(11, 13);
  line(13, 15);

  line(12, 14);
  line(14, 16);

  line(11, 23);
  line(12, 24);

  line(23, 24);

  line(23, 25);
  line(25, 27);

  line(24, 26);
  line(26, 28);

  context.restore();
};

// Draw head (copied from MovementCamera)
const drawHead = (landmarks: LandmarkFrame["landmarks"]) => {
  if (!ctx) return;

  const context = ctx;
  context.save();
  context.scale(-1, 1);
  context.translate(-WIDTH, 0);

  const point = (i: number) => ({
    x: (landmarks[i]?.x ?? 0) * WIDTH,
    y: (landmarks[i]?.y ?? 0) * HEIGHT,
  });
  const nose = point(0);
  const leftEar = point(7);
  const rightEar = point(8);
  const leftShoulder = point(11);
  const rightShoulder = point(12);

  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const radius = shoulderWidth * 0.35;

  context.strokeStyle = "white";
  context.lineWidth = 3;

  // Kopf
  context.beginPath();
  context.arc(nose.x, nose.y, radius, 0, Math.PI * 2);
  context.stroke();

  // Orientierung (Ohren)
  context.beginPath();
  context.moveTo(leftEar.x, leftEar.y);
  context.lineTo(rightEar.x, rightEar.y);
  context.stroke();

  context.restore();
};

const resizeCanvas = () => {
  if (!canvas.value) return;

  WIDTH = window.innerWidth;
  HEIGHT = window.innerHeight;

  canvas.value.width = WIDTH;
  canvas.value.height = HEIGHT;
};
</script>

<style scoped>
.canvas {
  width: 100%;
  height: 100%;
  display: block;

  background: black;
}
</style>
