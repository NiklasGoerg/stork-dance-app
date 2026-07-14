<template>
  <div class="season-clock-controls">
    <button
      class="btn season-clock-controls__button"
      type="button"
      :aria-label="isPlaying ? 'Pause story playback' : 'Play story playback'"
      @click="$emit('toggle-playback')"
    >
      <BaseIcon :path="isPlaying ? mdiPause : mdiPlay" />
      <span>{{ isPlaying ? "Pause" : "Play" }}</span>
    </button>

    <button
      class="btn season-clock-controls__button"
      type="button"
      aria-label="Reset story date to 1 June"
      @click="$emit('reset')"
    >
      <BaseIcon :path="mdiRestart" />
      <span>Reset</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { mdiPause, mdiPlay, mdiRestart } from "@mdi/js";
import BaseIcon from "~/components/ui/BaseIcon.vue";

defineProps<{
  isPlaying: boolean;
}>();

defineEmits<{
  "toggle-playback": [];
  reset: [];
}>();
</script>

<style scoped>
.season-clock-controls {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.season-clock-controls__button {
  min-width: 104px;
  min-height: 44px;
  border-color: var(--color-border);
  background: var(--color-neutral-btn);
}

.season-clock-controls__button:hover,
.season-clock-controls__button:focus-visible {
  background: var(--color-neutral-btn-hover);
  outline: 2px solid rgba(22, 22, 22, 0.22);
  outline-offset: 2px;
}
</style>
