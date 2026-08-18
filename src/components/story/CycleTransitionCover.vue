<template>
  <div
    class="cycle-transition-cover"
    data-testid="cycle-transition-cover"
    aria-live="polite"
  >
    <div class="cycle-transition-cover__label">{{ label }}</div>
    <div class="cycle-transition-cover__years">
      <span>{{ fromTitle }}</span>
      <span aria-hidden="true">-&gt;</span>
      <span>{{ toTitle }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  fromTitle: string;
  toTitle: string;
}>();
</script>

<style scoped>
.cycle-transition-cover {
  position: absolute;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-content: center;
  gap: var(--space-3);
  padding: var(--space-6);
  color: #ffffff;
  text-align: center;
  background: rgb(13 22 18 / 0.98);
  pointer-events: auto;
}

.cycle-transition-cover__label {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.86;
}

.cycle-transition-cover__years {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  font-size: clamp(2rem, 5.4vw, 4.6rem);
  font-weight: 800;
  line-height: 1;
}
</style>
