<template>
  <section
    class="seasonal-temperature-chart"
    aria-labelledby="act5-chart-title"
  >
    <div class="seasonal-temperature-chart__header">
      <div>
        <p class="seasonal-temperature-chart__eyebrow">Seasonal temperature</p>
        <h2 id="act5-chart-title">Difference from each season baseline</h2>
      </div>

      <ul class="seasonal-temperature-chart__legend" aria-label="Chart legend">
        <li
          v-for="season in seasonSeries"
          :key="season.season"
          :style="{ '--season-color': season.color }"
        >
          <span aria-hidden="true"></span>
          {{ season.label }}
        </li>
      </ul>
    </div>

    <div
      v-if="chartSeries.length"
      class="seasonal-temperature-chart__plot"
      aria-hidden="true"
    >
      <svg
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        preserveAspectRatio="none"
        role="img"
      >
        <g class="seasonal-temperature-chart__grid">
          <line
            v-for="tick in yTicks"
            :key="`grid-${tick}`"
            :x1="plotLeft"
            :x2="plotRight"
            :y1="yScale(tick)"
            :y2="yScale(tick)"
          />
        </g>

        <line
          class="seasonal-temperature-chart__baseline"
          :x1="plotLeft"
          :x2="plotRight"
          :y1="yScale(0)"
          :y2="yScale(0)"
        />

        <g class="seasonal-temperature-chart__axis">
          <line
            :x1="plotLeft"
            :x2="plotRight"
            :y1="plotBottom"
            :y2="plotBottom"
          />
          <line :x1="plotLeft" :x2="plotLeft" :y1="plotTop" :y2="plotBottom" />

          <text
            class="seasonal-temperature-chart__axis-label"
            :x="plotLeft + (plotRight - plotLeft) / 2"
            :y="chartHeight - 8"
            text-anchor="middle"
          >
            Climate period
          </text>
          <text
            class="seasonal-temperature-chart__axis-label"
            :transform="`translate(14 ${plotTop + (plotBottom - plotTop) / 2}) rotate(-90)`"
            text-anchor="middle"
          >
            Temperature difference (degC)
          </text>

          <g v-for="tick in yTicks" :key="`y-${tick}`">
            <text :x="plotLeft - 12" :y="yScale(tick)" text-anchor="end">
              {{ formatAxisValue(tick) }}
            </text>
          </g>

          <g v-for="tick in xTicks" :key="tick.interval">
            <line
              :x1="xScale(tick.intervalOrder)"
              :x2="xScale(tick.intervalOrder)"
              :y1="plotBottom"
              :y2="plotBottom + 5"
            />
            <text
              :x="xScale(tick.intervalOrder)"
              :y="plotBottom + 18"
              text-anchor="middle"
            >
              {{ tick.interval }}
            </text>
          </g>
        </g>

        <g>
          <path
            v-for="season in chartSeries"
            :key="`${season.season}-line`"
            class="seasonal-temperature-chart__line"
            :d="season.path"
            :stroke="season.color"
          />

          <g
            v-for="season in chartSeries"
            :key="`${season.season}-points`"
            class="seasonal-temperature-chart__points"
          >
            <circle
              v-for="point in season.points"
              :key="`${season.season}-${point.interval}`"
              :cx="xScale(point.intervalOrder)"
              :cy="yScale(point.difference)"
              :fill="season.color"
              r="4"
            />
          </g>
        </g>
      </svg>
    </div>

    <p v-else class="seasonal-temperature-chart__empty">
      Climate data is loading.
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { extent, line, scaleLinear } from "d3";
import type {
  ClimateSeason,
  ClimateSeasonDataRow,
} from "~/utils/movement/acts/climate/climateSeasonData";
import { isClimateMovementSeason } from "~/utils/movement/acts/climate/climateSeasonData";

type ChartPoint = {
  interval: string;
  intervalOrder: number;
  difference: number;
};

type ChartSeries = {
  season: ClimateSeason;
  label: string;
  color: string;
  points: ChartPoint[];
  path: string;
};

const props = defineProps<{
  rows: ClimateSeasonDataRow[];
}>();

const chartWidth = 960;
const chartHeight = 300;
const plotTop = 10;
const plotRight = chartWidth - 18;
const plotBottom = chartHeight - 36;
const plotLeft = 58;
const seasonSeries: Array<{
  season: ClimateSeason;
  label: string;
  color: string;
}> = [
  { season: "winter", label: "Winter", color: "var(--act5-chart-winter)" },
  { season: "spring", label: "Spring", color: "var(--act5-chart-spring)" },
  { season: "summer", label: "Summer", color: "var(--act5-chart-summer)" },
  { season: "autumn", label: "Autumn", color: "var(--act5-chart-autumn)" },
];

const climateRows = computed(() =>
  props.rows
    .filter((row) => isClimateMovementSeason(row.season))
    .sort((a, b) => a.intervalOrder - b.intervalOrder),
);
const allIntervalOrders = computed(() => [
  ...new Set(climateRows.value.map((row) => row.intervalOrder)),
]);
const intervalExtent = computed(() => extent(allIntervalOrders.value));

const xScale = computed(() => {
  const [minInterval = 1, maxInterval = 1] = intervalExtent.value;

  return scaleLinear()
    .domain([minInterval, maxInterval])
    .range([plotLeft, plotRight]);
});
const rawSeries = computed(() =>
  seasonSeries.map((seasonConfig) => {
    const seasonRows = climateRows.value.filter(
      (row) => row.season === seasonConfig.season,
    );
    const baseline = seasonRows.find((row) => row.isBaseline);
    const baselineValue =
      baseline?.absoluteValue ?? seasonRows[0]?.absoluteValue;
    const points =
      baselineValue === undefined
        ? []
        : seasonRows.map((row) => ({
            interval: row.interval,
            intervalOrder: row.intervalOrder,
            difference: row.isBaseline ? 0 : row.absoluteValue - baselineValue,
          }));

    return {
      ...seasonConfig,
      points,
    };
  }),
);
const differenceExtent = computed(() =>
  extent(
    rawSeries.value.flatMap((season) => season.points),
    (point) => Number(point.difference.toFixed(3)),
  ),
);
const yScale = computed(() => {
  const [minDifference = 0, maxDifference = 0] = differenceExtent.value;
  const padding = 0.2;

  return scaleLinear()
    .domain([
      Math.min(minDifference - padding, 0),
      Math.max(maxDifference + padding, padding),
    ])
    .nice()
    .range([plotBottom, plotTop]);
});
const yTicks = computed(() => yScale.value.ticks(5));
const xTicks = computed(() =>
  climateRows.value
    .filter((row) => row.season === "winter")
    .map((row) => ({
      interval: row.interval,
      intervalOrder: row.intervalOrder,
    })),
);
const chartLine = computed(() =>
  line<ChartPoint>()
    .x((point) => xScale.value(point.intervalOrder))
    .y((point) => yScale.value(point.difference)),
);
const chartSeries = computed<ChartSeries[]>(() =>
  rawSeries.value
    .filter((season) => season.points.length)
    .map((season) => ({
      ...season,
      path: chartLine.value(season.points) ?? "",
    })),
);

const formatAxisValue = (value: number) => {
  if (value === 0) return "0";

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
};
</script>

<style scoped>
.seasonal-temperature-chart {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 6px;
  height: 100%;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  padding: clamp(10px, 1.2vw, 16px) clamp(14px, 1.8vw, 24px);
  border: 1px solid var(--act5-color-border);
  border-radius: 12px;
  background: var(--act5-color-surface);
  color: var(--act5-color-text);
}

.seasonal-temperature-chart__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  min-width: 0;
}

.seasonal-temperature-chart__eyebrow,
.seasonal-temperature-chart h2 {
  margin: 0;
}

.seasonal-temperature-chart__eyebrow {
  color: var(--act5-color-text-muted);
  font-size: 0.66rem;
  font-weight: 850;
  text-transform: uppercase;
}

.seasonal-temperature-chart h2 {
  margin-top: 2px;
  color: var(--act5-color-text-strong);
  font-size: clamp(0.92rem, 1.25vw, 1.18rem);
  line-height: 1.05;
}

.seasonal-temperature-chart__legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 8px 12px;
  margin: 0;
  padding: 0;
  color: var(--act5-color-text-muted);
  font-size: 0.68rem;
  font-weight: 800;
  list-style: none;
}

.seasonal-temperature-chart__legend li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.seasonal-temperature-chart__legend span {
  width: 18px;
  height: 3px;
  border-radius: 999px;
  background: var(--season-color);
}

.seasonal-temperature-chart__plot {
  min-width: 0;
  min-height: 0;
}

.seasonal-temperature-chart svg {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: block;
  overflow: visible;
}

.seasonal-temperature-chart__grid line {
  stroke: var(--act5-color-border);
  stroke-width: 1;
}

.seasonal-temperature-chart__baseline {
  stroke: var(--act5-color-text-muted);
  stroke-dasharray: 5 5;
  stroke-width: 1.25;
}

.seasonal-temperature-chart__axis line {
  stroke: var(--act5-color-border-strong);
  stroke-width: 1;
}

.seasonal-temperature-chart__axis text {
  dominant-baseline: middle;
  fill: var(--act5-color-text-muted);
  font-size: 11px;
  font-weight: 750;
}

.seasonal-temperature-chart__axis .seasonal-temperature-chart__axis-label {
  fill: var(--act5-color-text-muted);
  font-size: 12px;
  font-weight: 850;
}

.seasonal-temperature-chart__line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}

.seasonal-temperature-chart__points circle {
  stroke: var(--act5-color-surface-strong);
  stroke-width: 2;
}

.seasonal-temperature-chart__empty {
  display: grid;
  place-items: center;
  margin: 0;
  color: var(--act5-color-text-muted);
  font-size: 0.82rem;
  font-weight: 800;
}

@media (max-width: 860px) {
  .seasonal-temperature-chart {
    padding: 12px 14px;
  }

  .seasonal-temperature-chart__header {
    align-items: start;
    flex-direction: column;
    gap: 8px;
  }

  .seasonal-temperature-chart__legend {
    justify-content: start;
  }
}
</style>
