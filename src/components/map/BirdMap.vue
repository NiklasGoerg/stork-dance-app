<template>
  <div class="bird-map">
    <ClientOnly>
      <LeafletMap
        :show-controls="showControls"
        :show-map-navigation="showMapNavigation"
        :story-cycle-ids="storyCycleIds"
        :story-cycle-definitions="storyCycleDefinitions"
        :single-story-cycle-mode="singleStoryCycleMode"
      />
      <template #fallback>
        <div class="map-fallback" />
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import LeafletMap from "~/components/map/LeafletMap.vue";
import type { StorkStoryCycleDefinition } from "~/types/stork";

withDefaults(
  defineProps<{
    showControls?: boolean;
    showMapNavigation?: boolean;
    storyCycleIds?: string[];
    storyCycleDefinitions?: StorkStoryCycleDefinition[];
    singleStoryCycleMode?: boolean;
  }>(),
  {
    showControls: true,
    showMapNavigation: true,
    storyCycleIds: undefined,
    storyCycleDefinitions: undefined,
    singleStoryCycleMode: false,
  },
);
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
