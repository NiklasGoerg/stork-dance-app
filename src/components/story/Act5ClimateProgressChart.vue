<template>
  <section
    class="act5-climate-chart"
    :class="[
      `act5-climate-chart--${chartMode}`,
      {
        'act5-climate-chart--inactive': isInactive,
        'act5-climate-chart--interaction-focus': isInteractionFocus,
        'act5-climate-chart--transition-focus': isTransitionFocus,
        'act5-climate-chart--feedback-burst': feedbackBurstActive,
        [`act5-climate-chart--feedback-${feedbackBurstLevel}`]:
          feedbackBurstActive,
        'act5-climate-chart--resetting': resetFeedbackActive,
        'act5-climate-chart--completed-summary': isCompletedSummary,
      },
    ]"
    aria-labelledby="act5-progress-chart-title"
  >
    <div class="act5-climate-chart__header">
      <div class="act5-climate-chart__heading">
        <p class="act5-climate-chart__eyebrow">{{ eyebrowLabel }}</p>
        <h2 id="act5-progress-chart-title">{{ titleLabel }}</h2>
      </div>

      <div class="act5-climate-chart__meta">
        <span class="act5-climate-chart__view">{{ viewLabel }}</span>
        <ul class="act5-climate-chart__legend" aria-label="Chart legend">
          <li
            v-for="season in seasonSeries"
            :key="season.season"
            :style="{ '--season-color': season.color }"
          >
            <span aria-hidden="true" />
            {{ season.label }}
          </li>
        </ul>
      </div>
    </div>

    <div
      v-if="!isInactive && chartRows.length"
      class="act5-climate-chart__plot"
      aria-hidden="true"
    >
      <svg
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        preserveAspectRatio="none"
        role="img"
      >
        <g class="act5-climate-chart__grid">
          <line
            v-for="tick in yTicks"
            :key="`grid-${tick}`"
            :x1="plotLeft"
            :x2="plotRight"
            :y1="yScale(tick)"
            :y2="yScale(tick)"
          />
        </g>

        <rect
          v-if="snapshotHighlight"
          class="act5-climate-chart__period-highlight"
          :x="snapshotHighlight.x"
          :y="plotTop"
          :width="snapshotHighlight.width"
          :height="plotBottom - plotTop"
        />

        <line
          v-if="showsDeltaBaseline"
          class="act5-climate-chart__baseline"
          :x1="plotLeft"
          :x2="plotRight"
          :y1="yScale(0)"
          :y2="yScale(0)"
        />

        <g class="act5-climate-chart__axis">
          <line
            :x1="plotLeft"
            :x2="plotRight"
            :y1="plotBottom"
            :y2="plotBottom"
          />
          <line :x1="plotLeft" :x2="plotLeft" :y1="plotTop" :y2="plotBottom" />

          <text
            class="act5-climate-chart__axis-label"
            :x="plotLeft + (plotRight - plotLeft) / 2"
            :y="chartHeight - 8"
            text-anchor="middle"
          >
            Climate period
          </text>
          <text
            class="act5-climate-chart__axis-label"
            :transform="`translate(14 ${plotTop + (plotBottom - plotTop) / 2}) rotate(-90)`"
            text-anchor="middle"
          >
            {{ yAxisLabel }}
          </text>

          <g v-for="tick in yTicks" :key="`y-${tick}`">
            <text :x="plotLeft - 12" :y="yScale(tick)" text-anchor="end">
              {{ formatAxisValue(tick) }}
            </text>
          </g>

          <g
            v-for="tick in xTicks"
            :key="tick.interval"
            :class="[
              'act5-climate-chart__x-tick',
              { 'act5-climate-chart__x-tick--future': tick.isFuture },
            ]"
          >
            <line
              :x1="xScale(tick.intervalOrder)"
              :x2="xScale(tick.intervalOrder)"
              :y1="plotBottom"
              :y2="plotBottom + 5"
            />
            <text
              :x="xScale(tick.intervalOrder)"
              :y="plotBottom + 19"
              text-anchor="middle"
            >
              {{ tick.interval }}
            </text>
          </g>
        </g>

        <g class="act5-climate-chart__segments">
          <line
            v-for="segment in renderedSegments"
            :key="segment.renderKey"
            :class="[
              'act5-climate-chart__segment',
              `act5-climate-chart__segment--${segment.state}`,
              {
                'act5-climate-chart__segment--active': segment.active,
                'act5-climate-chart__segment--muted': segment.muted,
                'act5-climate-chart__segment--recent': segment.recent,
                'act5-climate-chart__segment--burst': segment.burst,
              },
            ]"
            :x1="segment.x1"
            :y1="segment.y1"
            :x2="segment.x2"
            :y2="segment.y2"
            :stroke="segment.color"
            :style="{ color: segment.color }"
          >
            <animate
              v-if="segment.animateFromX !== undefined"
              attributeName="x2"
              :from="segment.animateFromX"
              :to="segment.x2"
              dur="640ms"
              calcMode="spline"
              keySplines="0.2 0 0.2 1"
            />
            <animate
              v-if="segment.animateFromY !== undefined"
              attributeName="y2"
              :from="segment.animateFromY"
              :to="segment.y2"
              dur="640ms"
              calcMode="spline"
              keySplines="0.2 0 0.2 1"
            />
          </line>
        </g>

        <g class="act5-climate-chart__points">
          <circle
            v-for="point in renderedPoints"
            :key="point.renderKey"
            :class="[
              'act5-climate-chart__point',
              `act5-climate-chart__point--${point.state}`,
              {
                'act5-climate-chart__point--active': point.active,
                'act5-climate-chart__point--muted': point.muted,
                'act5-climate-chart__point--pulse': point.pulse,
                'act5-climate-chart__point--recent': point.recent,
              },
            ]"
            :cx="point.x"
            :cy="point.y"
            :fill="point.fill"
            :stroke="point.stroke"
            :r="point.radius"
            :style="{ color: point.stroke }"
          />
        </g>

        <g v-if="activeValueLabel" class="act5-climate-chart__value-label">
          <text
            :x="activeValueLabel.x"
            :y="activeValueLabel.y"
            text-anchor="middle"
          >
            {{ activeValueLabel.text }}
          </text>
        </g>
      </svg>
    </div>

    <div v-else class="act5-climate-chart__empty">
      <p>{{ emptyLabel }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { extent, scaleLinear } from "d3";
import type {
  ClimateSeason,
  ClimateSeasonDataRow,
} from "~/utils/movement/acts/climate/climateSeasonData";
import { isClimateMovementSeason } from "~/utils/movement/acts/climate/climateSeasonData";
import type { Act5ClimateProgressChartProps } from "~/types/act5ClimateChart";

type ChartView = "absolute" | "delta";
type ChartMode =
  | "inactive"
  | "referenceAbsolute"
  | "absoluteToDelta"
  | "delta"
  | "absoluteSnapshot"
  | "completed";
type RenderPointState = "completed" | "preview" | "partial";
type RenderSegmentState = "completed" | "preview" | "partial";
type FeedbackBurstLevel = "first" | "second" | "extra";

type SeasonConfig = {
  season: ClimateSeason;
  label: string;
  color: string;
};

type PointGeometry = {
  id: string;
  row: ClimateSeasonDataRow;
  seasonConfig: SeasonConfig;
  value: number;
  x: number;
  y: number;
};

type RenderPoint = PointGeometry & {
  renderKey: string;
  state: RenderPointState;
  active: boolean;
  muted: boolean;
  recent: boolean;
  pulse: boolean;
  fill: string;
  stroke: string;
  radius: number;
};

type RenderSegment = {
  id: string;
  state: RenderSegmentState;
  season: ClimateSeason;
  active: boolean;
  muted: boolean;
  recent: boolean;
  burst: boolean;
  color: string;
  renderKey: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  animateFromX?: number;
  animateFromY?: number;
};

const props = defineProps<Act5ClimateProgressChartProps>();

const chartWidth = 960;
const chartHeight = 300;
const plotTop = 18;
const plotRight = chartWidth - 18;
const plotBottom = chartHeight - 38;
const plotLeft = 62;
const previewColor = "rgba(94, 108, 103, 0.5)";
const inactiveFlowIds = new Set(["act5TutorialDebug"]);
const successfulResults = new Set(["success", "almostCorrect", "autoProgress"]);
const seasonSeries: SeasonConfig[] = [
  { season: "winter", label: "Winter", color: "var(--act5-chart-winter)" },
  { season: "spring", label: "Spring", color: "var(--act5-chart-spring)" },
  { season: "summer", label: "Summer", color: "var(--act5-chart-summer)" },
  { season: "autumn", label: "Autumn", color: "var(--act5-chart-autumn)" },
];

const completedStepIds = ref<string[]>([]);
const pulseKey = ref("");
const lastPulsedAttemptKey = ref("");
const feedbackBurstKey = ref("");
const feedbackBurstLevel = ref<FeedbackBurstLevel>("first");
const resetFeedbackKey = ref("");
const lastObservedAttemptKey = ref("");
const lastObservedSuccessCount = ref(0);
let feedbackBurstTimer: ReturnType<typeof setTimeout> | null = null;
let resetFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

const getStepId = (row: ClimateSeasonDataRow) =>
  `${row.season}-${row.intervalOrder}-${row.interval}`;

const chartRows = computed(() =>
  props.rows
    .filter((row) => isClimateMovementSeason(row.season))
    .sort(
      (a, b) =>
        a.intervalOrder - b.intervalOrder || a.seasonOrder - b.seasonOrder,
    ),
);
const rowByStepId = computed(() => {
  const rows = new Map<string, ClimateSeasonDataRow>();

  chartRows.value.forEach((row) => {
    rows.set(getStepId(row), row);
  });

  return rows;
});
const completedStepIdSet = computed(() => new Set(completedStepIds.value));
const intervalOrders = computed(() => [
  ...new Set(chartRows.value.map((row) => row.intervalOrder)),
]);
const baselineIntervalOrder = computed(
  () =>
    chartRows.value.find((row) => row.isBaseline)?.intervalOrder ??
    intervalOrders.value[0] ??
    1,
);
const activeStepId = computed(() => props.activeStep?.id ?? "");
const activeRow = computed(() =>
  activeStepId.value
    ? (rowByStepId.value.get(activeStepId.value) ?? null)
    : null,
);
const currentSuccessCount = computed(
  () =>
    props.measureEvaluations.filter((evaluation) =>
      successfulResults.has(evaluation.result),
    ).length,
);
const requiredSuccessCount = computed(() =>
  Math.max(props.requiredSuccessfulRepetitions, 1),
);
const activeStepIsComplete = computed(
  () =>
    Boolean(
      activeStepId.value && completedStepIdSet.value.has(activeStepId.value),
    ) || currentSuccessCount.value >= requiredSuccessCount.value,
);
const isCompletedSummary = computed(() => chartMode.value === "completed");
const isTransitionFocus = computed(
  () =>
    chartMode.value === "absoluteSnapshot" ||
    chartMode.value === "absoluteToDelta",
);
const isInteractionFocus = computed(
  () =>
    props.sequenceStatus === "performing" &&
    chartMode.value !== "inactive" &&
    chartMode.value !== "completed",
);
const feedbackBurstActive = computed(() => feedbackBurstKey.value !== "");
const resetFeedbackActive = computed(() => resetFeedbackKey.value !== "");
const transitionPreviousIntervalOrder = computed(() => {
  const previousPeriod = props.periodTransition?.previousPeriod;

  if (!previousPeriod) return null;

  return (
    chartRows.value.find((row) => row.interval === previousPeriod)
      ?.intervalOrder ?? null
  );
});
const chartMode = computed<ChartMode>(() => {
  if (props.phase === "completed") {
    return "completed";
  }

  if (props.sequenceStatus === "periodTransition" && props.periodTransition) {
    return transitionPreviousIntervalOrder.value === baselineIntervalOrder.value
      ? "absoluteToDelta"
      : "absoluteSnapshot";
  }

  if (
    props.phase !== "climateStory" ||
    !props.activeStep ||
    inactiveFlowIds.has(props.flowId ?? "")
  ) {
    return "inactive";
  }

  return props.activeStep.isBaseline ? "referenceAbsolute" : "delta";
});
const isInactive = computed(() => chartMode.value === "inactive");
const chartView = computed<ChartView>(() =>
  chartMode.value === "referenceAbsolute" ||
  chartMode.value === "absoluteSnapshot"
    ? "absolute"
    : "delta",
);
const showsDeltaBaseline = computed(() => chartView.value === "delta");

const xScale = computed(() => {
  const [minInterval = 1, maxInterval = 1] = extent(intervalOrders.value);

  return scaleLinear()
    .domain([minInterval, maxInterval])
    .range([plotLeft, plotRight]);
});
const getDeltaValue = (row: ClimateSeasonDataRow) =>
  row.isBaseline ? 0 : row.displayValue;
const getChartValue = (row: ClimateSeasonDataRow, view = chartView.value) =>
  view === "absolute" ? row.absoluteValue : getDeltaValue(row);
const absoluteYDomain = computed(() => {
  const [minValue = 0, maxValue = 1] = extent(
    chartRows.value,
    (row) => row.absoluteValue,
  );
  const padding = 0.6;

  return [minValue - padding, maxValue + padding] as [number, number];
});
const deltaYDomain = computed(() => {
  const [minValue = 0, maxValue = 0] = extent(chartRows.value, getDeltaValue);
  const padding = 0.25;

  return [
    Math.min(minValue - padding, 0),
    Math.max(maxValue + padding, padding),
  ] as [number, number];
});
const yScale = computed(() =>
  scaleLinear()
    .domain(
      chartView.value === "absolute"
        ? absoluteYDomain.value
        : deltaYDomain.value,
    )
    .nice()
    .range([plotBottom, plotTop]),
);
const yTicks = computed(() => yScale.value.ticks(5));
const latestVisibleIntervalOrder = computed(() => {
  if (isCompletedSummary.value) {
    return (
      intervalOrders.value[intervalOrders.value.length - 1] ??
      baselineIntervalOrder.value
    );
  }

  if (chartMode.value === "absoluteSnapshot") {
    return transitionPreviousIntervalOrder.value ?? baselineIntervalOrder.value;
  }

  const completedOrders = chartRows.value
    .filter((row) => completedStepIdSet.value.has(getStepId(row)))
    .map((row) => row.intervalOrder);

  if (activeRow.value) completedOrders.push(activeRow.value.intervalOrder);

  return Math.max(...completedOrders, baselineIntervalOrder.value);
});
const xTicks = computed(() =>
  chartRows.value
    .filter((row) => row.season === "winter")
    .map((row) => ({
      interval: row.interval,
      intervalOrder: row.intervalOrder,
      isFuture: row.intervalOrder > latestVisibleIntervalOrder.value,
    })),
);

const getSeasonConfig = (season: ClimateSeason) =>
  seasonSeries.find((item) => item.season === season) ?? seasonSeries[0];
const getPointGeometry = (row: ClimateSeasonDataRow): PointGeometry => {
  const seasonConfig = getSeasonConfig(row.season);

  return {
    id: getStepId(row),
    row,
    seasonConfig,
    value: getChartValue(row),
    x: xScale.value(row.intervalOrder),
    y: yScale.value(getChartValue(row)),
  };
};
const isRowActive = (row: ClimateSeasonDataRow) =>
  Boolean(
    !isCompletedSummary.value &&
    activeStepId.value &&
    getStepId(row) === activeStepId.value,
  );
const isRecentPeriodRow = (row: ClimateSeasonDataRow) =>
  isTransitionFocus.value &&
  row.intervalOrder ===
    (transitionPreviousIntervalOrder.value ?? baselineIntervalOrder.value);
const isSeasonMuted = (season: ClimateSeason, active = false) =>
  Boolean(
    isInteractionFocus.value &&
    props.activeStep?.season &&
    props.activeStep.season !== season &&
    !active,
  );
const getPointState = (row: ClimateSeasonDataRow): RenderPointState => {
  const id = getStepId(row);

  if (
    isCompletedSummary.value ||
    completedStepIdSet.value.has(id) ||
    (isRowActive(row) && activeStepIsComplete.value)
  ) {
    return "completed";
  }

  if (isRowActive(row) && currentSuccessCount.value > 0) return "partial";

  return "preview";
};
const toRenderPoint = (row: ClimateSeasonDataRow): RenderPoint => {
  const point = getPointGeometry(row);
  const active = isRowActive(row);
  const state = getPointState(row);
  const pulse = pulseKey.value.startsWith(`${point.id}-`);
  const completed = state === "completed";
  const deltaPartialPoint = state === "partial" && chartView.value === "delta";
  const recent = isRecentPeriodRow(row);

  return {
    ...point,
    renderKey: pulse ? `${point.id}-${pulseKey.value}` : point.id,
    state,
    active,
    muted: isSeasonMuted(row.season, active),
    recent,
    pulse,
    fill:
      completed || (state === "partial" && !deltaPartialPoint)
        ? point.seasonConfig.color
        : "rgba(116, 127, 123, 0.24)",
    stroke:
      completed || state === "partial"
        ? point.seasonConfig.color
        : "rgba(93, 105, 100, 0.72)",
    radius: active ? (completed ? 8.1 : 9.2) : recent ? 5.6 : 4.4,
  };
};
const snapshotRows = computed(() => {
  const visibleThrough =
    transitionPreviousIntervalOrder.value ?? baselineIntervalOrder.value;

  return chartRows.value.filter((row) => row.intervalOrder <= visibleThrough);
});
const completedRows = computed(() =>
  chartRows.value.filter((row) => completedStepIdSet.value.has(getStepId(row))),
);
const visibleRows = computed(() => {
  if (isCompletedSummary.value) return chartRows.value;
  if (chartMode.value === "absoluteSnapshot") return snapshotRows.value;
  if (chartMode.value === "absoluteToDelta") {
    return chartRows.value.filter(
      (row) => row.intervalOrder === baselineIntervalOrder.value,
    );
  }

  const rows = [...completedRows.value];

  if (
    activeRow.value &&
    !rows.some((row) => getStepId(row) === activeStepId.value)
  ) {
    rows.push(activeRow.value);
  }

  return rows.sort(
    (a, b) =>
      a.intervalOrder - b.intervalOrder || a.seasonOrder - b.seasonOrder,
  );
});
const renderedPoints = computed<RenderPoint[]>(() =>
  visibleRows.value.map(toRenderPoint),
);
const getSeasonRows = (rows: ClimateSeasonDataRow[], season: ClimateSeason) =>
  rows
    .filter((row) => row.season === season)
    .sort((a, b) => a.intervalOrder - b.intervalOrder);
const getCompletedSegmentState = (
  row: ClimateSeasonDataRow,
): RenderSegmentState =>
  isRowActive(row) && currentSuccessCount.value === 1 ? "partial" : "completed";
const createSegment = ({
  from,
  to,
  state,
  animateFromProgress,
}: {
  from: ClimateSeasonDataRow;
  to: ClimateSeasonDataRow;
  state: RenderSegmentState;
  animateFromProgress?: number;
}): RenderSegment => {
  const fromPoint = getPointGeometry(from);
  const toPoint = getPointGeometry(to);
  const active = isRowActive(to);
  const progress = state === "partial" ? 0.5 : 1;
  const recent = isRecentPeriodRow(to);
  const animateFromX =
    animateFromProgress === undefined
      ? undefined
      : fromPoint.x + (toPoint.x - fromPoint.x) * animateFromProgress;
  const animateFromY =
    animateFromProgress === undefined
      ? undefined
      : fromPoint.y + (toPoint.y - fromPoint.y) * animateFromProgress;
  const renderKey = `${fromPoint.id}-${toPoint.id}-${state}${
    animateFromProgress === undefined ? "" : `-${feedbackBurstKey.value}`
  }`;

  return {
    id: `${fromPoint.id}-${toPoint.id}-${state}`,
    renderKey,
    state,
    season: to.season,
    active,
    muted: isSeasonMuted(to.season, active),
    recent,
    burst: active && feedbackBurstActive.value,
    color: state === "preview" ? previewColor : toPoint.seasonConfig.color,
    x1: fromPoint.x,
    y1: fromPoint.y,
    x2: fromPoint.x + (toPoint.x - fromPoint.x) * progress,
    y2: fromPoint.y + (toPoint.y - fromPoint.y) * progress,
    animateFromX,
    animateFromY,
  };
};
const renderedSegments = computed<RenderSegment[]>(() => {
  if (
    chartMode.value === "referenceAbsolute" ||
    chartMode.value === "absoluteToDelta"
  ) {
    return [];
  }

  if (chartMode.value === "absoluteSnapshot") {
    return seasonSeries.flatMap(({ season }) => {
      const rows = getSeasonRows(snapshotRows.value, season);

      return rows.slice(1).map((row, index) =>
        createSegment({
          from: rows[index],
          to: row,
          state: "completed",
        }),
      );
    });
  }

  return seasonSeries.flatMap(({ season }) => {
    const rows = getSeasonRows(visibleRows.value, season);
    const segments: RenderSegment[] = [];

    rows.slice(1).forEach((row, index) => {
      const rowIsCompleted =
        isCompletedSummary.value ||
        completedStepIdSet.value.has(getStepId(row)) ||
        (isRowActive(row) && activeStepIsComplete.value);

      if (rowIsCompleted) {
        segments.push(
          createSegment({
            from: rows[index],
            to: row,
            state: getCompletedSegmentState(row),
            animateFromProgress:
              isRowActive(row) &&
              currentSuccessCount.value >= requiredSuccessCount.value
                ? 0.5
                : undefined,
          }),
        );
        return;
      }

      if (isRowActive(row)) {
        segments.push(
          createSegment({
            from: rows[index],
            to: row,
            state: "preview",
          }),
        );

        if (currentSuccessCount.value > 0) {
          segments.push(
            createSegment({
              from: rows[index],
              to: row,
              state: "partial",
              animateFromProgress: 0,
            }),
          );
        }
      }
    });

    return segments;
  });
});
const snapshotHighlight = computed(() => {
  if (chartMode.value !== "absoluteSnapshot") return null;

  const intervalOrder = transitionPreviousIntervalOrder.value;

  if (!intervalOrder) return null;

  const step =
    (plotRight - plotLeft) / Math.max(intervalOrders.value.length - 1, 1);
  const width = Math.min(step * 0.7, 96);

  return {
    x: xScale.value(intervalOrder) - width / 2,
    width,
  };
});
const activeValueLabel = computed(() => {
  if (!activeRow.value || chartMode.value === "inactive") return null;
  if (
    isCompletedSummary.value ||
    chartMode.value === "absoluteSnapshot" ||
    chartMode.value === "absoluteToDelta"
  ) {
    return null;
  }

  const point = getPointGeometry(activeRow.value);
  const labelY = Math.max(plotTop + 12, point.y - 14);

  return {
    x: point.x,
    y: labelY,
    text: formatTemperatureValue(getChartValue(activeRow.value)),
  };
});
const eyebrowLabel = computed(() =>
  isInactive.value ? "Act 5 climate" : "Seasonal temperature",
);
const titleLabel = computed(() => {
  if (isCompletedSummary.value) {
    return "Completed climate story summary";
  }

  if (chartMode.value === "referenceAbsolute") {
    return "Absolute seasonal temperature";
  }
  if (chartMode.value === "absoluteToDelta") {
    return "Absolute temperature -> Change from 1995-1999";
  }
  if (chartMode.value === "absoluteSnapshot") {
    return "Absolute seasonal temperature snapshot";
  }
  if (chartMode.value === "delta") {
    return "Change from 1995-1999";
  }

  return "Climate story chart";
});
const viewLabel = computed(() => {
  if (isCompletedSummary.value) return "Summary";
  if (chartMode.value === "referenceAbsolute") return "Absolute";
  if (chartMode.value === "absoluteSnapshot") return "Snapshot";
  if (chartMode.value === "absoluteToDelta") return "Transition";
  if (chartMode.value === "delta") return "Delta";

  return "Inactive";
});
const yAxisLabel = computed(() =>
  chartView.value === "absolute" ? "Temperature (degC)" : "Change (degC)",
);
const emptyLabel = computed(() =>
  props.phase === "tutorial"
    ? "Movement tutorial first. Climate data stays hidden."
    : "The climate chart will begin with the real Act 5 story.",
);

const formatAxisValue = (value: number) => {
  if (chartView.value === "absolute") return value.toFixed(0);
  if (value === 0) return "0";

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
};
const formatTemperatureValue = (value: number) => {
  const unit = "\u00b0C";

  if (chartView.value === "absolute") return `${value.toFixed(2)} ${unit}`;
  if (value > 0) return `+${value.toFixed(2)} ${unit}`;
  if (value < 0) return `-${Math.abs(value).toFixed(2)} ${unit}`;

  return `0.00 ${unit}`;
};
const addCompletedStep = (stepId: string) => {
  if (!stepId || completedStepIdSet.value.has(stepId)) return;

  completedStepIds.value = [...completedStepIds.value, stepId];
};
const resetChartProgress = () => {
  completedStepIds.value = [];
  pulseKey.value = "";
  lastPulsedAttemptKey.value = "";
  feedbackBurstKey.value = "";
  resetFeedbackKey.value = "";
  lastObservedAttemptKey.value = "";
  lastObservedSuccessCount.value = 0;
};

const clearFeedbackBurstTimer = () => {
  if (!feedbackBurstTimer) return;

  clearTimeout(feedbackBurstTimer);
  feedbackBurstTimer = null;
};

const clearResetFeedbackTimer = () => {
  if (!resetFeedbackTimer) return;

  clearTimeout(resetFeedbackTimer);
  resetFeedbackTimer = null;
};

const triggerFeedbackBurst = (
  stepId: string,
  successCount: number,
  level: FeedbackBurstLevel,
) => {
  clearFeedbackBurstTimer();
  feedbackBurstLevel.value = level;
  feedbackBurstKey.value = `${stepId}-${props.attemptNumber}-${successCount}`;
  pulseKey.value = feedbackBurstKey.value;
  feedbackBurstTimer = setTimeout(() => {
    feedbackBurstKey.value = "";
    feedbackBurstTimer = null;
  }, 760);
};

const triggerResetFeedback = () => {
  clearResetFeedbackTimer();
  resetFeedbackKey.value = `${activeStepId.value}-${props.attemptNumber}`;
  resetFeedbackTimer = setTimeout(() => {
    resetFeedbackKey.value = "";
    resetFeedbackTimer = null;
  }, 520);
};

watch(
  () => props.flowId,
  (flowId, previousFlowId) => {
    if (flowId !== previousFlowId || flowId === null) {
      resetChartProgress();
    }
  },
);

watch(
  () => props.phase,
  (phase) => {
    if (phase === "idle" || phase === "tutorial") {
      resetChartProgress();
    }
  },
);

watch(
  [activeStepId, currentSuccessCount, requiredSuccessCount],
  ([stepId, successCount, requiredCount]) => {
    if (chartMode.value === "inactive" || !stepId) return;

    if (successCount >= requiredCount) {
      addCompletedStep(stepId);
    }

    const attemptKey = `${stepId}-${props.attemptNumber}`;
    const successIncreased =
      attemptKey === lastObservedAttemptKey.value &&
      successCount > lastObservedSuccessCount.value;

    if (successIncreased) {
      triggerFeedbackBurst(
        stepId,
        successCount,
        successCount >= requiredCount
          ? "second"
          : successCount >= 3
            ? "extra"
            : "first",
      );
    }

    lastObservedAttemptKey.value = attemptKey;
    lastObservedSuccessCount.value = successCount;

    if (successCount >= 3 && lastPulsedAttemptKey.value !== attemptKey) {
      lastPulsedAttemptKey.value = attemptKey;
      triggerFeedbackBurst(stepId, successCount, "extra");
    }
  },
  { immediate: true },
);

watch(
  [() => props.phase, chartRows],
  ([phase]) => {
    if (phase !== "completed") return;

    const allSteps = chartRows.value.map(getStepId);

    completedStepIds.value = [
      ...new Set([...completedStepIds.value, ...allSteps]),
    ];
  },
  { immediate: true },
);

watch(
  () => props.attemptNumber,
  (attemptNumber, previousAttemptNumber) => {
    if (
      previousAttemptNumber === undefined ||
      attemptNumber === previousAttemptNumber
    ) {
      return;
    }

    lastObservedAttemptKey.value = `${activeStepId.value}-${attemptNumber}`;
    lastObservedSuccessCount.value = currentSuccessCount.value;
    triggerResetFeedback();
  },
);

onBeforeUnmount(() => {
  clearFeedbackBurstTimer();
  clearResetFeedbackTimer();
});
</script>

<style scoped>
.act5-climate-chart {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
  height: 100%;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  padding: clamp(12px, 1.25vw, 18px) clamp(16px, 1.8vw, 24px);
  border: 1px solid rgba(31, 49, 39, 0.12);
  border-radius: 10px;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.74),
      rgba(255, 255, 255, 0.5)
    ),
    var(--act5-color-surface);
  color: var(--act5-color-text);
  box-shadow: 0 16px 38px rgba(31, 49, 39, 0.1);
  transition:
    background 220ms ease,
    border-color 220ms ease,
    box-shadow 220ms ease,
    opacity 220ms ease;
}

.act5-climate-chart--inactive {
  border-color: rgba(31, 49, 39, 0.08);
  background: rgba(248, 251, 247, 0.48);
  box-shadow: none;
}

.act5-climate-chart--interaction-focus {
  border-color: rgba(31, 49, 39, 0.16);
  box-shadow: 0 18px 44px rgba(31, 49, 39, 0.12);
}

.act5-climate-chart--transition-focus,
.act5-climate-chart--completed-summary {
  border-color: rgba(31, 49, 39, 0.18);
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.82),
      rgba(255, 255, 255, 0.58)
    ),
    var(--act5-color-surface);
  box-shadow: 0 20px 48px rgba(31, 49, 39, 0.14);
}

.act5-climate-chart--feedback-burst {
  border-color: rgba(31, 49, 39, 0.22);
}

.act5-climate-chart--resetting {
  border-color: rgba(94, 108, 103, 0.2);
}

.act5-climate-chart__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  min-width: 0;
}

.act5-climate-chart__heading {
  min-width: 0;
}

.act5-climate-chart__eyebrow,
.act5-climate-chart h2,
.act5-climate-chart__empty p {
  margin: 0;
}

.act5-climate-chart__eyebrow {
  color: rgba(31, 49, 39, 0.54);
  font-size: 0.64rem;
  font-weight: 850;
  letter-spacing: 0;
  text-transform: uppercase;
}

.act5-climate-chart h2 {
  margin-top: 2px;
  color: var(--act5-color-text-strong);
  font-size: clamp(0.92rem, 1.12vw, 1.12rem);
  line-height: 1.08;
}

.act5-climate-chart__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: end;
  gap: 8px 14px;
  min-width: 0;
}

.act5-climate-chart__view {
  min-height: 22px;
  display: inline-grid;
  place-items: center;
  padding: 3px 8px;
  border: 1px solid rgba(31, 49, 39, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
  color: rgba(31, 49, 39, 0.62);
  font-size: 0.62rem;
  font-weight: 850;
  line-height: 1;
  text-transform: uppercase;
}

.act5-climate-chart__legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 7px 11px;
  margin: 0;
  padding: 0;
  color: rgba(31, 49, 39, 0.58);
  font-size: 0.67rem;
  font-weight: 800;
  list-style: none;
}

.act5-climate-chart__legend li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.act5-climate-chart__legend span {
  width: 17px;
  height: 3px;
  border-radius: 999px;
  background: var(--season-color);
}

.act5-climate-chart__plot,
.act5-climate-chart__empty {
  min-width: 0;
  min-height: 0;
}

.act5-climate-chart__empty {
  display: grid;
  place-items: center;
  border: 1px dashed rgba(31, 49, 39, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.28);
  color: rgba(31, 49, 39, 0.46);
  font-size: 0.82rem;
  font-weight: 800;
  text-align: center;
}

.act5-climate-chart svg {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: block;
  overflow: visible;
}

.act5-climate-chart__grid line {
  stroke: rgba(31, 49, 39, 0.055);
  stroke-width: 1;
}

.act5-climate-chart__period-highlight {
  fill: rgba(255, 255, 255, 0.58);
  stroke: rgba(31, 49, 39, 0.12);
  stroke-width: 1;
}

.act5-climate-chart__baseline {
  stroke: rgba(31, 49, 39, 0.36);
  stroke-dasharray: 5 6;
  stroke-width: 1.2;
}

.act5-climate-chart__axis line {
  stroke: rgba(31, 49, 39, 0.14);
  stroke-width: 1;
}

.act5-climate-chart__axis text {
  dominant-baseline: middle;
  fill: rgba(31, 49, 39, 0.48);
  font-size: 10.5px;
  font-weight: 750;
}

.act5-climate-chart__axis .act5-climate-chart__axis-label {
  fill: rgba(31, 49, 39, 0.56);
  font-size: 11.5px;
  font-weight: 850;
}

.act5-climate-chart__x-tick--future text,
.act5-climate-chart__x-tick--future line {
  opacity: 0.34;
}

.act5-climate-chart__segment,
.act5-climate-chart__point {
  transition:
    filter 220ms ease,
    opacity 240ms ease,
    stroke 240ms ease,
    fill 240ms ease,
    fill-opacity 240ms ease,
    stroke-width 240ms ease,
    r 240ms ease;
}

.act5-climate-chart__segment {
  fill: none;
  stroke-linecap: round;
  stroke-width: 3.4;
}

.act5-climate-chart__segment--preview {
  stroke: rgba(105, 116, 111, 0.42);
  stroke-dasharray: 6 7;
  stroke-width: 3;
}

.act5-climate-chart__segment--partial {
  stroke-width: 4.2;
}

.act5-climate-chart__segment--active {
  stroke-width: 5;
  opacity: 1;
}

.act5-climate-chart__segment--muted {
  opacity: 0.16;
  filter: saturate(0.25);
}

.act5-climate-chart__segment--recent {
  opacity: 1;
  stroke-width: 4.8;
}

.act5-climate-chart__segment--burst {
  animation: act5-chart-line-burst 760ms ease-out;
}

.act5-climate-chart--transition-focus .act5-climate-chart__segment {
  stroke-width: 4;
  opacity: 0.74;
}

.act5-climate-chart--transition-focus .act5-climate-chart__segment--recent {
  stroke-width: 5.2;
  opacity: 1;
}

.act5-climate-chart--completed-summary .act5-climate-chart__segment {
  stroke-width: 4.2;
  opacity: 0.84;
}

.act5-climate-chart__point {
  stroke-width: 2.3;
}

.act5-climate-chart__point--preview {
  fill-opacity: 0.18;
  stroke: rgba(93, 105, 100, 0.78);
}

.act5-climate-chart__point--partial {
  fill-opacity: 0.2;
  stroke-width: 3.4;
}

.act5-climate-chart__point--completed {
  fill-opacity: 0.96;
}

.act5-climate-chart__point--active {
  opacity: 1;
  filter: drop-shadow(0 0 8px rgba(31, 49, 39, 0.18));
  stroke-width: 3.6;
}

.act5-climate-chart__point--muted {
  opacity: 0.24;
  filter: saturate(0.25);
}

.act5-climate-chart__point--recent {
  opacity: 1;
  stroke-width: 3.2;
}

.act5-climate-chart__point--pulse {
  animation: act5-chart-point-pulse 720ms ease-out;
}

.act5-climate-chart--feedback-burst .act5-climate-chart__segment--active {
  filter: drop-shadow(0 0 7px rgba(31, 49, 39, 0.24));
  stroke-width: 6.1;
}

.act5-climate-chart--feedback-burst .act5-climate-chart__point--active {
  filter: drop-shadow(0 0 12px rgba(31, 49, 39, 0.3));
}

.act5-climate-chart--feedback-extra .act5-climate-chart__point--active {
  animation: act5-chart-point-glow 760ms ease-out;
}

.act5-climate-chart--resetting .act5-climate-chart__segment--preview,
.act5-climate-chart--resetting .act5-climate-chart__point--preview {
  transition-duration: 520ms;
}

.act5-climate-chart__value-label text {
  fill: rgba(31, 49, 39, 0.78);
  font-size: 12px;
  font-weight: 850;
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.82);
  stroke-width: 4px;
}

@keyframes act5-chart-point-pulse {
  0% {
    filter: drop-shadow(0 0 0 currentColor);
    stroke-width: 2.8;
  }

  45% {
    filter: drop-shadow(0 0 8px currentColor);
    stroke-width: 5;
  }

  100% {
    filter: drop-shadow(0 0 0 currentColor);
    stroke-width: 2.8;
  }
}

@keyframes act5-chart-line-burst {
  0% {
    filter: drop-shadow(0 0 0 rgba(31, 49, 39, 0));
  }

  42% {
    filter: drop-shadow(0 0 10px rgba(31, 49, 39, 0.28));
  }

  100% {
    filter: drop-shadow(0 0 0 rgba(31, 49, 39, 0));
  }
}

@keyframes act5-chart-point-glow {
  0% {
    filter: drop-shadow(0 0 0 rgba(31, 49, 39, 0));
  }

  45% {
    filter: drop-shadow(0 0 16px currentColor);
  }

  100% {
    filter: drop-shadow(0 0 0 rgba(31, 49, 39, 0));
  }
}

@media (max-width: 860px) {
  .act5-climate-chart {
    padding: 12px 14px;
  }

  .act5-climate-chart__header {
    align-items: start;
    flex-direction: column;
    gap: 8px;
  }

  .act5-climate-chart__meta,
  .act5-climate-chart__legend {
    justify-content: start;
  }
}
</style>
