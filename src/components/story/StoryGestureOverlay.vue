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
  z-index: 5;
  display: grid;
  min-width: 0;
  place-items: center;
  padding: 40px;
  pointer-events: none;
}

.story-gesture-overlay__panel {
  display: grid;
  width: min(720px, 100%);
  gap: 18px;
  padding: 28px 34px;
  border: 1px solid rgba(31, 49, 39, 0.18);
  border-radius: 8px;
  background: rgba(249, 251, 247, 0.9);
  color: #1f3127;
  box-shadow: 0 18px 42px rgba(29, 45, 36, 0.2);
  backdrop-filter: blur(10px);
  pointer-events: auto;
}

.story-gesture-overlay__eyebrow {
  color: rgba(31, 49, 39, 0.62);
  font-size: clamp(0.9rem, 1.3vw, 1.2rem);
  font-weight: 800;
  text-transform: uppercase;
}

.story-gesture-overlay__panel strong {
  font-size: clamp(3.2rem, 7vw, 6.8rem);
  line-height: 1.02;
}

.story-gesture-overlay__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.story-gesture-overlay__cancel {
  justify-self: start;
  min-height: 40px;
  padding: 6px 0;
  border: 0;
  background: transparent;
  color: rgba(31, 49, 39, 0.68);
  font-size: 1.1rem;
  font-weight: 800;
  cursor: pointer;
}

@media (max-width: 900px) {
  .story-gesture-overlay {
    padding: 18px;
  }

  .story-gesture-overlay__panel {
    padding: 20px 22px;
  }
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
