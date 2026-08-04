<template>
  <div
    class="migration-gesture-countdown"
    aria-live="polite"
    aria-atomic="true"
  >
    <span class="migration-gesture-countdown__label">{{ heading }}</span>
    <strong class="migration-gesture-countdown__number">{{ count }}</strong>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { StoryGestureId } from "~/story/gestures";

const props = defineProps<{
  gestureId?: StoryGestureId;
  count: number;
  initial?: boolean;
}>();
const { t } = useI18n();
const heading = computed(() => {
  if (props.initial) return t("story.migrationPanel.gestures.startCountdown");
  return t("story.migrationPanel.gestures.countdownHeading", {
    gesture: t(`story.migrationPanel.movements.${props.gestureId}`),
  });
});
</script>

<style scoped>
.migration-gesture-countdown {
  position: absolute;
  z-index: 600;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: clamp(8px, 1.5dvh, 18px);
  pointer-events: none;
  color: #fff;
  text-align: center;
  text-shadow: 0 3px 18px rgba(0, 0, 0, 0.78);
}

.migration-gesture-countdown__label {
  font-size: clamp(1.5rem, 3vw, 3.4rem);
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
}

.migration-gesture-countdown__number {
  font-size: clamp(8rem, 22vw, 20rem);
  font-variant-numeric: tabular-nums;
  font-weight: 950;
  letter-spacing: -0.08em;
  line-height: 0.78;
}
</style>
