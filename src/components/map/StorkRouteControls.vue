<template>
  <div class="route-controls">
    <div class="mode-tabs" role="tablist" aria-label="Map mode">
      <button
        class="mode-tab"
        :class="{ active: selectedMapMode === 'explore' }"
        type="button"
        @click="selectedMapMode = 'explore'"
      >
        Explore
      </button>
      <button
        class="mode-tab"
        :class="{ active: selectedMapMode === 'all-years' }"
        type="button"
        @click="selectedMapMode = 'all-years'"
      >
        All years
      </button>
      <button
        class="mode-tab"
        :class="{ active: selectedMapMode === 'story' }"
        type="button"
        @click="selectedMapMode = 'story'"
      >
        Story
      </button>
    </div>

    <div v-if="selectedMapMode !== 'story'" class="field">
      <label for="stork-tag">Stork</label>
      <select
        id="stork-tag"
        v-model="selectedTag"
        class="input-modern"
        :disabled="isLoading || availableTags.length === 0"
      >
        <option v-for="tag in availableTags" :key="tag" :value="tag">
          {{ tag }}
        </option>
      </select>
    </div>

    <div v-if="selectedMapMode !== 'story'" class="field">
      <label for="stork-year">Year</label>
      <select
        id="stork-year"
        v-model.number="selectedYear"
        class="input-modern"
        :disabled="
          selectedMapMode === 'all-years' ||
          isLoading ||
          availableYears.length === 0
        "
      >
        <option v-for="year in availableYears" :key="year" :value="year">
          {{ year }}
        </option>
      </select>
    </div>

    <p v-if="isLoading" class="route-status">Loading migration data...</p>
    <p v-else-if="error" class="route-status route-status--error">
      {{ error }}
    </p>

    <div v-else-if="selectedMapMode === 'story'" class="route-slider">
      <label class="story-toggle">
        <input v-model="showStoryCyclesTogether" type="checkbox" >
        <span>Show cycles together</span>
      </label>

      <div class="route-slider__meta">
        <span>{{ storyLegend.length }} cycles</span>
        <span>{{ storyPointLabel }}</span>
      </div>

      <input
        v-model.number="selectedStoryIndex"
        class="route-slider__input route-slider__input--story"
        type="range"
        min="0"
        :max="storySliderMax"
        step="1"
        :disabled="storySliderMax <= 0"
      >

      <div class="year-legend">
        <div
          v-for="cycle in storyLegend"
          :key="cycle.id"
          class="year-legend__item year-legend__item--story"
        >
          <span
            class="year-legend__swatch"
            :style="{ backgroundColor: cycle.color }"
          />
          <span class="year-legend__year">Step {{ cycle.step }}</span>
          <span class="year-legend__meta">
            {{ cycle.targetYear }} - {{ cycle.tag }} - {{ cycle.wintering }} -
            {{ cycle.pointCount }} points
          </span>
        </div>
      </div>
    </div>

    <div v-else-if="selectedMapMode === 'all-years'" class="route-slider">
      <div class="route-slider__meta">
        <span>{{ yearLegend.length }} years</span>
        <span>Day {{ selectedDayOfYear }}</span>
      </div>

      <input
        v-model.number="selectedDayOfYear"
        class="route-slider__input"
        type="range"
        :min="comparisonDayMin"
        :max="comparisonDayMax"
        step="1"
        :disabled="comparisonDayMax <= comparisonDayMin"
      >

      <div class="year-legend">
        <div
          v-for="yearItem in yearLegend"
          :key="yearItem.year"
          class="year-legend__item"
        >
          <span
            class="year-legend__swatch"
            :style="{ backgroundColor: yearItem.color }"
          />
          <span class="year-legend__year">{{ yearItem.year }}</span>
          <span class="year-legend__meta">
            {{ yearItem.currentDate }} - {{ yearItem.pointCount }} points
          </span>
        </div>
      </div>
    </div>

    <div v-else class="route-slider">
      <div class="route-slider__meta">
        <span>{{ pointCount }} points</span>
        <span v-if="currentPointLabel">{{ currentPointLabel }}</span>
      </div>

      <input
        v-model.number="selectedPointIndex"
        class="route-slider__input"
        type="range"
        min="0"
        :max="Math.max(pointCount - 1, 0)"
        step="1"
        :disabled="pointCount <= 1"
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StorkMapMode } from "~/types/stork";

const selectedTag = defineModel<string>("selectedTag", { required: true });
const selectedYear = defineModel<number | null>("selectedYear", {
  required: true,
});
const selectedPointIndex = defineModel<number>("selectedPointIndex", {
  required: true,
});
const selectedDayOfYear = defineModel<number>("selectedDayOfYear", {
  required: true,
});
const selectedMapMode = defineModel<StorkMapMode>("selectedMapMode", {
  required: true,
});
const selectedStoryIndex = defineModel<number>("selectedStoryIndex", {
  required: true,
});
const showStoryCyclesTogether = defineModel<boolean>(
  "showStoryCyclesTogether",
  {
    required: true,
  },
);

defineProps<{
  availableTags: string[];
  availableYears: number[];
  pointCount: number;
  currentPointLabel: string;
  comparisonDayMin: number;
  comparisonDayMax: number;
  yearLegend: {
    year: number;
    color: string;
    pointCount: number;
    currentDate: string;
  }[];
  storySliderMax: number;
  storyPointLabel: string;
  storyLegend: {
    id: string;
    step: number;
    targetYear: number;
    tag: string;
    color: string;
    wintering: string;
    pointCount: number;
  }[];
  isLoading: boolean;
  error: string | null;
}>();
</script>

<style scoped>
.route-controls {
  position: absolute;
  top: 14px;
  left: 54px;
  z-index: 500;
  display: grid;
  grid-template-columns: minmax(120px, 160px) minmax(96px, 120px);
  gap: 12px;
  align-items: end;
  max-width: calc(100% - 72px);
  width: min(460px, calc(100% - 72px));
  padding: 14px;
  border: 1px solid rgba(22, 22, 22, 0.12);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: var(--shadow-panel);
}

.mode-tabs {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.mode-tab {
  min-height: 30px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 550;
}

.mode-tab:hover,
.mode-tab:focus-visible {
  background: var(--color-neutral-btn-hover);
}

.mode-tab.active {
  background: var(--color-primary);
  color: #fff;
}

.route-status {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.86rem;
}

.route-status--error {
  color: var(--color-danger);
}

.route-slider {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.story-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 550;
}

.route-slider__meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-text-muted);
  font-size: 0.86rem;
}

.route-slider__input {
  width: 100%;
  accent-color: var(--color-primary);
}

.route-slider__input--story {
  accent-color: #1f77b4;
}

.year-legend {
  display: grid;
  gap: 4px;
  max-height: 220px;
  overflow: auto;
  padding-top: 2px;
}

.year-legend__item {
  display: grid;
  grid-template-columns: 10px 42px 1fr;
  gap: 7px;
  align-items: center;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.year-legend__item--story {
  grid-template-columns: 10px 54px minmax(0, 1fr);
}

.year-legend__swatch {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.year-legend__year {
  color: var(--color-text);
  font-weight: 650;
}

.year-legend__meta {
  min-width: 0;
  white-space: nowrap;
}

@media (max-width: 560px) {
  .route-controls {
    left: 48px;
    grid-template-columns: 1fr;
  }
}
</style>
