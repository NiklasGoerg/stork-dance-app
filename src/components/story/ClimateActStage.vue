<template>
  <main class="climate-act-page">
    <section
      class="climate-act-context"
      :aria-label="t('story.aria.context', { title: actTitle })"
    >
      <StoryProgressSidebar />

      <div class="climate-act-context__group">
        <p class="climate-act-context__eyebrow">
          {{ t("story.acts.act5.periodEyebrow") }}
        </p>
        <h1>{{ periodLabel }}</h1>
        <p class="climate-act-context__season">{{ currentSeasonLabel }}</p>

        <SeasonClock :show-controls="false">
          <span class="climate-act-clock-date">{{ currentDate }}</span>
        </SeasonClock>

        <p class="climate-act-context__optional">{{ periodContext }}</p>
      </div>
    </section>

    <section
      class="climate-act-stage"
      :aria-label="t('story.aria.stage', { title: actTitle })"
    >
      <section
        class="climate-act-comparison"
        :aria-label="t('story.aria.support', { title: actTitle })"
      >
        <section
          class="climate-act-avatar"
          :aria-label="t('story.aria.instructor')"
        >
          <MovementStage
            :landmarks="instructorLandmarks"
            source-mode="recorded-motion"
            :source-aspect="instructorSourceAspect"
            :fill-frame="true"
          />
          <div v-if="countdownRemaining > 0" class="climate-act-countdown">
            {{ countdownRemaining }}
          </div>
        </section>

        <section
          class="climate-act-camera"
          :aria-label="t('story.aria.userMirror')"
        >
          <MovementCamera mode="camera" :fixed="false" :show-hands="false" />
        </section>
      </section>

      <section class="climate-act-info" :aria-label="activeSceneTitle">
        <p class="climate-act-info__eyebrow">{{ currentDate }}</p>
        <h2>{{ instructionTitle }}</h2>
        <p>{{ instructionText }}</p>
      </section>
    </section>

    <section
      class="climate-act-bottom-bar"
      :aria-label="t('story.aria.runtimeMetadata')"
    >
      <div class="climate-act-bottom-bar__actions">
        <button class="btn btn--primary" type="button" @click="togglePlayback">
          {{ playbackToggleLabel }}
        </button>
        <button class="btn" type="button" @click="resetCycle">
          {{ t("story.acts.act5.controls.reset") }}
        </button>
        <button
          v-if="runtimeStore.showContinueGate"
          class="btn btn--primary"
          type="button"
          @click="continueToNextAct"
        >
          {{ t("common.continue") }}
        </button>
      </div>

      <dl class="climate-act-bottom-bar__meta">
        <div>
          <dt>{{ t("story.acts.act5.status.state") }}</dt>
          <dd>{{ playbackState }}</dd>
        </div>
        <div>
          <dt>{{ t("story.acts.act5.status.season") }}</dt>
          <dd>{{ currentSeasonLabel }}</dd>
        </div>
        <div>
          <dt>{{ t("story.acts.act5.status.repetition") }}</dt>
          <dd>{{ repetitionLabel }}</dd>
        </div>
        <div>
          <dt>{{ t("story.acts.act5.status.time") }}</dt>
          <dd>{{ timeLabel }}</dd>
        </div>
      </dl>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useSeasonalLearningCycle } from "~/composables/useSeasonalLearningCycle";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import { act5IntroCycleConfig } from "~/story/act5IntroCycle";
import type { StoryAct } from "~/story/types";

const props = defineProps<{
  act: StoryAct;
}>();

const { t, translate, getActTitle, getSceneTitle, getSceneNarration } =
  useStoryTranslations();
const storyEngine = useStoryEngine();
const runtimeStore = useStoryRuntimeStore();
const {
  currentDate,
  currentFrame: instructorFrame,
  currentMovementSourceAspect: instructorSourceAspect,
  currentSeason,
  countdownRemaining,
  elapsedMs,
  isCountingDown,
  isCompleted,
  isTransition,
  playbackState,
  repetitionIndex,
  showInstructorAvatar,
  totalDurationMs,
  cleanup,
  initialize,
  pause,
  play,
  reset,
} = useSeasonalLearningCycle(act5IntroCycleConfig);

const act = computed(() => props.act);
const actTitle = computed(() => getActTitle(act.value));
const activeScene = computed(() =>
  runtimeStore.currentActId === act.value.id
    ? (runtimeStore.currentScene ?? act.value.scenes[0] ?? null)
    : (act.value.scenes[0] ?? null),
);
const activeSceneTitle = computed(() =>
  activeScene.value ? getSceneTitle(activeScene.value) : actTitle.value,
);
const activeSceneNarration = computed(() =>
  activeScene.value ? getSceneNarration(activeScene.value) : "",
);
const currentSeasonLabel = computed(() => {
  const season = currentSeason.value;

  return season.labelKey ? t(season.labelKey) : season.label;
});
const periodLabel = computed(() => {
  const scene = activeScene.value;

  return scene?.periodLabel
    ? translate(
        scene.periodLabelKey,
        scene.periodLabel,
        scene.periodLabelParams,
      )
    : t("story.acts.act5.periodPlaceholder");
});
const periodContext = computed(() => {
  const scene = activeScene.value;

  return scene?.periodContext
    ? translate(
        scene.periodContextKey,
        scene.periodContext,
        scene.periodContextParams,
      )
    : t("story.acts.act5.contextPlaceholder");
});
const instructorLandmarks = computed(() =>
  showInstructorAvatar.value
    ? (instructorFrame.value?.landmarks ?? null)
    : null,
);
const playbackToggleLabel = computed(() =>
  playbackState.value === "playing" || playbackState.value === "countdown"
    ? t("story.acts.act5.controls.pause")
    : t("story.acts.act5.controls.play"),
);
const instructionTitle = computed(() => {
  if (isCompleted.value) return t("story.acts.act5.instructions.completed");
  if (isCountingDown.value) {
    return t("story.acts.act5.instructions.countdown", {
      count: countdownRemaining.value,
    });
  }

  return t("story.acts.act5.instructions.learn", {
    season: currentSeasonLabel.value,
  });
});
const instructionText = computed(() => {
  if (isCompleted.value) return activeSceneNarration.value;
  if (isCountingDown.value) return t("story.acts.act5.instructions.ready");
  if (isTransition.value) return t("story.acts.act5.instructions.transition");
  if (playbackState.value === "idle") {
    return t("story.acts.act5.instructions.ready");
  }
  if (playbackState.value === "paused") {
    return t("story.acts.act5.instructions.paused");
  }

  return t("story.acts.act5.instructions.repeat");
});
const repetitionLabel = computed(() =>
  repetitionIndex.value === null
    ? t("story.acts.act5.status.transition")
    : t("story.acts.act5.status.repetitionCount", {
        current: repetitionIndex.value + 1,
        total: act5IntroCycleConfig.repetitionCount,
      }),
);
const timeLabel = computed(
  () =>
    `${(elapsedMs.value / 1000).toFixed(1)} / ${(totalDurationMs / 1000).toFixed(0)} s`,
);
const togglePlayback = async () => {
  if (
    playbackState.value === "playing" ||
    playbackState.value === "countdown"
  ) {
    pause();
    return;
  }

  await play();
};
const resetCycle = async () => {
  await reset();
};

const continueToNextAct = async () => {
  const nextActId = runtimeStore.currentAct?.nextActId;

  storyEngine.continueFromGate();

  if (!nextActId) return;

  await navigateTo(`/story/${nextActId}`);
};

onMounted(() => {
  storyEngine.startAct(act.value.id);
  void initialize();
});

onBeforeUnmount(() => {
  cleanup();
  storyEngine.stopStoryEngine();
});
</script>

<style scoped>
.climate-act-page {
  --climate-act-bottom-bar-height: clamp(64px, 8dvh, 84px);
  --climate-act-comparison-size: 25vw;
  --climate-act-clock-size: clamp(300px, 32vw, 430px);

  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-columns: 50% 50%;
  overflow: hidden;
  background: #edf2ef;
}

.climate-act-context,
.climate-act-stage,
.climate-act-comparison,
.climate-act-avatar,
.climate-act-camera,
.climate-act-info,
.climate-act-bottom-bar {
  min-width: 0;
  min-height: 0;
}

.climate-act-context {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: clamp(28px, 5vw, 72px);
  padding-bottom: calc(var(--climate-act-bottom-bar-height) + 28px);
  padding-left: clamp(96px, 10vw, 132px);
  border-right: 1px solid rgba(36, 54, 42, 0.16);
  background:
    linear-gradient(
      180deg,
      rgba(252, 253, 248, 0.72),
      rgba(237, 242, 239, 0.94)
    ),
    #edf2ef;
  color: #26382f;
}

.climate-act-context__group {
  width: min(100%, 520px);
  display: grid;
  justify-items: center;
  gap: clamp(8px, 1.4dvh, 16px);
  text-align: center;
}

.climate-act-context__eyebrow,
.climate-act-context__optional {
  margin: 0;
  color: rgba(31, 49, 39, 0.58);
  font-size: clamp(0.72rem, 0.85vw, 0.9rem);
  font-weight: 800;
  text-transform: uppercase;
}

.climate-act-context h1 {
  max-width: 100%;
  margin: 0;
  overflow-wrap: anywhere;
  color: #17241c;
  font-size: clamp(2.35rem, 5vw, 5.25rem);
  line-height: 0.98;
}

.climate-act-context__season {
  margin: 0 0 clamp(4px, 0.8dvh, 10px);
  color: #26382f;
  font-size: clamp(1.2rem, 2vw, 2rem);
  font-weight: 750;
}

.climate-act-context :deep(.season-clock) {
  width: var(--climate-act-clock-size);
  max-width: min(
    100%,
    calc(100dvh - var(--climate-act-bottom-bar-height) - 260px)
  );
  gap: 8px;
  padding: clamp(10px, 1.4vw, 16px);
  background: rgba(250, 253, 248, 0.9);
  box-shadow: 0 12px 32px rgba(31, 49, 39, 0.12);
}

.climate-act-clock-date {
  color: #26382f;
  font-size: clamp(0.72rem, 0.8vw, 0.84rem);
  font-weight: 800;
}

.climate-act-stage {
  display: grid;
  grid-template-rows: var(--climate-act-comparison-size) minmax(0, 1fr);
  padding-bottom: var(--climate-act-bottom-bar-height);
  background:
    linear-gradient(
      180deg,
      rgba(252, 253, 248, 0.96),
      rgba(232, 240, 235, 0.92)
    ),
    #eef3ef;
}

.climate-act-comparison {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-bottom: 1px solid rgba(36, 54, 42, 0.14);
}

.climate-act-avatar,
.climate-act-camera {
  position: relative;
  overflow: hidden;
}

.climate-act-avatar {
  border-right: 1px solid rgba(36, 54, 42, 0.14);
}

.climate-act-countdown {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(23, 36, 28, 0.84);
  font-size: clamp(3.6rem, 8vw, 7rem);
  font-weight: 850;
  line-height: 1;
  pointer-events: none;
  text-shadow: 0 2px 18px rgba(248, 251, 247, 0.86);
}

.climate-act-camera {
  background: #121714;
}

.climate-act-camera :deep(.container) {
  border-radius: 0;
}

.climate-act-camera :deep(.video),
.climate-act-camera :deep(.canvas) {
  object-fit: cover;
}

.climate-act-info {
  display: grid;
  align-content: start;
  gap: 10px;
  overflow: auto;
  padding: clamp(18px, 2.1vw, 28px);
  background:
    linear-gradient(
      180deg,
      rgba(249, 252, 248, 0.96),
      rgba(240, 246, 242, 0.94)
    ),
    #f4f8f5;
  color: #26382f;
}

.climate-act-info__eyebrow {
  margin: 0;
  color: rgba(31, 49, 39, 0.58);
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
}

.climate-act-info h2 {
  margin: 0;
  color: #17241c;
  font-size: clamp(1.35rem, 2.1vw, 2.35rem);
  line-height: 1.08;
}

.climate-act-info p {
  max-width: 62ch;
  margin: 0;
  color: rgba(31, 49, 39, 0.76);
  font-size: clamp(0.94rem, 1vw, 1.08rem);
}

.climate-act-bottom-bar {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(220px, max-content) minmax(0, 1fr);
  align-items: center;
  gap: clamp(12px, 2vw, 24px);
  height: var(--climate-act-bottom-bar-height);
  padding: 8px clamp(14px, 2vw, 24px);
  border-top: 1px solid rgba(31, 49, 39, 0.16);
  background: rgba(248, 251, 247, 0.96);
  color: #26382f;
  box-shadow: 0 -10px 28px rgba(32, 50, 40, 0.1);
  backdrop-filter: blur(10px);
}

.climate-act-bottom-bar__actions {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.climate-act-bottom-bar__actions .btn {
  min-height: 30px;
  padding: 5px 10px;
  font-size: 0.72rem;
}

.climate-act-bottom-bar__actions .btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.climate-act-bottom-bar__meta {
  display: flex;
  gap: clamp(14px, 3vw, 34px);
  min-width: 0;
  max-height: 100%;
  margin: 0;
  overflow: auto hidden;
  font-size: 0.72rem;
}

.climate-act-bottom-bar__meta div {
  flex: 0 0 auto;
  min-width: 0;
  max-width: min(34vw, 360px);
}

.climate-act-bottom-bar__meta dt {
  color: rgba(31, 49, 39, 0.58);
  font-size: 0.64rem;
  font-weight: 800;
  text-transform: uppercase;
}

.climate-act-bottom-bar__meta dd {
  margin: 2px 0 0;
  overflow: hidden;
  color: #26382f;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1180px) {
  .climate-act-page {
    --climate-act-clock-size: clamp(260px, 34vw, 360px);
  }

  .climate-act-bottom-bar {
    grid-template-columns: minmax(180px, max-content) minmax(0, 1fr);
  }
}

@media (max-width: 860px) {
  .climate-act-page {
    --climate-act-bottom-bar-height: 84px;
    --climate-act-clock-size: clamp(220px, 36vw, 300px);
  }

  .climate-act-context {
    padding: 20px;
    padding-bottom: calc(var(--climate-act-bottom-bar-height) + 18px);
    padding-left: 86px;
  }

  .climate-act-context h1 {
    font-size: clamp(1.85rem, 6vw, 3.2rem);
  }

  .climate-act-bottom-bar {
    grid-template-columns: 1fr;
    align-content: center;
    overflow: auto hidden;
  }
}
</style>
