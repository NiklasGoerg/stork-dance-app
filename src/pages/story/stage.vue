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
        <MigrationGestureCountdown
          v-if="countdownNumber"
          :gesture-id="gestureStore.activeGestureId ?? undefined"
          :count="countdownNumber"
          :initial="Boolean(store.initialCountdownNumber)"
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
          :source-aspect="instructorSourceAspect"
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
          :skeleton-visual-mode="skeletonVisualMode"
          :skeleton-pulse-progress="skeletonPulseProgress"
          @pose-landmarks="controller.handlePoseFrame"
        />
      </section>
    </template>

    <template #clock>
      <section
        class="season-clock-panel"
        :aria-label="t('story.aria.seasonClock')"
      >
        <SeasonClock
          fill-container
          :show-controls="false"
          :date="store.currentDate"
        >
          <span class="season-clock-panel__date">{{ store.currentDate }}</span>
        </SeasonClock>
      </section>
    </template>

    <template #guidance>
      <MigrationActInfoPanel
        :model="infoPanel.model.value"
        @action="handlePanelAction"
      />
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
        <details class="story-stage-controls__diagnostics">
          <summary>Diagnostics</summary>
          <dl>
            <div v-for="row in diagnosticRows" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
        </details>
      </section>
    </template>
  </MigrationStoryLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import BirdMap from "~/components/map/BirdMap.vue";
import MovementCamera from "~/components/movement/MovementCamera.vue";
import MovementStage from "~/components/movement/MovementStage.vue";
import MigrationActInfoPanel from "~/components/story/MigrationActInfoPanel.vue";
import MigrationGestureCountdown from "~/components/story/MigrationGestureCountdown.vue";
import MigrationStoryLayout from "~/components/story/MigrationStoryLayout.vue";
import SeasonClock from "~/components/story/SeasonClock.vue";
import StoryProgressSidebar from "~/components/story/StoryProgressSidebar.vue";
import { useMigrationActInfoPanelModel } from "~/composables/migrationActs/useMigrationActInfoPanelModel";
import { useMigrationGestureDiagnostics } from "~/composables/migrationActs/useMigrationGestureDiagnostics";
import { useMigrationActRuntime } from "~/composables/migrationActs/useMigrationActRuntime";
import { useAudioStore } from "~/store/audioStore";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import type {
  MigrationActCycleRun,
  MigrationInfoPanelActionId,
} from "~/types/migrationAct";
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
const gestureDiagnosticRows = useMigrationGestureDiagnostics();
const infoPanel = useMigrationActInfoPanelModel({
  showDevActions: true,
  completed: computed(() => store.playbackState === "completed"),
});

const activeSeasonId = computed(() =>
  store.currentDate ? getSeasonForDate(store.currentDate).id : "summer",
);
const countdownNumber = computed(
  () => store.initialCountdownNumber ?? gestureStore.countdownNumber,
);
const instructorLandmarks = computed(
  () =>
    (gestureStore.isActive
      ? controller.gestures.instructorFrame.value
      : controller.movement.instructorFrame.value
    )?.landmarks ?? null,
);
const instructorSourceAspect = computed(() =>
  gestureStore.isActive
    ? controller.gestures.instructorSourceAspect.value
    : controller.movement.sourceAspect.value,
);
const skeletonVisualMode = computed(() =>
  gestureStore.isActive
    ? controller.gestures.skeletonFeedbackState.value.mode
    : controller.movementRecognition.skeletonFeedbackState.value.mode,
);
const skeletonPulseProgress = computed(() =>
  gestureStore.isActive
    ? controller.gestures.pulseProgress.value
    : controller.movementRecognition.pulseProgress.value,
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
const diagnosticRows = computed(() => [
  ...gestureDiagnosticRows.value,
  { label: "State", value: store.playbackState },
  { label: "Mode", value: store.playbackMode },
  { label: "Phase", value: store.currentPhase ?? "none" },
  {
    label: "Event",
    value: controller.activeEvent.value?.eventType ?? "none",
  },
  { label: "Pauses", value: store.pauseReasons.join(", ") || "none" },
  {
    label: "Failed criteria",
    value:
      gestureStore.latestEvaluationResult?.failedCriteria.join(", ") || "none",
  },
  {
    label: "Beat",
    value: `${audioStore.baseRhythmPosition.currentBar}:${audioStore.baseRhythmPosition.currentBeat}`,
  },
  {
    label: "Calendar season",
    value: store.seasonAudio.currentSeason ?? "none",
  },
  { label: "Theme load", value: themeLoadLabel.value },
]);

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

const handlePanelAction = (actionId: MigrationInfoPanelActionId) => {
  if (actionId === "cancelGesture") gestureStore.cancelGesture();
  if (actionId === "markGestureSuccessful") {
    gestureStore.markGestureSuccessful();
  }
  if (actionId === "repeatGesture") gestureStore.repeatAttempt();
  if (actionId === "continueGesture") gestureStore.continueGesture();
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

.map-panel--gesture-active :deep(.bird-map) {
  filter: saturate(0.7) brightness(0.82);
  pointer-events: none;
}

.season-clock-panel {
  display: grid;
  place-items: center;
}

.season-clock-panel__date {
  font-weight: 700;
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

.story-stage-controls__diagnostics {
  grid-column: 1 / -1;
  font-size: 0.75rem;
}

.story-stage-controls__diagnostics summary {
  width: max-content;
  color: var(--color-text-muted);
  cursor: pointer;
  font-weight: 800;
}

.story-stage-controls__diagnostics dl {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
}

.story-stage-controls__diagnostics dl div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.story-stage-controls__diagnostics dd {
  margin: 0;
  text-align: right;
}

@media (max-width: 1050px) {
  .story-stage-controls {
    grid-template-columns: 1fr;
  }
}
</style>
