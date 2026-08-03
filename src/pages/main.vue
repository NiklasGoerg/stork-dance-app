<template>
  <div class="main-page">
    <BirdMap
      data-source="story"
      playback-source="migration-runtime"
      :story-cycle-definitions="storyCycleDefinitions"
      :story-cycle-ids="store.activeCycleId ? [store.activeCycleId] : []"
      :single-story-cycle-mode="true"
      @story-frame="controller.reportMapFrame"
    />
    <div class="main-page__clock">
      <SeasonClock
        :date="store.currentDate"
        :is-playing="store.isPlaying"
        @toggle-playback="togglePlayback"
        @reset="controller.reset"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import BirdMap from "~/components/map/BirdMap.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import { useMigrationActRuntime } from "~/composables/migrationActs/useMigrationActRuntime";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import type { MigrationActCycleRun } from "~/types/migrationAct";
import { migrationStoryCycleDefinitions as storyCycleDefinitions } from "~/utils/migrationStoryData";

const store = useMigrationActStore();
const cycleRuns: MigrationActCycleRun[] = storyCycleDefinitions.map(
  (cycle, index) => ({
    id: `map-stage:${cycle.label}:${index}`,
    cycleId: cycle.label,
    cycleStartYear: cycle.targetYear,
    title: `${cycle.targetYear}/${String(cycle.targetYear + 1).slice(-2)}`,
  }),
);
const controller = useMigrationActRuntime({
  surfaceId: "map-stage",
  cycleRuns,
});

const togglePlayback = () => {
  if (store.playbackState === "playing") controller.pause();
  else if (store.playbackState === "paused") void controller.resume();
  else if (store.activeCycleRun)
    void controller.startSingleCycle(store.activeCycleRun.id);
};

onMounted(() => void controller.initialize());
onBeforeUnmount(() => controller.dispose());
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
