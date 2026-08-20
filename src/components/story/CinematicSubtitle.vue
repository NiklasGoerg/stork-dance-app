<template>
  <Transition name="cinematic-subtitle" mode="out-in">
    <p
      v-if="visible && text"
      :key="text"
      class="cinematic-subtitle"
      aria-live="polite"
    >
      {{ text }}
    </p>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  text: string;
  visible: boolean;
}>();
</script>

<style scoped>
.cinematic-subtitle {
  position: fixed;
  left: 50%;
  bottom: clamp(36px, 8vh, 84px);
  z-index: 950;
  width: min(980px, calc(100vw - 48px));
  margin: 0;
  padding: 12px 20px 14px;
  border-radius: var(--radius-sm);
  background: rgba(13, 19, 16, 0.68);
  color: #ffffff;
  font-size: clamp(1.35rem, 2.7vw, 2.3rem);
  font-weight: 650;
  line-height: 1.24;
  text-align: center;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.52);
  transform: translateX(-50%);
  pointer-events: none;
}

.cinematic-subtitle-enter-active,
.cinematic-subtitle-leave-active {
  transition:
    opacity 280ms ease,
    transform 280ms ease;
}

.cinematic-subtitle-enter-from,
.cinematic-subtitle-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
