<template>
  <section class="migration-act-controls">
    <div class="migration-act-controls__actions">
      <button
        v-if="showStoryAction"
        class="btn btn--primary"
        type="button"
        :disabled="store.isGestureActive"
        @click="onStoryAction"
      >
        {{ storyActionLabel }}
      </button>
      <button
        v-for="action in actions"
        :key="action.id"
        class="btn"
        :class="{ 'btn--primary': action.primary }"
        type="button"
        :disabled="action.disabled"
        @click="$emit('action', action.id)"
      >
        {{ action.label }}
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
      <button
        v-if="showResetAction"
        class="btn"
        type="button"
        @click="$emit('reset')"
      >
        Reset
      </button>
    </div>

    <div
      v-if="allowSingleCycle && isDebugMode"
      class="migration-act-controls__cycles"
    >
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
      <button
        class="migration-act-controls__auto-toggle"
        type="button"
        :class="{
          'migration-act-controls__auto-toggle--active': isAutoProgressEnabled,
        }"
        :aria-pressed="isAutoProgressEnabled"
        @click="$emit('toggle-auto-progress')"
      >
        <span
          class="migration-act-controls__auto-toggle-track"
          aria-hidden="true"
        >
          <span class="migration-act-controls__auto-toggle-thumb" />
        </span>
        <span>Auto Progress: {{ isAutoProgressEnabled ? "ON" : "OFF" }}</span>
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

    <button
      v-if="showDebugToggle"
      class="migration-act-controls__debug-toggle"
      type="button"
      :class="{ 'migration-act-controls__debug-toggle--active': isDebugMode }"
      :aria-pressed="isDebugMode"
      @click="$emit('toggle-debug')"
    >
      Debug
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import type {
  MigrationActCycleRun,
  MigrationInfoPanelAction,
  MigrationInfoPanelActionId,
} from "~/types/migrationAct";
import { getMigrationCycleButtonLabel } from "~/utils/migrationActs/config";

withDefaults(
  defineProps<{
    cycleRuns: MigrationActCycleRun[];
    allowSingleCycle: boolean;
    showStoryAction?: boolean;
    showResetAction?: boolean;
    showDebugToggle?: boolean;
    isDebugMode?: boolean;
    isAutoProgressEnabled?: boolean;
    actions?: readonly MigrationInfoPanelAction[];
  }>(),
  {
    showStoryAction: true,
    showResetAction: true,
    showDebugToggle: false,
    isDebugMode: false,
    isAutoProgressEnabled: false,
    actions: () => [],
  },
);

const emit = defineEmits<{
  "start-story": [];
  "start-cycle": [cycleRunId: string];
  pause: [];
  resume: [];
  reset: [];
  action: [actionId: MigrationInfoPanelActionId];
  "toggle-debug": [];
  "toggle-auto-progress": [];
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
  grid-template-columns: auto minmax(0, 1fr) auto max-content;
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

.migration-act-controls__auto-toggle {
  flex: 0 0 auto;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid rgb(31 49 39 / 18%);
  border-radius: 999px;
  background: rgb(255 255 255 / 72%);
  color: var(--color-text);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

.migration-act-controls__auto-toggle--active {
  border-color: color-mix(in srgb, var(--color-primary) 42%, transparent);
  background: color-mix(in srgb, var(--color-primary) 18%, white);
  color: var(--color-primary);
}

.migration-act-controls__auto-toggle-track {
  position: relative;
  width: 28px;
  height: 16px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgb(31 49 39 / 22%);
  transition: background 140ms ease;
}

.migration-act-controls__auto-toggle--active
  .migration-act-controls__auto-toggle-track {
  background: var(--color-primary);
}

.migration-act-controls__auto-toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgb(31 49 39 / 22%);
  transition: transform 140ms ease;
}

.migration-act-controls__auto-toggle--active
  .migration-act-controls__auto-toggle-thumb {
  transform: translateX(12px);
}

.migration-act-controls__debug-toggle {
  justify-self: end;
  min-height: 34px;
  padding: 5px 10px;
  border: 1px solid rgb(31 49 39 / 18%);
  border-radius: 999px;
  background: rgb(255 255 255 / 66%);
  color: color-mix(in srgb, var(--color-text) 68%, transparent);
  font-size: 0.72rem;
  font-weight: 850;
  line-height: 1;
  cursor: pointer;
}

.migration-act-controls__debug-toggle--active {
  border-color: color-mix(in srgb, var(--color-text) 36%, transparent);
  background: color-mix(in srgb, var(--color-text) 92%, black);
  color: #ffffff;
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
