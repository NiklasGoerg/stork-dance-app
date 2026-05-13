<template>
  <svg
    class="avatar"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="xMidYMid meet"
  >
    <!-- TORSO -->
    <g
      :transform="`
        translate(${torsoCenter.x}, ${torsoTopY})
      `"
    >
      <image
        :href="torso"
        :x="-torsoWidth / 2"
        y="0"
        :width="torsoWidth"
        :height="torsoHeight"
      />
    </g>

    <!-- HEAD -->
    <g
      :transform="`
        translate(${headCenter.x}, ${headCenter.y})
        rotate(${headRotation})
      `"
    >
      <image
        :href="head"
        :x="-headSize / 2"
        :y="-headSize / 2"
        :width="headSize"
        :height="headSize"
      />
    </g>

    <!-- LEFT UPPER ARM -->
    <g :transform="limbTransform(leftShoulder, leftElbow)">
      <image
        :href="arm"
        x="-18"
        y="0"
        width="36"
        :height="distance(leftShoulder, leftElbow)"
      />
    </g>

    <!-- LEFT LOWER ARM -->
    <g :transform="limbTransform(leftElbow, leftWrist)">
      <image
        :href="arm"
        x="-16"
        y="0"
        width="32"
        :height="distance(leftElbow, leftWrist)"
      />
    </g>

    <!-- RIGHT UPPER ARM -->
    <g :transform="limbTransform(rightShoulder, rightElbow)">
      <image
        :href="arm"
        x="-18"
        y="0"
        width="36"
        :height="distance(rightShoulder, rightElbow)"
      />
    </g>

    <!-- RIGHT LOWER ARM -->
    <g :transform="limbTransform(rightElbow, rightWrist)">
      <image
        :href="arm"
        x="-16"
        y="0"
        width="32"
        :height="distance(rightElbow, rightWrist)"
      />
    </g>

    <!-- LEFT UPPER LEG -->
    <g :transform="limbTransform(leftHip, leftKnee)">
      <image
        :href="leg"
        x="-20"
        y="0"
        width="40"
        :height="distance(leftHip, leftKnee)"
      />
    </g>

    <!-- LEFT LOWER LEG -->
    <g :transform="limbTransform(leftKnee, leftAnkle)">
      <image
        :href="leg"
        x="-18"
        y="0"
        width="36"
        :height="distance(leftKnee, leftAnkle)"
      />
    </g>

    <!-- RIGHT UPPER LEG -->
    <g :transform="limbTransform(rightHip, rightKnee)">
      <image
        :href="leg"
        x="-20"
        y="0"
        width="40"
        :height="distance(rightHip, rightKnee)"
      />
    </g>

    <!-- RIGHT LOWER LEG -->
    <g :transform="limbTransform(rightKnee, rightAnkle)">
      <image
        :href="leg"
        x="-18"
        y="0"
        width="36"
        :height="distance(rightKnee, rightAnkle)"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";

import head from "~/assets/avatar/head.svg";
import torso from "~/assets/avatar/torso.svg";
import arm from "~/assets/avatar/arm.svg";
import leg from "~/assets/avatar/leg.svg";

const props = defineProps<{
  landmarks: any[];
  width: number;
  height: number;
}>();

// ==============================
// HELPERS
// ==============================

const point = (i: number) => ({
  x: props.landmarks[i].x * props.width,
  y: props.landmarks[i].y * props.height,
});

const distance = (a: any, b: any) => {
  return Math.hypot(b.x - a.x, b.y - a.y);
};

const angle = (a: any, b: any) => {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI - 90;
};

const limbTransform = (a: any, b: any) => {
  return `
    translate(${a.x} ${a.y})
    rotate(${angle(a, b)})
  `;
};

// ==============================
// BODY LANDMARKS
// ==============================

const nose = computed(() => point(0));

const leftEar = computed(() => point(7));
const rightEar = computed(() => point(8));

const leftShoulder = computed(() => point(11));
const rightShoulder = computed(() => point(12));

const leftElbow = computed(() => point(13));
const rightElbow = computed(() => point(14));

const leftWrist = computed(() => point(15));
const rightWrist = computed(() => point(16));

const leftHip = computed(() => point(23));
const rightHip = computed(() => point(24));

const leftKnee = computed(() => point(25));
const rightKnee = computed(() => point(26));

const leftAnkle = computed(() => point(27));
const rightAnkle = computed(() => point(28));

// ==============================
// BODY DIMENSIONS
// ==============================

const shoulderWidth = computed(() => {
  return distance(leftShoulder.value, rightShoulder.value);
});

const torsoHeight = computed(() => {
  return (
    distance(
      {
        x: (leftShoulder.value.x + rightShoulder.value.x) / 2,
        y: (leftShoulder.value.y + rightShoulder.value.y) / 2,
      },
      {
        x: (leftHip.value.x + rightHip.value.x) / 2,
        y: (leftHip.value.y + rightHip.value.y) / 2,
      },
    ) * 1.35
  );
});

const torsoWidth = computed(() => shoulderWidth.value * 1.3);

// ==============================
// HEAD
// ==============================

const headSize = computed(() => {
  return shoulderWidth.value * 0.9;
});

const headCenter = computed(() => ({
  x: nose.value.x,
  y: nose.value.y - headSize.value * 0.15,
}));

const headRotation = computed(() => {
  return angle(leftEar.value, rightEar.value) - 90;
});

// ==============================
// TORSO
// ==============================

const torsoCenter = computed(() => ({
  x: (leftShoulder.value.x + rightShoulder.value.x) / 2,
  y: (leftShoulder.value.y + rightShoulder.value.y) / 2,
}));

const torsoTopY = computed(() => {
  return torsoCenter.value.y - torsoHeight.value * 0.15;
});
</script>

<style scoped>
.avatar {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;

  transform: scaleX(-1); /*  wichtig */

  overflow: visible;
  pointer-events: none;
}
</style>
