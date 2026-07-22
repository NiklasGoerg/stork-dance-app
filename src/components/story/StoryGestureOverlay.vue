<template>
  <Transition name="gesture-overlay">
    <div v-if="isVisible" class="story-gesture-overlay" aria-live="polite">
      <section class="story-gesture-overlay__panel" aria-label="Story gesture">
        <span class="story-gesture-overlay__eyebrow">{{ gestureLabel }}</span>
        <strong>{{ feedbackText }}</strong>

        <div
          v-if="showDevControls && canUseDevControls"
          class="story-gesture-overlay__actions"
        >
          <button class="btn btn--primary" type="button" @click="$emit('mark')">
            Mark as recognized
          </button>
          <button class="btn" type="button" @click="$emit('repeat')">
            Repeat
          </button>
        </div>

        <button
          class="story-gesture-overlay__cancel"
          type="button"
          @click="$emit('cancel')"
        >
          Cancel
        </button>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { GestureInteractionState } from "~/story/gestures";

const props = defineProps<{
  gestureLabel: string;
  state: GestureInteractionState;
  feedbackText: string;
  showDevControls?: boolean;
}>();

defineEmits<{
  mark: [];
  repeat: [];
  cancel: [];
}>();

const isVisible = computed(() => props.state !== "inactive");
const canUseDevControls = computed(
  () => props.state === "attempt-playing" || props.state === "retry-scheduled",
);
</script>

<style scoped>
.story-gesture-overlay {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
}

.story-gesture-overlay__panel {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 1;
  display: grid;
  width: min(420px, calc(100% - 36px));
  gap: 12px;
  padding: 18px;
  border: 1px solid rgba(31, 49, 39, 0.16);
  border-radius: 8px;
  background: rgba(249, 251, 247, 0.94);
  color: #1f3127;
  box-shadow: 0 14px 34px rgba(29, 45, 36, 0.16);
  backdrop-filter: blur(10px);
  pointer-events: auto;
}

.story-gesture-overlay__eyebrow {
  color: rgba(31, 49, 39, 0.62);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.story-gesture-overlay__panel strong {
  font-size: clamp(2rem, 5vw, 3.4rem);
  line-height: 1.02;
}

.story-gesture-overlay__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.story-gesture-overlay__cancel {
  justify-self: start;
  min-height: 32px;
  padding: 5px 0;
  border: 0;
  background: transparent;
  color: rgba(31, 49, 39, 0.68);
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
}

.gesture-overlay-enter-active,
.gesture-overlay-leave-active {
  transition: opacity 0.18s ease;
}

.gesture-overlay-enter-from,
.gesture-overlay-leave-to {
  opacity: 0;
}
</style>
