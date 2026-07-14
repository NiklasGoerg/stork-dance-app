<template>
  <div class="bird-map">
    <ClientOnly>
      <LeafletMap />
      <template #fallback>
        <div class="map-fallback" />
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import LeafletMap from "~/components/map/LeafletMap.vue";
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
