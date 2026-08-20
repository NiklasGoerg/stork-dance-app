<template>
  <ActEntryScreen
    v-if="isEntryVisible"
    :title="t('story.acts.epilogue.entry.title')"
    :subtitle="t('story.acts.epilogue.entry.subtitle')"
    :description="t('story.acts.epilogue.entry.description')"
    :back-label="t('story.acts.epilogue.entry.back')"
    :continue-label="t('story.acts.epilogue.entry.continue')"
    :locked="epilogueStageMode === 'starting'"
    @back="handleEntryBack"
    @continue="handleEntryContinue"
  />

  <main
    v-else
    class="epilogue-page"
    :aria-label="t('story.acts.epilogue.title')"
  >
    <StoryProgressSidebar class="epilogue-progress" />

    <section
      class="epilogue-map"
      :aria-label="
        t('story.aria.map', { title: t('story.acts.epilogue.title') })
      "
    >
      <BirdMap
        data-source="story"
        playback-source="story-playback"
        camera-mode="migration"
        :show-controls="false"
        :show-map-navigation="false"
        :show-story-marker="false"
        :single-story-cycle-mode="false"
        :story-cycle-definitions="migrationStoryCycleDefinitions"
      />
    </section>

    <aside
      class="epilogue-legend"
      :aria-label="t('story.acts.epilogue.legend.label')"
    >
      <div
        v-for="route in epilogueRouteLegend"
        :key="route.id"
        class="epilogue-legend__item"
      >
        <span
          class="epilogue-legend__swatch"
          :style="{ backgroundColor: route.color }"
          aria-hidden="true"
        />
        <span>{{ route.label }}</span>
      </div>
    </aside>

    <CinematicSubtitle
      :text="currentSubtitle"
      :visible="hasSubtitle && !isComplete"
    />

    <Transition name="epilogue-completion">
      <section
        v-if="isComplete"
        class="epilogue-completion"
        :aria-label="t('story.acts.epilogue.completion.ariaLabel')"
      >
        <h1>{{ t("story.acts.epilogue.completion.title") }}</h1>
        <p>{{ t("story.acts.epilogue.completion.subtitle") }}</p>
        <button
          class="epilogue-completion__button"
          type="button"
          @click="returnHome"
        >
          {{ t("story.acts.epilogue.completion.returnHome") }}
        </button>
      </section>
    </Transition>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import BirdMap from "~/components/map/BirdMap.vue";
import ActEntryScreen from "~/components/story/ActEntryScreen.vue";
import CinematicSubtitle from "~/components/story/CinematicSubtitle.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useNarration } from "~/composables/narration/useNarration";
import { usePresenterActions } from "~/composables/usePresenterActions";
import { useAudioStore } from "~/store/audioStore";
import {
  EPILOGUE_CUE_PAUSE_MS,
  EPILOGUE_FINAL_REFLECTION_PAUSE_MS,
  epilogueNarrationCueKeys,
  epilogueRouteLegend,
} from "~/utils/epilogue/epilogueSequence";
import { migrationStoryCycleDefinitions } from "~/utils/migrationStoryData";

type EpilogueStageMode = "entry" | "starting" | "running" | "complete";

const { t } = useStoryTranslations();
const narration = useNarration();
const audioStore = useAudioStore();
const epilogueStageMode = ref<EpilogueStageMode>("entry");
const currentCueIndex = ref(-1);
const isNavigating = ref(false);

let sequenceRunId = 0;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
let resolvePause: (() => void) | null = null;

const isEntryVisible = computed(
  () =>
    epilogueStageMode.value === "entry" ||
    epilogueStageMode.value === "starting",
);
const isComplete = computed(() => epilogueStageMode.value === "complete");
const currentSubtitle = computed(() => {
  const cueKey = epilogueNarrationCueKeys[currentCueIndex.value];

  return cueKey ? t(cueKey) : "";
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

const waitForPause = (durationMs: number) =>
  new Promise<void>((resolve) => {
    resolvePause = resolve;
    pauseTimer = setTimeout(() => {
      pauseTimer = null;
      resolvePause = null;
      resolve();
    }, durationMs);
  });

const stopEpilogue = () => {
  sequenceRunId++;
  clearPauseTimer();
  currentCueIndex.value = -1;
  narration.stop();
};

const startEpilogue = async () => {
  const runId = ++sequenceRunId;

  currentCueIndex.value = -1;
  isNavigating.value = false;
  audioStore.stopSeasonalAudio();
  audioStore.fadeOutBaseRhythmLoop(2);

  for (const [index, cueKey] of epilogueNarrationCueKeys.entries()) {
    if (runId !== sequenceRunId) return;

    currentCueIndex.value = index;
    const result = await narration.speakText(t(cueKey), {
      behavior: index === 0 ? "replace" : "queue",
    });

    if (runId !== sequenceRunId || result.status === "cancelled") return;

    await waitForPause(EPILOGUE_CUE_PAUSE_MS);
  }

  if (runId !== sequenceRunId) return;

  await waitForPause(EPILOGUE_FINAL_REFLECTION_PAUSE_MS);
  if (runId !== sequenceRunId) return;

  currentCueIndex.value = -1;
  epilogueStageMode.value = "complete";
};

const handleEntryContinue = () => {
  if (epilogueStageMode.value !== "entry") return;

  epilogueStageMode.value = "starting";
  epilogueStageMode.value = "running";
  void startEpilogue();
};

const handleEntryBack = async () => {
  if (epilogueStageMode.value === "starting") return;

  stopEpilogue();
  await navigateTo("/story/act-4");
};

const returnHome = async () => {
  if (isNavigating.value) return;

  isNavigating.value = true;
  stopEpilogue();
  audioStore.stopSeasonalAudio();
  audioStore.stopBaseRhythmLoop();
  await navigateTo("/");
};

usePresenterActions({
  enabled: computed(() => isComplete.value && !isNavigating.value),
  onPageDown: () => {
    void returnHome();
  },
});

onBeforeUnmount(() => {
  stopEpilogue();
  audioStore.stopSeasonalAudio();
  audioStore.stopBaseRhythmLoop();
});
</script>

<style scoped>
.epilogue-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #dce7dd;
  color: #ffffff;
}

.epilogue-progress {
  z-index: 900;
}

.epilogue-map {
  position: absolute;
  inset: 0;
}

.epilogue-map :deep(.bird-map) {
  width: 100%;
  height: 100%;
}

.epilogue-legend {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 40;
  display: grid;
  gap: 7px;
  min-width: 132px;
  padding: 10px 12px;
  border: 1px solid rgb(255 255 255 / 0.38);
  border-radius: 7px;
  background: rgb(13 19 16 / 0.62);
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 760;
  box-shadow: 0 16px 36px rgb(0 0 0 / 0.18);
  backdrop-filter: blur(12px);
}

.epilogue-legend__item {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.epilogue-legend__swatch {
  width: 20px;
  height: 4px;
  flex: 0 0 auto;
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.46);
}

.epilogue-completion {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: grid;
  place-content: center;
  gap: var(--space-4);
  padding: 92px 24px 72px 132px;
  background:
    radial-gradient(circle at center, rgb(9 17 13 / 0.34), transparent 46%),
    linear-gradient(180deg, rgb(7 12 9 / 0.18), rgb(7 12 9 / 0.56));
  color: #ffffff;
  text-align: center;
  text-shadow: 0 3px 18px rgb(0 0 0 / 0.48);
}

.epilogue-completion h1 {
  max-width: min(920px, calc(100vw - 180px));
  margin: 0;
  font-size: clamp(2.8rem, 6.4vw, 6.4rem);
  font-weight: 860;
  line-height: 0.98;
  letter-spacing: 0;
}

.epilogue-completion p {
  margin: 0;
  color: rgb(255 255 255 / 0.88);
  font-size: clamp(1rem, 1.6vw, 1.45rem);
  font-weight: 720;
}

.epilogue-completion__button {
  justify-self: center;
  min-height: 48px;
  margin-top: var(--space-3);
  padding: 0 var(--space-6);
  border: 1.5px solid #ffffff;
  border-radius: 7px;
  background: #ffffff;
  color: #1f3127;
  font: inherit;
  font-size: 0.98rem;
  font-weight: 820;
  cursor: pointer;
  box-shadow: 0 16px 36px rgb(0 0 0 / 0.18);
}

.epilogue-completion__button:hover,
.epilogue-completion__button:focus-visible {
  outline: 3px solid rgb(255 255 255 / 0.72);
  outline-offset: 3px;
}

.epilogue-completion-enter-active,
.epilogue-completion-leave-active {
  transition: opacity 420ms ease;
}

.epilogue-completion-enter-from,
.epilogue-completion-leave-to {
  opacity: 0;
}

@media (max-width: 860px) {
  .epilogue-legend {
    top: 16px;
    right: 16px;
  }

  .epilogue-completion {
    padding: 92px 20px 68px 88px;
  }

  .epilogue-completion h1 {
    max-width: calc(100vw - 124px);
  }
}
</style>
