<template>
  <section
    class="season-clock"
    :style="seasonClockStyle"
    :aria-label="t('seasonClock.aria.clock')"
  >
    <svg
      class="season-clock__svg"
      viewBox="0 0 360 360"
      role="img"
      :aria-label="clockLabel"
    >
      <defs>
        <filter
          id="season-clock-active-glow"
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle
        class="season-clock__base-disc"
        :cx="center"
        :cy="center"
        r="126"
      />

      <g aria-hidden="true">
        <template v-for="segment in seasonSegments" :key="segment.season.id">
          <path
            v-if="segment.isActive"
            class="season-clock__season-outline"
            :d="segment.path"
          />
          <path
            class="season-clock__season"
            :class="[
              `season-clock__season--${segment.season.id}`,
              { 'season-clock__season--active': segment.isActive },
            ]"
            :d="segment.path"
          />
        </template>
      </g>

      <g class="season-clock__season-labels" aria-hidden="true">
        <text
          v-for="segment in seasonSegments"
          :key="`${segment.season.id}-label`"
          class="season-clock__season-label"
          :class="{ 'season-clock__season-label--active': segment.isActive }"
          :x="segment.labelPosition.x"
          :y="segment.labelPosition.y"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {{ getSeasonLabel(segment.season) }}
        </text>
      </g>

      <g class="season-clock__ticks" aria-hidden="true">
        <line
          v-for="month in monthMarkers"
          :key="month.labelKey ?? month.label"
          class="season-clock__tick"
          :x1="month.tickInner.x"
          :y1="month.tickInner.y"
          :x2="month.tickOuter.x"
          :y2="month.tickOuter.y"
        />
      </g>

      <g class="season-clock__labels" aria-hidden="true">
        <text
          v-for="month in monthMarkers"
          :key="month.label"
          class="season-clock__month-label"
          :class="{ 'season-clock__month-label--active': month.isActive }"
          :x="month.labelPosition.x"
          :y="month.labelPosition.y"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {{ getMonthLabel(month) }}
        </text>
      </g>

      <g class="season-clock__pointer" :style="pointerStyle" aria-hidden="true">
        <line
          class="season-clock__pointer-line season-clock__pointer-line--backdrop"
          :x1="center"
          :y1="center"
          :x2="center + pointerRadius"
          :y2="center"
        />
        <line
          class="season-clock__pointer-line"
          :x1="center"
          :y1="center"
          :x2="center + pointerRadius"
          :y2="center"
        />
        <circle
          class="season-clock__pointer-dot"
          :cx="center + pointerRadius"
          :cy="center"
          r="6"
        />
      </g>

      <circle class="season-clock__center" :cx="center" :cy="center" r="46" />

      <foreignObject x="128" y="128" width="104" height="104">
        <div class="season-clock__center-content">
          <slot />
        </div>
      </foreignObject>
    </svg>

    <SeasonClockControls
      v-if="showControls"
      :is-playing="isPlaying"
      @toggle-playback="playbackStore.togglePlayback"
      @reset="playbackStore.resetToStoryStart"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import SeasonClockControls from "~/components/story/SeasonClockControls.vue";
import { useStoryPlaybackStore } from "~/store/storyPlayback";
import {
  dateToAngle,
  getMonthBoundariesForCycle,
  getSeasonBoundariesForCycle,
  getSeasonForDate,
} from "~/utils/storyCycle";

const { t } = useI18n();

withDefaults(
  defineProps<{
    showControls?: boolean;
  }>(),
  {
    showControls: true,
  },
);

const center = 180;
const outerRadius = 124;
const innerRadius = 42;
const pointerRadius = 128;
const tickInnerRadius = 130;
const tickOuterRadius = 141;
const labelRadius = 156;
const seasonLabelRadius = 82;

const playbackStore = useStoryPlaybackStore();
const { currentDate, isPlaying } = storeToRefs(playbackStore);

const displayedAngle = ref(dateToAngle(currentDate.value));

const activeSeason = computed(() => getSeasonForDate(currentDate.value));
const currentMonth = computed(() => Number(currentDate.value.slice(5, 7)) - 1);

const seasonClockStyle = {
  "--season-clock-summer": "#ff6b4a",
  "--season-clock-autumn": "#ffb627",
  "--season-clock-winter": "#4ab3ff",
  "--season-clock-spring": "#55c96f",
};

const toPoint = (angle: number, radius: number) => {
  const radians = (angle * Math.PI) / 180;

  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
};

const describeSeasonSegment = (startAngle: number, endAngle: number) => {
  const outerStart = toPoint(startAngle, outerRadius);
  const outerEnd = toPoint(endAngle, outerRadius);
  const innerStart = toPoint(startAngle, innerRadius);
  const innerEnd = toPoint(endAngle, innerRadius);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [
    "M",
    outerStart.x,
    outerStart.y,
    "A",
    outerRadius,
    outerRadius,
    0,
    largeArcFlag,
    1,
    outerEnd.x,
    outerEnd.y,
    "L",
    innerEnd.x,
    innerEnd.y,
    "A",
    innerRadius,
    innerRadius,
    0,
    largeArcFlag,
    0,
    innerStart.x,
    innerStart.y,
    "Z",
  ].join(" ");
};

const seasonSegments = computed(() =>
  getSeasonBoundariesForCycle(currentDate.value).map((boundary) => ({
    ...boundary,
    path: describeSeasonSegment(boundary.startAngle, boundary.endAngle),
    labelPosition: toPoint(
      boundary.startAngle + (boundary.endAngle - boundary.startAngle) / 2,
      seasonLabelRadius,
    ),
    isActive: boundary.season.id === activeSeason.value.id,
  })),
);

const monthMarkers = computed(() =>
  getMonthBoundariesForCycle(currentDate.value).map((month) => ({
    ...month,
    tickInner: toPoint(month.startAngle, tickInnerRadius),
    tickOuter: toPoint(month.startAngle, tickOuterRadius),
    labelPosition: toPoint(month.midAngle, labelRadius),
    isActive: month.monthIndex === currentMonth.value,
  })),
);

const pointerStyle = computed(() => ({
  transform: `rotate(${displayedAngle.value}deg)`,
}));

const clockLabel = computed(() =>
  t("seasonClock.aria.clockLabel", {
    season: getSeasonLabel(activeSeason.value),
    date: currentDate.value,
  }),
);

const getSeasonLabel = (season: { label: string; labelKey?: string }) =>
  season.labelKey ? t(season.labelKey) : season.label;

const getMonthLabel = (month: { label: string; labelKey?: string }) =>
  month.labelKey ? t(month.labelKey) : month.label;

watch(currentDate, (date) => {
  const nextAngle = dateToAngle(date);
  let visualAngle = nextAngle;

  while (visualAngle < displayedAngle.value - 180) {
    visualAngle += 360;
  }

  while (visualAngle > displayedAngle.value + 180) {
    visualAngle -= 360;
  }

  displayedAngle.value = visualAngle;
});
</script>

<style scoped>
.season-clock {
  width: clamp(280px, 26vw, 360px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 16px 18px;
  border: 1px solid rgba(58, 86, 68, 0.16);
  border-radius: var(--radius-md);
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.96),
    rgba(250, 253, 248, 0.94)
  );
  box-shadow: 0 12px 30px rgba(44, 65, 53, 0.16);
}

.season-clock__svg {
  display: block;
  width: 100%;
  height: auto;
}

.season-clock__base-disc {
  fill: #fffaf0;
  stroke: rgba(54, 73, 59, 0.14);
  stroke-width: 2;
}

.season-clock__season {
  stroke: rgba(255, 255, 255, 0.7);
  stroke-width: 3;
  stroke-linejoin: round;
  opacity: 0.72;
  transition:
    opacity var(--trans-fast),
    filter var(--trans-fast),
    transform var(--trans-fast);
}

.season-clock__season-outline {
  fill: none;
  stroke: rgba(255, 255, 255, 0.82);
  stroke-width: 8;
  stroke-linejoin: round;
  filter: url("#season-clock-active-glow");
}

.season-clock__season--summer {
  fill: var(--season-clock-summer);
}

.season-clock__season--autumn {
  fill: var(--season-clock-autumn);
}

.season-clock__season--winter {
  fill: var(--season-clock-winter);
}

.season-clock__season--spring {
  fill: var(--season-clock-spring);
}

.season-clock__season--active {
  opacity: 1;
  filter: saturate(1.12) drop-shadow(0 4px 7px rgba(34, 54, 42, 0.2));
}

.season-clock__season-label {
  fill: rgba(27, 39, 32, 0.8);
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.72);
  stroke-width: 4;
  stroke-linejoin: round;
  font-size: 15px;
  font-weight: 750;
}

.season-clock__season-label--active {
  fill: #121a15;
  font-size: 17px;
}

.season-clock__tick {
  stroke: rgba(43, 57, 47, 0.34);
  stroke-width: 1.4;
  stroke-linecap: round;
}

.season-clock__month-label {
  fill: rgba(44, 58, 48, 0.72);
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.84);
  stroke-width: 3;
  stroke-linejoin: round;
  font-size: 13.5px;
  font-weight: 700;
}

.season-clock__month-label--active {
  fill: #17231b;
  font-size: 15.5px;
}

.season-clock__pointer {
  transform-box: view-box;
  transform-origin: 180px 180px;
  transition: transform 300ms ease;
}

.season-clock__pointer-line {
  stroke: #253329;
  stroke-width: 3.4;
  stroke-linecap: round;
}

.season-clock__pointer-line--backdrop {
  stroke: rgba(255, 255, 255, 0.78);
  stroke-width: 7;
}

.season-clock__pointer-dot {
  fill: #fffdf7;
  stroke: #253329;
  stroke-width: 2.6;
}

.season-clock__center {
  fill: rgba(255, 253, 247, 0.93);
  stroke: rgba(50, 68, 56, 0.16);
  stroke-width: 2;
}

.season-clock__center-content {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}

@media (prefers-reduced-motion: reduce) {
  .season-clock__pointer,
  .season-clock__season {
    transition: none;
  }
}
</style>
