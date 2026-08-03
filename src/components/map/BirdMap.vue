<template>
  <div class="bird-map">
    <ClientOnly>
      <LeafletMap
        :show-controls="showControls"
        :show-map-navigation="showMapNavigation"
        :story-cycle-ids="storyCycleIds"
        :story-cycle-definitions="storyCycleDefinitions"
        :single-story-cycle-mode="singleStoryCycleMode"
        :data-source="dataSource"
        :playback-source="playbackSource"
        @story-frame="$emit('story-frame', $event)"
      />
      <template #fallback>
        <div class="map-fallback" />
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import LeafletMap from "~/components/map/LeafletMap.vue";
import type { MigrationActMapFrame } from "~/types/migrationAct";
import type { StorkDataSource, StorkStoryCycleDefinition } from "~/types/stork";

withDefaults(
  defineProps<{
    showControls?: boolean;
    showMapNavigation?: boolean;
    storyCycleIds?: string[];
    storyCycleDefinitions?: StorkStoryCycleDefinition[];
    singleStoryCycleMode?: boolean;
    dataSource?: StorkDataSource;
    playbackSource?: "story-playback" | "migration-runtime";
  }>(),
  {
    showControls: true,
    showMapNavigation: true,
    storyCycleIds: undefined,
    storyCycleDefinitions: undefined,
    singleStoryCycleMode: false,
    dataSource: "raw",
    playbackSource: "migration-runtime",
  },
);

defineEmits<{
  "story-frame": [frame: MigrationActMapFrame];
}>();
</script>

<style scoped>
.bird-map {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.map-fallback {
  width: 100%;
  height: 100%;
  background: #dce7dd;
}
</style>
