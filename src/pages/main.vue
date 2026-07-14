<template>
  <div class="main-page">
    <BirdMap />
    <div class="main-page__clock">
      <SeasonClock />
    </div>
  </div>
</template>

<script setup lang="ts">
import BirdMap from "~/components/map/BirdMap.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
</script>

<style scoped>
.main-page {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  display: flex;
  overflow: hidden;
  background: #eef3ef;
}

.main-page__clock {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 650;
}

@media (max-width: 760px) {
  .main-page__clock {
    top: auto;
    right: 12px;
    bottom: 12px;
    left: 12px;
    display: flex;
    justify-content: center;
  }
}
</style>
