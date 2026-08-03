<template>
  <section class="migration-act-controls">
    <div class="migration-act-controls__actions">
      <button
        class="btn btn--primary"
        type="button"
        :disabled="store.isGestureActive"
        @click="onStoryAction"
      >
        {{ storyActionLabel }}
      </button>
      <button
        v-if="store.playbackMode === 'single_cycle' && isActivePlayback"
        class="btn"
        type="button"
        :disabled="store.isGestureActive"
        @click="onPlaybackToggle"
      >
        {{ store.playbackState === "paused" ? "Resume" : "Pause" }}
      </button>
      <button class="btn" type="button" @click="$emit('reset')">Reset</button>
    </div>

    <div v-if="allowSingleCycle" class="migration-act-controls__cycles">
      <button
        v-for="cycle in cycleRuns"
        :key="cycle.id"
        class="btn migration-act-controls__cycle"
        :class="{
          'migration-act-controls__cycle--active':
            store.playbackMode === 'single_cycle' &&
            store.selectedCycleRunId === cycle.id,
        }"
        type="button"
        :aria-pressed="
          store.playbackMode === 'single_cycle' &&
          store.selectedCycleRunId === cycle.id
        "
        @click="$emit('start-cycle', cycle.id)"
      >
        {{ getMigrationCycleButtonLabel(cycle) }}
      </button>
    </div>

    <dl class="migration-act-controls__status">
      <div>
        <dt>Mode</dt>
        <dd>{{ store.playbackMode === "story" ? "Story" : "Single cycle" }}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{{ store.playbackState }}</dd>
      </div>
      <div>
        <dt>Cycle</dt>
        <dd>{{ activeCycleLabel }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import type { MigrationActCycleRun } from "~/types/migrationAct";
import { getMigrationCycleButtonLabel } from "~/utils/migrationActs/config";

defineProps<{
  cycleRuns: MigrationActCycleRun[];
  allowSingleCycle: boolean;
}>();

const emit = defineEmits<{
  "start-story": [];
  "start-cycle": [cycleRunId: string];
  pause: [];
  resume: [];
  reset: [];
}>();

const store = useMigrationActStore();
const isActivePlayback = computed(() =>
  [
    "playing",
    "paused",
    "gesture_lead_in",
    "gesture_playing",
    "cycle_transition",
  ].includes(store.playbackState),
);
const activeCycleLabel = computed(() =>
  store.activeCycleRun
    ? getMigrationCycleButtonLabel(store.activeCycleRun)
    : "–",
);
const storyActionLabel = computed(() => {
  if (store.playbackMode !== "story") return "Start Story";
  if (store.playbackState === "playing") return "Pause";
  if (store.playbackState === "paused") return "Resume";
  if (store.playbackState === "cycle_transition") {
    return store.hasUserPause ? "Resume" : "Pause";
  }
  if (store.playbackState === "completed") return "Restart";
  return "Start Story";
});

const onStoryAction = () => {
  if (store.playbackMode !== "story") {
    emit("start-story");
    return;
  }
  if (store.playbackState === "playing") {
    emit("pause");
    return;
  }
  if (store.playbackState === "paused") {
    emit("resume");
    return;
  }
  if (store.playbackState === "cycle_transition") {
    if (store.hasUserPause) emit("resume");
    else emit("pause");
    return;
  }
  emit("start-story");
};

const onPlaybackToggle = () => {
  if (store.playbackState === "paused") emit("resume");
  else emit("pause");
};
</script>

<style scoped>
.migration-act-controls {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
}

.migration-act-controls__actions,
.migration-act-controls__cycles,
.migration-act-controls__status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.migration-act-controls__cycles {
  min-width: 0;
  overflow-x: auto;
}

.migration-act-controls__cycle {
  min-height: 34px;
  padding: 5px 10px;
  white-space: nowrap;
}

.migration-act-controls__cycle--active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 14%, white);
}

.migration-act-controls__status {
  margin: 0;
}

.migration-act-controls__status div {
  display: grid;
  gap: 2px;
}

.migration-act-controls__status dt {
  color: var(--color-text-muted);
  font-size: 0.68rem;
  text-transform: uppercase;
}

.migration-act-controls__status dd {
  margin: 0;
  font-size: 0.8rem;
  white-space: nowrap;
}

@media (max-width: 1000px) {
  .migration-act-controls {
    grid-template-columns: 1fr;
  }
}
</style>
