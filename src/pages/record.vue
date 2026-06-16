<template>
  <div class="page">
    <!-- CAMERA -->
    <MovementCamera
      v-if="mode === 'record'"
      mode="silhouette"
      :show-hands="false"
    />
    <PlaybackCanvas v-if="mode === 'playback'" class="playback-stage" />

    <!-- UI Overlay: Modern Card Design -->
    <div class="overlay">
      <div class="panel-shell">
        <TabSwitcher v-model="mode" />

        <div class="tab-content">
          <RecordControls v-if="mode === 'record'" />
          <VideoMovementRecorder v-if="mode === 'record-video'" />
          <PlaybackControls v-if="mode === 'playback'" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import MovementCamera from "~/components/movement/MovementCamera.vue";
import PlaybackCanvas from "~/components/record/PlaybackCanvas.vue";

import TabSwitcher from "~/components/record/TabSwitcher.vue";
import RecordControls from "~/components/record/RecordControls.vue";
import VideoMovementRecorder from "~/components/record/VideoMovementRecorder.vue";
import PlaybackControls from "~/components/record/PlaybackControls.vue";

type StudioMode = "record" | "record-video" | "playback";

const mode = ref<StudioMode>("record");
</script>

<style scoped>
.page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
}

.playback-stage {
  position: absolute;
  inset: 0;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  padding: 24px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  pointer-events: none;
  z-index: 20;
}

.panel-shell {
  margin: 0;
  pointer-events: auto;
}

.tab-content {
  margin-top: 2px;
  display: flex;
}

@media (max-width: 760px) {
  .overlay {
    padding: 10px;
  }

  .panel-shell {
    width: 100%;
  }
}
</style>
