<template>
  <MovementStage
    class="playback-stage"
    :landmarks="currentFrame?.landmarks ?? null"
    source-mode="recorded-motion"
    :source-aspect="sourceAspect"
    :fill-background="true"
    :frame-scale="0.86"
    :thickness-scale="1.35"
  />
</template>

<script setup lang="ts">
import MovementStage from "~/components/movement/MovementStage.vue";
import type { LandmarkFrame } from "~/types/movement";

defineProps<{
  currentFrame: LandmarkFrame | null;
  sourceAspect: number;
}>();
</script>

<style scoped>
.playback-stage {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
