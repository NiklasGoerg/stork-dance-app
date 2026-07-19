<template>
  <div>
    <div class="ui">
      <button @click="mode = 'camera'">Camera</button>
      <button @click="mode = 'avatar'">Avatar</button>
      <button @click="mode = 'silhouette'">Silhouette</button>
      <button @click="showHands = !showHands">
        {{ showHands ? "Hide Hands" : "Show Hands" }}
      </button>
    </div>

    <MovementCamera :mode="mode" :show-hands="showHands" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { ViewMode } from "~/types/view";

const mode = ref<ViewMode>("camera");
const showHands = ref(true);
</script>

<style scoped>
.ui {
  position: fixed;
  bottom: 20px;
  left: 50%;
  z-index: 10;
  display: flex;
  gap: 10px;
  transform: translateX(-50%);
}
</style>
