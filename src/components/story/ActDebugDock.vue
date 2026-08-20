<template>
  <aside class="act-debug-dock" :class="{ 'act-debug-dock--open': open }">
    <button
      class="act-debug-dock__toggle"
      type="button"
      :class="{ 'act-debug-dock__toggle--active': open }"
      :aria-expanded="open"
      :aria-label="toggleLabel"
      @click="$emit('toggle')"
    >
      {{ toggleLabel }}
    </button>

    <section v-if="open" class="act-debug-dock__panel" :aria-label="panelLabel">
      <slot />
    </section>
  </aside>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean;
    toggleLabel?: string;
    panelLabel?: string;
  }>(),
  {
    toggleLabel: "Debug",
    panelLabel: "Debug controls",
  },
);

defineEmits<{ toggle: [] }>();
</script>

<style scoped>
.act-debug-dock {
  position: fixed;
  z-index: 850;
  bottom: 14px;
  left: 14px;
  display: grid;
  align-items: end;
  gap: 8px;
  pointer-events: none;
}

.act-debug-dock__toggle {
  justify-self: start;
  min-height: 30px;
  padding: 5px 10px;
  border: 1px solid rgb(31 49 39 / 0.18);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.72);
  color: rgb(31 49 39 / 0.7);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 850;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.12);
  backdrop-filter: blur(10px);
}

.act-debug-dock__toggle--active {
  border-color: rgb(31 49 39 / 0.36);
  background: rgb(31 49 39 / 0.92);
  color: #ffffff;
}

.act-debug-dock__panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  max-width: calc(100vw - 28px);
  max-height: 34dvh;
  overflow: auto;
  padding: 10px;
  border: 1px solid rgb(31 49 39 / 0.16);
  border-radius: 8px;
  background: rgb(248 251 247 / 0.96);
  color: #20362a;
  box-shadow: var(--act4-shadow-bottom-bar);
  pointer-events: auto;
  backdrop-filter: blur(12px);
}

.act-debug-dock__panel :deep(.btn) {
  min-height: 30px;
  padding: 5px 10px;
  font-size: 0.72rem;
}
</style>
