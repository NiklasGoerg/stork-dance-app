<template>
  <div>
    <div class="ui">
      <button @click="mode = 'camera'">
        {{ t("movementCameraTest.camera") }}
      </button>
      <button @click="mode = 'avatar'">
        {{ t("movementCameraTest.avatar") }}
      </button>
      <button @click="mode = 'silhouette'">
        {{ t("movementCameraTest.silhouette") }}
      </button>
      <button @click="showHands = !showHands">
        {{
          showHands
            ? t("movementCameraTest.hideHands")
            : t("movementCameraTest.showHands")
        }}
      </button>
    </div>

    <MovementCamera :mode="mode" :show-hands="showHands" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { ViewMode } from "~/types/view";

const { t } = useI18n();
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
