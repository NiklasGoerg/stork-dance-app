<template>
  <MigrationStoryLayout
    :season="activeSeasonId"
    :map-aria-label="t('storyStage.aria.map')"
    :stage-aria-label="t('storyStage.aria.movementStage')"
    :controls-aria-label="t('storyStage.aria.gestureTestControls')"
  >
    <template #map>
      <section
        class="map-panel"
        :class="{ 'map-panel--gesture-active': store.isGestureActive }"
      >
        <BirdMap
          data-source="story"
          playback-source="migration-runtime"
          :story-cycle-definitions="storyCycleDefinitions"
          :story-cycle-ids="store.activeCycleId ? [store.activeCycleId] : []"
          :single-story-cycle-mode="true"
          @story-frame="controller.reportMapFrame"
        />
        <StoryProgressSidebar />
        <StoryGestureOverlay
          :gesture-label="gestureLabel"
          :state="gestureStore.state"
          :feedback-text="gestureStore.feedbackText"
          :show-dev-controls="true"
          @mark="gestureStore.markGestureSuccessful"
          @repeat="gestureStore.repeatAttempt"
          @cancel="gestureStore.cancelGesture"
        />
      </section>
    </template>

    <template #avatar>
      <section
        class="avatar-stage"
        :aria-label="t('storyStage.aria.avatarStage')"
      >
        <MovementStage
          :landmarks="instructorLandmarks"
          source-mode="recorded-motion"
          :source-aspect="controller.gestures.instructorSourceAspect.value"
          :fill-frame="true"
        />
      </section>
    </template>

    <template #camera>
      <section
        class="user-mirror-panel"
        :aria-label="t('story.aria.userMirror')"
      >
        <MovementCamera
          mode="camera"
          :fixed="false"
          :show-hands="false"
          @pose-landmarks="controller.handlePoseFrame"
        />
      </section>
    </template>

    <template #clock>
      <section
        class="season-clock-panel"
        :aria-label="t('story.aria.seasonClock')"
      >
        <SeasonClock :show-controls="false" :date="store.currentDate">
          <span class="season-clock-panel__date">{{ store.currentDate }}</span>
        </SeasonClock>
      </section>
    </template>

    <template #guidance>
      <section
        class="story-info-panel"
        :aria-label="t('storyStage.aria.gestureDebug')"
      >
        <p class="story-info-panel__eyebrow">{{ store.currentDate }}</p>
        <h1>{{ gestureLabel }}</h1>
        <p>{{ gestureStore.feedbackText || playbackLabel }}</p>
        <dl class="story-info-panel__debug">
          <div>
            <dt>State</dt>
            <dd>{{ store.playbackState }}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{{ store.playbackMode }}</dd>
          </div>
          <div>
            <dt>Phase</dt>
            <dd>{{ store.currentPhase }}</dd>
          </div>
          <div>
            <dt>Event</dt>
            <dd>{{ activeEventLabel }}</dd>
          </div>
          <div>
            <dt>Pauses</dt>
            <dd>{{ store.pauseReasons.join(", ") || "none" }}</dd>
          </div>
          <div>
            <dt>Beat</dt>
            <dd>
              {{ audioStore.baseRhythmPosition.currentBar }}:{{
                audioStore.baseRhythmPosition.currentBeat
              }}
            </dd>
          </div>
          <div>
            <dt>Calendar season</dt>
            <dd>{{ store.seasonAudio.currentSeason ?? "none" }}</dd>
          </div>
          <div>
            <dt>Theme load</dt>
            <dd>{{ themeLoadLabel }}</dd>
          </div>
        </dl>
      </section>
    </template>

    <template #controls>
      <section class="story-stage-controls">
        <div class="story-stage-controls__actions">
          <button
            class="btn btn--primary"
            type="button"
            :disabled="store.isGestureActive"
            @click="togglePlayback"
          >
            {{ playbackButtonLabel }}
          </button>
          <button class="btn" type="button" @click="controller.reset">
            Reset
          </button>
          <button
            class="btn"
            type="button"
            :disabled="store.isPlaying || store.isGestureActive"
            @click="controller.startManualGesture('departure')"
          >
            {{ t("storyStage.controls.testDepartureGesture") }}
          </button>
          <button
            class="btn"
            type="button"
            :disabled="store.isPlaying || store.isGestureActive"
            @click="controller.startManualGesture('arrival')"
          >
            {{ t("storyStage.controls.testArrivalGesture") }}
          </button>
        </div>

        <div class="story-stage-controls__cycles">
          <button
            v-for="cycle in cycleRuns"
            :key="cycle.id"
            class="btn"
            :class="{
              'story-stage-controls__cycle--active':
                store.activeCycleId === cycle.cycleId,
            }"
            type="button"
            @click="controller.selectCycle(cycle.cycleId)"
          >
            {{ getMigrationCycleButtonLabel(cycle) }}
          </button>
        </div>

        <label class="story-stage-controls__seek">
          <span>{{ (store.currentElapsedMs / 1000).toFixed(2) }} s</span>
          <input
            type="range"
            min="0"
            :max="store.cycleDurationMs"
            step="10"
            :value="store.currentElapsedMs"
            @input="seekFromInput"
          />
        </label>
      </section>
    </template>
  </MigrationStoryLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import BirdMap from "~/components/map/BirdMap.vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import MigrationStoryLayout from "~/components/story/MigrationStoryLayout.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import StoryGestureOverlay from "~/components/story/StoryGestureOverlay.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useMigrationActRuntime } from "~/composables/migrationActs/useMigrationActRuntime";
import { useAudioStore } from "~/store/audioStore";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import type { MigrationActCycleRun } from "~/types/migrationAct";
import { getMigrationCycleButtonLabel } from "~/utils/migrationActs/config";
import { migrationStoryCycleDefinitions as storyCycleDefinitions } from "~/utils/migrationStoryData";
import { getSeasonForDate } from "~/utils/storyCycle";

const { t } = useI18n();
const store = useMigrationActStore();
const audioStore = useAudioStore();
const cycleRuns: MigrationActCycleRun[] = storyCycleDefinitions.map(
  (cycle, index) => ({
    id: `story-stage:${cycle.label}:${index}`,
    cycleId: cycle.label,
    cycleStartYear: cycle.targetYear,
    title: getMigrationCycleButtonLabel({
      id: cycle.label,
      cycleId: cycle.label,
      cycleStartYear: cycle.targetYear,
      title: "",
    }),
  }),
);
const controller = useMigrationActRuntime({
  surfaceId: "story-stage",
  cycleRuns,
});
const gestureStore = controller.gestures.store;

const activeSeasonId = computed(() =>
  store.currentDate ? getSeasonForDate(store.currentDate).id : "summer",
);
const instructorLandmarks = computed(
  () => controller.gestures.instructorFrame.value?.landmarks ?? null,
);
const gestureLabel = computed(
  () =>
    controller.activeEvent.value?.eventType.replace("_", " ") ??
    gestureStore.activeGesture?.label ??
    "Migration Runtime",
);
const activeEventLabel = computed(
  () => controller.activeEvent.value?.eventType ?? "none",
);
const playbackLabel = computed(
  () =>
    `${store.playbackState} at ${(store.currentElapsedMs / 1000).toFixed(2)} s`,
);
const themeLoadLabel = computed(
  () =>
    store.seasonAudio.error ||
    (store.seasonAudio.isReady ? "ready" : "loading"),
);
const playbackButtonLabel = computed(() => {
  if (store.playbackState === "playing")
    return t("storyStage.controls.pauseStory");
  if (store.playbackState === "paused") return "Resume";
  if (store.playbackState === "completed") return "Restart";
  return t("storyStage.controls.playStory");
});

const togglePlayback = () => {
  if (store.playbackState === "playing") controller.pause();
  else if (store.playbackState === "paused") void controller.resume();
  else if (store.activeCycleRun)
    void controller.startSingleCycle(store.activeCycleRun.id);
};

const seekFromInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  void controller.seekToElapsedMs(value);
};

onMounted(() => void controller.initialize());
onBeforeUnmount(() => controller.dispose());
</script>

<style scoped>
.map-panel,
.avatar-stage,
.user-mirror-panel,
.season-clock-panel {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.avatar-stage,
.user-mirror-panel {
  background: #121714;
}

.map-panel--gesture-active :deep(.leaflet-container) {
  filter: saturate(0.7) brightness(0.82);
}

.season-clock-panel {
  display: grid;
  place-items: center;
}

.season-clock-panel__date,
.story-info-panel__eyebrow {
  font-weight: 700;
}

.story-info-panel__debug {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.story-info-panel__debug div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.story-info-panel__debug dd {
  margin: 0;
  text-align: right;
}

.story-stage-controls {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(180px, 0.6fr);
  align-items: center;
  gap: var(--space-3);
}

.story-stage-controls__actions,
.story-stage-controls__cycles {
  display: flex;
  gap: var(--space-2);
}

.story-stage-controls__cycles {
  overflow-x: auto;
}

.story-stage-controls__cycle--active {
  border-color: var(--color-primary);
}

.story-stage-controls__seek {
  display: grid;
  gap: 3px;
  font-size: 0.8rem;
}

@media (max-width: 1050px) {
  .story-stage-controls {
    grid-template-columns: 1fr;
  }
}
</style>
