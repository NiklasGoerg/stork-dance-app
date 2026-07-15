<template>
  <main class="story-stage-page">
    <section class="map-panel" aria-label="Story map">
      <BirdMap />
    </section>

    <section class="movement-panel" aria-label="Movement stage">
      <section class="avatar-stage" aria-label="Avatar stage">
        <div class="avatar-stage__surface">
          <PoseSkeletonStage v-if="poseLandmarks" :landmarks="poseLandmarks" />
          <div v-else class="avatar-stage__empty">
            <span>Waiting for body tracking</span>
          </div>
        </div>
      </section>

      <section class="support-rail" aria-label="Playback and user mirror">
        <section class="season-clock-panel" aria-label="Season clock">
          <SeasonClock />
        </section>

        <section class="user-mirror-panel" aria-label="User mirror">
          <MovementCamera
            mode="camera"
            :fixed="false"
            :show-hands="false"
            @pose-landmarks="poseLandmarks = $event"
          />
        </section>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import BirdMap from "~/components/map/BirdMap.vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import PoseSkeletonStage from "~/components/movement/PoseSkeletonStage.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";

const poseLandmarks = ref<NormalizedLandmark[] | null>(null);
</script>

<style scoped>
.story-stage-page {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-columns: 60% 40%;
  overflow: hidden;
  background: #edf2ef;
}

.map-panel,
.movement-panel {
  min-width: 0;
  min-height: 0;
}

.map-panel {
  position: relative;
  border-right: 1px solid rgba(36, 54, 42, 0.16);
}

.movement-panel {
  display: grid;
  grid-template-rows: 70% 30%;
  background:
    linear-gradient(
      180deg,
      rgba(252, 253, 248, 0.96),
      rgba(232, 240, 235, 0.92)
    ),
    #eef3ef;
}

.avatar-stage {
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(36, 54, 42, 0.14);
}

.avatar-stage__surface {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.avatar-stage__surface::before {
  position: absolute;
  right: 14%;
  bottom: 6%;
  left: 14%;
  height: 14px;
  border-radius: 999px;
  background: rgba(57, 74, 62, 0.1);
  content: "";
  filter: blur(2px);
}

.avatar-stage__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(37, 51, 41, 0.54);
  font-size: 0.95rem;
  font-weight: 600;
}

.support-rail {
  min-height: 0;
  display: grid;
  grid-template-columns: 50% 50%;
}

.season-clock-panel,
.user-mirror-panel {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.season-clock-panel {
  display: grid;
  place-items: center;
  padding: 8px;
  border-right: 1px solid rgba(36, 54, 42, 0.14);
}

.season-clock-panel :deep(.season-clock) {
  width: min(94%, 320px, calc(30dvh - 44px));
  gap: 6px;
  padding: 9px;
  box-shadow: none;
}

.user-mirror-panel {
  background: #121714;
}

.user-mirror-panel :deep(.container) {
  border-radius: 0;
}
</style>
