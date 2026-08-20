<template>
  <main class="prologue-page" :aria-label="t('story.acts.prologue.title')">
    <StoryProgressSidebar class="prologue-progress" />

    <section
      class="prologue-scene prologue-scene--stork"
      :class="{ 'prologue-scene--visible': visualState === 'stork' }"
      aria-hidden="true"
    />

    <section
      class="prologue-scene prologue-scene--map"
      :class="{
        'prologue-scene--visible': visualState === 'map',
      }"
      :aria-label="
        t('story.aria.map', { title: t('story.acts.prologue.title') })
      "
    >
      <BirdMap
        data-source="story"
        playback-source="story-playback"
        camera-mode="migration"
        :show-controls="false"
        :show-map-navigation="false"
        :show-story-marker="false"
        :single-story-cycle-mode="true"
        :story-cycle-ids="[PROLOGUE_MIGRATION_CYCLE_ID]"
        :story-cycle-definitions="prologueCycleDefinitions"
      />
    </section>

    <CinematicSubtitle :text="currentSubtitle" :visible="hasSubtitle" />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import BirdMap from "~/components/map/BirdMap.vue";
import CinematicSubtitle from "~/components/story/CinematicSubtitle.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useNarration } from "~/composables/narration/useNarration";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import {
  getPrologueVisualStateForSegmentIndex,
  PROLOGUE_MIGRATION_CYCLE_ID,
  PROLOGUE_SEGMENT_PAUSE_MS,
  prologueNarrationSegments,
  type PrologueVisualState,
} from "~/utils/prologue/prologueSequence";
import { migrationStoryCycleDefinitions } from "~/utils/migrationStoryData";

const { t } = useI18n();
const narration = useNarration();
const runtimeStore = useStoryRuntimeStore();

const currentSegmentIndex = ref(-1);
const visualState = ref<PrologueVisualState>("stork");
const isNavigating = ref(false);

let sequenceRunId = 0;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
let resolvePause: (() => void) | null = null;

const prologueCycleDefinitions = computed(() =>
  migrationStoryCycleDefinitions.filter(
    (cycle) => cycle.label === PROLOGUE_MIGRATION_CYCLE_ID,
  ),
);

const currentSubtitle = computed(() => {
  const segment = prologueNarrationSegments[currentSegmentIndex.value];

  return segment ? t(segment.textKey) : "";
});
const hasSubtitle = computed(() => Boolean(currentSubtitle.value));

const clearPauseTimer = () => {
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }

  if (resolvePause) {
    resolvePause();
    resolvePause = null;
  }
};

const waitForSegmentPause = () =>
  new Promise<void>((resolve) => {
    resolvePause = resolve;
    pauseTimer = setTimeout(() => {
      pauseTimer = null;
      resolvePause = null;
      resolve();
    }, PROLOGUE_SEGMENT_PAUSE_MS);
  });

const stopPrologueNarration = () => {
  sequenceRunId++;
  clearPauseTimer();
  narration.stop();
};

const startPrologue = async () => {
  const runId = ++sequenceRunId;

  runtimeStore.startStory("prologue");
  isNavigating.value = false;
  currentSegmentIndex.value = -1;
  visualState.value = "stork";

  for (const [index, segment] of prologueNarrationSegments.entries()) {
    if (runId !== sequenceRunId) return;

    currentSegmentIndex.value = index;
    visualState.value = getPrologueVisualStateForSegmentIndex(index);

    const result = await narration.speakText(t(segment.textKey), {
      behavior: index === 0 ? "replace" : "queue",
    });

    if (runId !== sequenceRunId || result.status === "cancelled") return;

    await waitForSegmentPause();
  }

  if (runId !== sequenceRunId) return;

  currentSegmentIndex.value = -1;
  runtimeStore.completeAct();
  isNavigating.value = true;
  runtimeStore.reset();
  await navigateTo("/story/act-2");
};

const handlePresenterKey = (event: KeyboardEvent) => {
  if (event.key === "PageDown" || event.key === "PageUp") {
    event.preventDefault();
  }
};

onMounted(() => {
  window.addEventListener("keydown", handlePresenterKey);
  void startPrologue();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handlePresenterKey);
  stopPrologueNarration();
});
</script>

<style scoped>
.prologue-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #111711;
  color: #ffffff;
}

.prologue-progress {
  z-index: 900;
}

.prologue-scene {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition:
    opacity 620ms ease,
    filter 420ms ease;
  pointer-events: none;
}

.prologue-scene--visible {
  opacity: 1;
  pointer-events: auto;
}

.prologue-scene--stork {
  background:
    linear-gradient(
      90deg,
      rgba(10, 17, 13, 0.12),
      rgba(10, 17, 13, 0.34) 56%,
      rgba(10, 17, 13, 0.62)
    ),
    url("~/assets/images/stork_stock.jpeg") left center / cover no-repeat;
  animation: prologue-stork-drift 32s ease-out both;
}

.prologue-scene--map {
  background: #dce7dd;
}

@keyframes prologue-stork-drift {
  from {
    transform: scale(1);
  }

  to {
    transform: scale(1.045);
  }
}
</style>
