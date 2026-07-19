<template>
  <main class="story-runtime-page">
    <section class="story-runtime-panel" aria-labelledby="story-runtime-title">
      <p class="story-runtime-eyebrow">Data Dance</p>
      <h1 id="story-runtime-title">{{ act.title }}</h1>

      <dl class="story-runtime-meta" aria-label="Act runtime metadata">
        <div>
          <dt>Layout</dt>
          <dd>{{ act.layout }}</dd>
        </div>
        <div>
          <dt>Scene</dt>
          <dd>{{ currentSceneLabel }}</dd>
        </div>
      </dl>

      <section v-if="runtimeStore.currentScene" class="story-runtime-scene">
        <p>{{ runtimeStore.currentScene.title }}</p>
        <span v-if="runtimeStore.currentScene.narration">
          {{ runtimeStore.currentScene.narration }}
        </span>
      </section>

      <div class="story-runtime-actions" aria-label="Story runtime controls">
        <button
          class="story-runtime-button"
          type="button"
          @click="storyEngine.startAct(act.id)"
        >
          Start Act
        </button>
        <button
          class="story-runtime-button"
          type="button"
          :disabled="!isActiveAct || runtimeStore.showContinueGate"
          @click="storyEngine.goToNextScene()"
        >
          Next Scene
        </button>
        <button
          v-if="runtimeStore.showContinueGate"
          class="story-runtime-button story-runtime-button--primary"
          type="button"
          @click="continueToNextAct"
        >
          Continue
        </button>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useStoryEngine } from "~/composables/useStoryEngine";
import { useStoryRuntimeStore } from "~/store/storyRuntimeStore";
import type { StoryAct } from "~/story/types";

const props = defineProps<{
  act: StoryAct;
}>();

const runtimeStore = useStoryRuntimeStore();
const storyEngine = useStoryEngine();

const isActiveAct = computed(() => runtimeStore.currentActId === props.act.id);

const currentSceneLabel = computed(() => {
  if (!isActiveAct.value) return "Not started";

  return `${runtimeStore.currentSceneIndex + 1} / ${props.act.scenes.length}`;
});

const continueToNextAct = async () => {
  const nextActId = runtimeStore.currentAct?.nextActId;

  storyEngine.continueFromGate();

  if (!nextActId) return;

  await navigateTo(`/story/${nextActId}`);
};

onMounted(() => {
  storyEngine.startAct(props.act.id);
});

onBeforeUnmount(() => {
  storyEngine.stopStoryEngine();
});
</script>

<style scoped>
.story-runtime-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #edf3ee;
  color: #17211b;
  text-align: center;
}

.story-runtime-panel {
  width: min(720px, 100%);
  display: grid;
  gap: 18px;
}

.story-runtime-eyebrow,
.story-runtime-panel h1,
.story-runtime-scene p,
.story-runtime-scene span,
.story-runtime-meta {
  margin: 0;
}

.story-runtime-eyebrow {
  color: rgba(30, 48, 38, 0.68);
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.story-runtime-panel h1 {
  font-size: clamp(2.2rem, 6vw, 4rem);
  line-height: 1.05;
}

.story-runtime-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.story-runtime-meta div {
  min-width: 150px;
  padding: 10px 12px;
  border: 1px solid rgba(30, 48, 38, 0.14);
  border-radius: 8px;
  background: rgba(250, 252, 249, 0.72);
}

.story-runtime-meta dt {
  color: rgba(30, 48, 38, 0.56);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.story-runtime-meta dd {
  margin: 3px 0 0;
  color: #26382f;
  font-weight: 700;
}

.story-runtime-scene {
  display: grid;
  gap: 8px;
}

.story-runtime-scene p {
  color: #26382f;
  font-size: 1.2rem;
  font-weight: 750;
}

.story-runtime-scene span {
  color: rgba(30, 48, 38, 0.72);
  font-size: 1.02rem;
}

.story-runtime-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.story-runtime-button {
  min-height: 42px;
  padding: 10px 14px;
  border: 1px solid rgba(30, 48, 38, 0.16);
  border-radius: 8px;
  background: #ffffff;
  color: #26382f;
  font-weight: 750;
  cursor: pointer;
}

.story-runtime-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.story-runtime-button--primary {
  border-color: #26382f;
  background: #26382f;
  color: #ffffff;
}
</style>
