<template>
  <div class="bird-map">
    <ClientOnly>
      <LeafletMap
        :show-controls="showControls"
        :story-cycle-ids="storyCycleIds"
      />
      <template #fallback>
        <div class="map-fallback" />
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import LeafletMap from "~/components/map/LeafletMap.vue";

withDefaults(
  defineProps<{
    showControls?: boolean;
    storyCycleIds?: string[];
  }>(),
  {
    showControls: true,
    storyCycleIds: undefined,
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
