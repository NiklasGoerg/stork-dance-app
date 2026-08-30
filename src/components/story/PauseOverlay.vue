<template>
  <div class="pause-overlay" role="presentation">
    <div class="pause-overlay__scrim" aria-hidden="true" />
    <section
      class="pause-overlay__dialog"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="descriptionId"
    >
      <h2 :id="titleId" class="pause-overlay__title">{{ title }}</h2>
      <p :id="descriptionId" class="pause-overlay__text">{{ text }}</p>
      <div class="pause-overlay__actions">
        <button
          class="pause-overlay__button"
          type="button"
          @click="$emit('back')"
        >
          {{ backLabel }}
        </button>
        <button
          class="pause-overlay__button pause-overlay__button--primary"
          type="button"
          autofocus
          @click="$emit('resume')"
        >
          {{ resumeLabel }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    text?: string;
    backLabel?: string;
    resumeLabel?: string;
    titleId?: string;
    descriptionId?: string;
  }>(),
  {
    title: "Paused",
    text: "Continue when you're ready.",
    backLabel: "Back to Start",
    resumeLabel: "Resume",
    titleId: "pause-overlay-title",
    descriptionId: "pause-overlay-description",
  },
);

defineEmits<{
  back: [];
  resume: [];
}>();
</script>

<style scoped>
.pause-overlay {
  position: fixed;
  inset: 0;
  z-index: 920;
  display: grid;
  place-items: center;
  padding: clamp(20px, 6vw, 64px);
  pointer-events: auto;
}

.pause-overlay__scrim {
  position: absolute;
  inset: 0;
  background: rgb(18 24 20 / 0.46);
  backdrop-filter: saturate(0.72) brightness(0.82) blur(2px);
}

.pause-overlay__dialog {
  position: relative;
  z-index: 1;
  display: grid;
  gap: var(--space-4);
  width: min(480px, 100%);
  padding: clamp(24px, 5vw, 42px);
  border: 1px solid rgb(255 255 255 / 0.48);
  border-radius: var(--radius-md);
  background: rgb(248 251 247 / 0.9);
  color: var(--act4-color-text-strong);
  text-align: center;
  box-shadow: 0 26px 70px rgb(0 0 0 / 0.24);
  backdrop-filter: blur(14px);
}

.pause-overlay__title {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.4rem);
  font-weight: 860;
  line-height: 1;
  letter-spacing: 0;
}

.pause-overlay__text {
  margin: 0;
  color: color-mix(in srgb, var(--act4-color-text) 74%, transparent);
  font-size: clamp(1rem, 1.4vw, 1.18rem);
  font-weight: 720;
  line-height: 1.35;
}

.pause-overlay__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.pause-overlay__button {
  min-height: 44px;
  padding: 8px var(--space-4);
  border: 1px solid rgb(31 49 39 / 0.22);
  border-radius: var(--radius-sm);
  background: rgb(255 255 255 / 0.64);
  color: var(--act4-color-text);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 820;
  line-height: 1.1;
  cursor: pointer;
}

.pause-overlay__button:hover,
.pause-overlay__button:focus-visible {
  outline: 3px solid rgb(47 142 93 / 0.34);
  outline-offset: 2px;
}

.pause-overlay__button--primary {
  border-color: rgb(31 49 39 / 0.82);
  background: rgb(31 49 39 / 0.92);
  color: #ffffff;
}

@media (max-width: 560px) {
  .pause-overlay__actions {
    grid-template-columns: 1fr;
  }
}
</style>
