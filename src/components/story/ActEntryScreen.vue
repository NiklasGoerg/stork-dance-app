<template>
  <main class="act-entry" :style="backgroundStyle" :aria-label="title">
    <StoryProgressSidebar />
    <div class="act-entry__shade" aria-hidden="true" />
    <section class="act-entry__content">
      <h1 class="act-entry__title">{{ title }}</h1>
      <p v-if="subtitle" class="act-entry__subtitle">{{ subtitle }}</p>
      <p v-if="description" class="act-entry__description">
        {{ description }}
      </p>
      <div class="act-entry__actions" role="group">
        <button
          type="button"
          class="act-entry__button"
          :disabled="locked"
          @click="emitBack"
        >
          {{ backLabel }}
        </button>
        <button
          type="button"
          class="act-entry__button act-entry__button--primary"
          :disabled="locked"
          @click="emitContinue"
        >
          {{ continueLabel }}
        </button>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import defaultEntryBackgroundImage from "~/assets/images/stork_stock.jpeg";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { usePresenterActions } from "~/composables/usePresenterActions";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    description?: string;
    backgroundImage?: string;
    backLabel: string;
    continueLabel: string;
    locked?: boolean;
  }>(),
  {
    subtitle: undefined,
    description: undefined,
    backgroundImage: undefined,
    locked: false,
  },
);

const emit = defineEmits<{
  back: [];
  continue: [];
}>();

const backgroundStyle = computed(() => {
  const image = props.backgroundImage ?? defaultEntryBackgroundImage;
  return { "--act-entry-background-image": `url(${image})` };
});

const emitBack = () => {
  if (!props.locked) emit("back");
};

const emitContinue = () => {
  if (!props.locked) emit("continue");
};

usePresenterActions({
  enabled: computed(() => !props.locked),
  // Presenter invariant for entry screens: PageUp = Back, PageDown = Continue.
  onPageUp: emitBack,
  onPageDown: emitContinue,
});
</script>

<style scoped>
.act-entry {
  position: relative;
  isolation: isolate;
  display: grid;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  place-items: center;
  overflow: hidden;
  background-color: #17251d;
  background-image:
    linear-gradient(90deg, rgb(9 19 15 / 0.72), rgb(9 19 15 / 0.16)),
    var(--act-entry-background-image, linear-gradient(#17251d, #17251d));
  background-position: center;
  background-size: cover;
  color: #ffffff;
}

.act-entry__shade {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(180deg, rgb(4 11 8 / 0.22), rgb(4 11 8 / 0.42));
}

.act-entry__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  max-width: min(860px, calc(100vw - 168px));
  text-align: center;
  text-shadow: 0 3px 18px rgb(0 0 0 / 0.5);
}

.act-entry__title {
  margin: 0;
  font-size: clamp(3.3rem, 8vw, 7.4rem);
  font-weight: 860;
  line-height: 0.92;
  letter-spacing: 0;
}

.act-entry__subtitle {
  margin: 0;
  font-size: clamp(2rem, 2vw, 2.45rem);
  font-weight: 760;
  letter-spacing: 0;
}

.act-entry__description {
  max-width: 680px;
  margin: var(--space-2) 0 0;
  color: rgb(255 255 255 / 0.86);
  font-size: clamp(1rem, 1.35vw, 1.35rem);
  font-weight: 700;
  line-height: 1.34;
}

.act-entry__actions {
  display: grid;
  grid-template-columns: minmax(180px, auto) minmax(180px, auto);
  justify-content: center;
  gap: clamp(48px, 16vw, 240px);
  width: min(760px, 100%);
  margin-top: var(--space-7);
}

.act-entry__button {
  min-height: 48px;
  padding: 0 var(--space-5);
  border: 1.5px solid rgb(255 255 255 / 0.58);
  border-radius: 7px;
  background: rgb(255 255 255 / 0.14);
  color: #ffffff;
  font: inherit;
  font-size: 0.98rem;
  font-weight: 820;
  cursor: pointer;
  box-shadow: 0 16px 36px rgb(0 0 0 / 0.18);
  backdrop-filter: blur(10px);
}

.act-entry__button:hover,
.act-entry__button:focus-visible {
  outline: 3px solid rgb(255 255 255 / 0.72);
  outline-offset: 3px;
}

.act-entry__button--primary {
  border-color: #ffffff;
  background: #ffffff;
  color: #1f3127;
}

.act-entry__button:disabled {
  cursor: progress;
  opacity: 0.68;
}

@media (max-width: 860px) {
  .act-entry {
    place-items: end center;
    padding: 92px var(--space-5) var(--space-7) 88px;
  }

  .act-entry__content {
    max-width: 100%;
  }

  .act-entry__actions {
    grid-template-columns: 1fr;
    gap: var(--space-3);
    width: min(100%, 360px);
  }
}
</style>
