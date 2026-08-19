<template>
  <div class="movement-stage">
    <canvas ref="canvas" class="movement-stage__canvas" />

    <div v-if="showDebug" class="movement-stage__debug">
      <span>{{ sourceMode }}</span>
      <span>{{ landmarks?.length ?? 0 }} points</span>
      <span>fixed frame</span>
    </div>

    <div v-if="!landmarks?.length" class="movement-stage__empty">
      Waiting for body tracking
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { AvatarSourceMode, MovementStageLandmark } from "~/types/movement";

type StageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const props = withDefaults(
  defineProps<{
    landmarks?: MovementStageLandmark[] | null;
    sourceMode?: AvatarSourceMode;
    showGrid?: boolean;
    showDebug?: boolean;
    sourceAspect?: number;
    fillFrame?: boolean;
  }>(),
  {
    landmarks: null,
    sourceMode: "live-camera",
    showGrid: true,
    showDebug: false,
    sourceAspect: 4 / 3,
    fillFrame: false,
  },
);

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
  [27, 29],
  [29, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32],
];

const validSourceAspect = computed(() =>
  Number.isFinite(props.sourceAspect) && props.sourceAspect > 0
    ? props.sourceAspect
    : 4 / 3,
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getCameraFrame = (): StageRect => {
  if (props.fillFrame) {
    return {
      x: 0,
      y: 0,
      width,
      height,
    };
  }

  const paddingX = width * 0.035;
  const paddingY = height * 0.045;
  const availableWidth = Math.max(width - paddingX * 2, 1);
  const availableHeight = Math.max(height - paddingY * 2, 1);
  const availableAspect = availableWidth / availableHeight;

  if (availableAspect > validSourceAspect.value) {
    const frameHeight = availableHeight;
    const frameWidth = frameHeight * validSourceAspect.value;

    return {
      x: (width - frameWidth) / 2,
      y: paddingY,
      width: frameWidth,
      height: frameHeight,
    };
  }

  const frameWidth = availableWidth;
  const frameHeight = frameWidth / validSourceAspect.value;

  return {
    x: paddingX,
    y: (height - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight,
  };
};

const isVisible = (
  landmark: MovementStageLandmark | undefined,
): landmark is MovementStageLandmark =>
  !!landmark &&
  Number.isFinite(landmark.x) &&
  Number.isFinite(landmark.y) &&
  (landmark.visibility === undefined || landmark.visibility >= 0.25);

const getPoint = (
  landmarks: MovementStageLandmark[],
  index: number,
  frame: StageRect,
) => {
  const landmark = landmarks[index];

  if (!isVisible(landmark)) return null;

  return {
    x: frame.x + (1 - clamp(landmark.x, -0.1, 1.1)) * frame.width,
    y: frame.y + clamp(landmark.y, -0.1, 1.1) * frame.height,
    z: landmark.z ?? 0,
  };
};

const drawRoom = (context: CanvasRenderingContext2D, frame: StageRect) => {
  const horizonY = frame.y + frame.height * 0.47;
  const bottomY = frame.y + frame.height;
  const vanishingPoint = {
    x: frame.x + frame.width * 0.5,
    y: horizonY,
  };

  const outerGradient = context.createLinearGradient(0, 0, 0, height);
  outerGradient.addColorStop(0, "#eef4f0");
  outerGradient.addColorStop(1, "#dfe8e2");
  context.fillStyle = outerGradient;
  context.fillRect(0, 0, width, height);

  context.save();
  context.beginPath();
  context.rect(frame.x, frame.y, frame.width, frame.height);
  context.clip();

  const wallGradient = context.createLinearGradient(0, frame.y, 0, horizonY);
  wallGradient.addColorStop(0, "#f5f7f3");
  wallGradient.addColorStop(1, "#dfe8e1");
  context.fillStyle = wallGradient;
  context.fillRect(frame.x, frame.y, frame.width, horizonY - frame.y);

  const floorGradient = context.createLinearGradient(0, horizonY, 0, bottomY);
  floorGradient.addColorStop(0, "#dbe4dd");
  floorGradient.addColorStop(1, "#c5d2c8");
  context.fillStyle = floorGradient;
  context.fillRect(frame.x, horizonY, frame.width, bottomY - horizonY);

  context.strokeStyle = "rgba(45, 66, 52, 0.18)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(frame.x, horizonY);
  context.lineTo(frame.x + frame.width, horizonY);
  context.stroke();

  if (props.showGrid) {
    context.lineCap = "butt";

    for (let index = 0; index <= 10; index++) {
      const t = index / 10;
      const x = frame.x + frame.width * t;

      context.strokeStyle = "rgba(43, 62, 50, 0.16)";
      context.lineWidth = index === 5 ? 1.4 : 1;
      context.beginPath();
      context.moveTo(vanishingPoint.x, vanishingPoint.y);
      context.lineTo(x, bottomY);
      context.stroke();
    }

    for (let index = 1; index <= 9; index++) {
      const t = index / 9;
      const y = horizonY + (bottomY - horizonY) * Math.pow(t, 1.85);
      const alpha = 0.08 + t * 0.12;

      context.strokeStyle = `rgba(43, 62, 50, ${alpha})`;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(frame.x, y);
      context.lineTo(frame.x + frame.width, y);
      context.stroke();
    }
  }

  context.restore();

  context.strokeStyle = "rgba(30, 47, 38, 0.18)";
  context.lineWidth = 1;
  context.strokeRect(
    frame.x + 0.5,
    frame.y + 0.5,
    frame.width - 1,
    frame.height - 1,
  );
};

const drawShadow = (
  context: CanvasRenderingContext2D,
  landmarks: MovementStageLandmark[],
  frame: StageRect,
) => {
  const footPoints = [27, 28, 29, 30, 31, 32]
    .map((index) => getPoint(landmarks, index, frame))
    .filter((point): point is NonNullable<typeof point> => !!point);
  const hipPoints = [23, 24]
    .map((index) => getPoint(landmarks, index, frame))
    .filter((point): point is NonNullable<typeof point> => !!point);

  const contactPoints = footPoints.length ? footPoints : hipPoints;
  if (!contactPoints.length) return;

  const horizonY = frame.y + frame.height * 0.47;
  const bottomY = frame.y + frame.height;
  const centerX =
    contactPoints.reduce((sum, point) => sum + point.x, 0) /
    contactPoints.length;
  const contactY = Math.max(...contactPoints.map((point) => point.y));
  const shoulderLeft = getPoint(landmarks, 11, frame);
  const shoulderRight = getPoint(landmarks, 12, frame);
  const shoulderWidth =
    shoulderLeft && shoulderRight
      ? Math.abs(shoulderLeft.x - shoulderRight.x)
      : frame.width * 0.14;
  const depth = clamp((contactY - horizonY) / (bottomY - horizonY), 0, 1);
  const shadowWidth = clamp(
    shoulderWidth * (1.35 + depth * 0.35),
    42,
    frame.width * 0.34,
  );
  const shadowHeight = clamp(shadowWidth * 0.18, 8, 22);
  const shadowY = clamp(
    contactY + frame.height * 0.012,
    horizonY + 8,
    bottomY - 8,
  );

  context.save();
  context.fillStyle = "rgba(28, 45, 35, 0.18)";
  context.filter = "blur(2px)";
  context.beginPath();
  context.ellipse(
    centerX,
    shadowY,
    shadowWidth / 2,
    shadowHeight / 2,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
};

const drawPose = (
  context: CanvasRenderingContext2D,
  landmarks: MovementStageLandmark[],
  frame: StageRect,
) => {
  const lineWidth = clamp(Math.min(width, height) * 0.012, 4, 9);
  const jointRadius = clamp(Math.min(width, height) * 0.008, 3.5, 7);

  drawShadow(context, landmarks, frame);

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  context.strokeStyle = "rgba(255, 255, 255, 0.72)";
  context.lineWidth = lineWidth + 3;
  for (const [start, end] of bodyConnections) {
    const startPoint = getPoint(landmarks, start, frame);
    const endPoint = getPoint(landmarks, end, frame);

    if (!startPoint || !endPoint) continue;

    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(endPoint.x, endPoint.y);
    context.stroke();
  }

  context.strokeStyle = "#22382f";
  context.lineWidth = lineWidth;
  for (const [start, end] of bodyConnections) {
    const startPoint = getPoint(landmarks, start, frame);
    const endPoint = getPoint(landmarks, end, frame);

    if (!startPoint || !endPoint) continue;

    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(endPoint.x, endPoint.y);
    context.stroke();
  }

  const nose = getPoint(landmarks, 0, frame);
  const leftEar = getPoint(landmarks, 7, frame);
  const rightEar = getPoint(landmarks, 8, frame);
  const leftShoulder = getPoint(landmarks, 11, frame);
  const rightShoulder = getPoint(landmarks, 12, frame);

  if (nose && leftShoulder && rightShoulder) {
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    const headRadius = clamp(shoulderWidth * 0.34, 10, 34);

    context.strokeStyle = "#22382f";
    context.lineWidth = clamp(lineWidth * 0.58, 2.5, 5);
    context.beginPath();
    context.arc(nose.x, nose.y, headRadius, 0, Math.PI * 2);
    context.stroke();
  }

  if (leftEar && rightEar) {
    context.beginPath();
    context.moveTo(leftEar.x, leftEar.y);
    context.lineTo(rightEar.x, rightEar.y);
    context.stroke();
  }

  context.fillStyle = "#f8fbf7";
  context.strokeStyle = "rgba(34, 56, 47, 0.45)";
  context.lineWidth = 1.4;
  for (const index of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    const point = getPoint(landmarks, index, frame);

    if (!point) continue;

    context.beginPath();
    context.arc(point.x, point.y, jointRadius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  context.restore();
};

const draw = () => {
  if (!ctx || !width || !height) return;

  const context = ctx;
  const frame = getCameraFrame();

  context.clearRect(0, 0, width, height);
  drawRoom(context, frame);

  if (props.landmarks?.length) {
    drawPose(context, props.landmarks, frame);
  }
};

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

onMounted(() => {
  if (!canvas.value) return;

  resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvas.value);
  resizeCanvas();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

watch(
  () =>
    [
      props.landmarks,
      props.showGrid,
      props.sourceMode,
      props.sourceAspect,
      props.fillFrame,
    ] as const,
  draw,
  { deep: true },
);
</script>

<style scoped>
.movement-stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #e6eee8;
}

.movement-stage__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.movement-stage__debug {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: calc(100% - 20px);
  color: rgba(28, 45, 35, 0.72);
  font-size: 0.72rem;
  font-weight: 650;
  pointer-events: none;
}

.movement-stage__debug span {
  padding: 3px 7px;
  border: 1px solid rgba(28, 45, 35, 0.14);
  border-radius: 999px;
  background: rgba(247, 250, 246, 0.72);
}

.movement-stage__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  color: rgba(37, 51, 41, 0.54);
  font-size: 0.95rem;
  font-weight: 600;
  text-align: center;
  pointer-events: none;
}
</style>
