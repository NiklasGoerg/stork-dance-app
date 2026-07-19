<template>
  <MovementStage
    class="pose-skeleton-stage"
    :landmarks="landmarks"
    source-mode="live-camera"
  />
</template>

<script setup lang="ts">
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import MovementStage from "~/components/movement/MovementStage.vue";

defineProps<{
  landmarks: NormalizedLandmark[] | null;
}>();
</script>

<style scoped>
.pose-skeleton-stage {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
