<template>
  <div class="map-shell">
    <div ref="mapContainer" class="map" />

    <StorkRouteControls
      v-if="showControls"
      v-model:selected-tag="selectedTag"
      v-model:selected-year="selectedYear"
      v-model:selected-point-index="selectedPointIndex"
      v-model:selected-day-of-year="selectedDayOfYear"
      v-model:selected-map-mode="selectedMapMode"
      v-model:selected-story-index="selectedStoryIndex"
      v-model:selected-story-cycle-ids="selectedStoryCycleIds"
      v-model:show-story-cycles-together="showStoryCyclesTogether"
      :available-tags="availableTags"
      :available-years="availableYearsForSelectedTag"
      :point-count="selectedRoutePoints.length"
      :current-point-label="selectedRoutePointLabel"
      :comparison-day-min="comparisonDayBounds.min"
      :comparison-day-max="comparisonDayBounds.max"
      :year-legend="yearLegend"
      :story-slider-max="storyCycleSliderMax"
      :story-point-label="selectedStoryPointLabel"
      :story-legend="storyLegend"
      :is-loading="isLoading"
      :error="error"
      :single-story-cycle-mode="singleStoryCycleMode"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { storeToRefs } from "pinia";
import StorkRouteControls from "~/components/map/StorkRouteControls.vue";
import {
  useLeafletStorkRoute,
  type LeafletRouteMap,
  type LeafletRouteModule,
} from "~/composables/useLeafletStorkRoute";
import { useStorkData } from "~/composables/useStorkData";
import { useStoryPlaybackStore } from "~/store/storyPlayback";
import type { StorkStoryCycleDefinition } from "~/types/stork";
import { storyCycleDefinitions as defaultStoryCycleDefinitions } from "~/utils/storkStoryCycles";

type LeafletMapInstance = LeafletRouteMap & {
  remove: () => void;
  invalidateSize: () => void;
};

type LeafletModule = LeafletRouteModule & {
  map: (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => LeafletMapInstance;
  tileLayer: (
    urlTemplate: string,
    options: Record<string, unknown>,
  ) => {
    addTo: (map: LeafletMapInstance) => unknown;
  };
};

const mapContainer = ref<HTMLDivElement | null>(null);
const leaflet = ref<LeafletModule | null>(null);
const map = ref<LeafletMapInstance | null>(null);
const props = withDefaults(
  defineProps<{
    showControls?: boolean;
    showMapNavigation?: boolean;
    storyCycleIds?: string[];
    storyCycleDefinitions?: StorkStoryCycleDefinition[];
    singleStoryCycleMode?: boolean;
  }>(),
  {
    showControls: true,
    showMapNavigation: true,
    storyCycleIds: undefined,
    storyCycleDefinitions: undefined,
    singleStoryCycleMode: false,
  },
);
const { t } = useI18n();

const activeStoryCycleDefinitions = computed(
  () => props.storyCycleDefinitions ?? defaultStoryCycleDefinitions,
);

const {
  availableTags,
  selectedTag,
  selectedYear,
  availableYearsForSelectedTag,
  selectedRoutePoints,
  selectedRoutePoint,
  selectedPointIndex,
  selectedMapMode,
  allYearRouteGroups,
  selectedAllYearPoints,
  selectedDayOfYear,
  comparisonDayBounds,
  storyCycleRoutes,
  visibleStoryCycleRoutes,
  storyTimelinePoints,
  selectedStoryPoint,
  selectedStoryPoints,
  selectedStoryIndex,
  selectedStoryCycleIds,
  showStoryCyclesTogether,
  storyCycleSliderMax,
  seekStoryToDate,
  isLoading,
  error,
  loadStorkData,
} = useStorkData({
  storyCycleDefinitions: activeStoryCycleDefinitions,
});

const storyPlaybackStore = useStoryPlaybackStore();
const { currentDate } = storeToRefs(storyPlaybackStore);

const {
  clearRoute,
  drawRoute,
  drawYearRoutes,
  drawSelectedPoint,
  drawSelectedYearPoints,
} = useLeafletStorkRoute();

const selectedRoutePointLabel = computed(() => {
  if (!selectedRoutePoint.value) return "";

  return selectedRoutePoint.value.date;
});

const yearLegend = computed(() =>
  allYearRouteGroups.value.map((route) => ({
    year: route.year,
    color: route.color,
    pointCount: route.points.length,
    currentDate:
      selectedAllYearPoints.value.find(
        (yearPoint) => yearPoint.year === route.year,
      )?.point.date ?? "",
  })),
);

const storyLegend = computed(() =>
  storyCycleRoutes.value.map((cycle) => ({
    id: cycle.id,
    step: cycle.step,
    targetYear: cycle.targetYear,
    tag: cycle.tag,
    color: cycle.color,
    wintering: cycle.wintering,
    pointCount: cycle.points.length,
  })),
);

const selectedStoryPointLabel = computed(() => {
  const visibleCycleCount = visibleStoryCycleRoutes.value.length;

  if (visibleCycleCount === 0) {
    return t("map.noCyclesSelected");
  }

  if (showStoryCyclesTogether.value) {
    return t("map.cycleDay", { day: selectedStoryIndex.value + 1 });
  }

  if (!selectedStoryPoint.value) return "";

  return t("map.storyPoint", {
    step: selectedStoryPoint.value.cycle.step,
    date: selectedStoryPoint.value.point.date,
    wintering: selectedStoryPoint.value.cycle.wintering,
  });
});

const selectedStoryMapPoints = computed(() =>
  selectedStoryPoints.value.map((storyPoint) => ({
    color: storyPoint.cycle.color,
    point: storyPoint.point,
  })),
);

const getConfiguredStoryCycleIds = () =>
  props.storyCycleIds?.length
    ? [...props.storyCycleIds]
    : props.singleStoryCycleMode
      ? [activeStoryCycleDefinitions.value[0]?.label].filter(Boolean)
      : activeStoryCycleDefinitions.value.map((cycle) => cycle.label);

const configureStoryMode = () => {
  selectedMapMode.value = "story";
  showStoryCyclesTogether.value = !props.singleStoryCycleMode;
  selectedStoryCycleIds.value = getConfiguredStoryCycleIds();
  seekStoryToDate(currentDate.value);
};

const renderCurrentMode = () => {
  if (selectedMapMode.value === "all-years") {
    drawYearRoutes(map.value, leaflet.value, allYearRouteGroups.value);
    drawSelectedYearPoints(
      map.value,
      leaflet.value,
      selectedAllYearPoints.value,
    );
    return;
  }

  if (selectedMapMode.value === "story") {
    drawYearRoutes(map.value, leaflet.value, visibleStoryCycleRoutes.value);
    drawSelectedYearPoints(
      map.value,
      leaflet.value,
      selectedStoryMapPoints.value,
    );
    return;
  }

  drawRoute(map.value, leaflet.value, selectedRoutePoints.value);
  drawSelectedPoint(map.value, leaflet.value, selectedRoutePoint.value);
};

onMounted(() => {
  const createMap = async () => {
    if (!mapContainer.value) return;

    const leafletModule = (await import("leaflet")) as unknown as LeafletModule;
    leaflet.value = leafletModule;

    const leafletMap = leafletModule.map(mapContainer.value, {
      center: [40, 0],
      zoom: 4,
      minZoom: 4,
      maxZoom: 8,
      maxBounds: [
        [12, -25],
        [72, 35],
      ],
      maxBoundsViscosity: 1,
      preferCanvas: true,
      zoomControl: props.showMapNavigation,
      dragging: props.showMapNavigation,
      scrollWheelZoom: props.showMapNavigation,
      doubleClickZoom: props.showMapNavigation,
      boxZoom: props.showMapNavigation,
      keyboard: props.showMapNavigation,
      touchZoom: props.showMapNavigation,
      attributionControl: true,
    });
    map.value = leafletMap;

    leafletModule
      .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      })
      .addTo(leafletMap);

    await nextTick();
    requestAnimationFrame(() => {
      leafletMap.invalidateSize();
      renderCurrentMode();
    });
  };

  configureStoryMode();

  void createMap();
  void loadStorkData();
});

watch(currentDate, (date) => {
  if (selectedMapMode.value !== "story") return;

  if (props.singleStoryCycleMode) {
    showStoryCyclesTogether.value = false;
  }

  seekStoryToDate(date);
});

watch(selectedMapMode, (mode) => {
  if (mode !== "story" || !props.singleStoryCycleMode) return;

  showStoryCyclesTogether.value = false;

  if (selectedStoryCycleIds.value.length === 1) return;

  selectedStoryCycleIds.value = getConfiguredStoryCycleIds();
});

watch(selectedStoryCycleIds, (ids) => {
  if (!props.singleStoryCycleMode) return;

  const selectedId = ids[ids.length - 1] ?? getConfiguredStoryCycleIds()[0];
  const nextIds = selectedId ? [selectedId] : [];

  if (
    nextIds.length === selectedStoryCycleIds.value.length &&
    nextIds.every((id, index) => id === selectedStoryCycleIds.value[index])
  ) {
    return;
  }

  selectedStoryCycleIds.value = nextIds;
  showStoryCyclesTogether.value = false;
});

watch(
  () => props.storyCycleIds?.join("|") ?? "",
  () => {
    configureStoryMode();
    renderCurrentMode();
  },
);

watch(
  () => activeStoryCycleDefinitions.value.map((cycle) => cycle.label).join("|"),
  () => {
    configureStoryMode();
    renderCurrentMode();
  },
);

watch(
  [
    selectedMapMode,
    selectedRoutePoints,
    allYearRouteGroups,
    visibleStoryCycleRoutes,
  ],
  () => {
    renderCurrentMode();
  },
);

watch(selectedStoryMapPoints, (points) => {
  if (selectedMapMode.value !== "story") return;

  drawSelectedYearPoints(map.value, leaflet.value, points);
});

watch(selectedRoutePoint, (point) => {
  if (selectedMapMode.value !== "explore") return;

  drawSelectedPoint(map.value, leaflet.value, point);
});

watch(selectedAllYearPoints, (points) => {
  if (selectedMapMode.value !== "all-years") return;

  drawSelectedYearPoints(map.value, leaflet.value, points);
});

watch([storyTimelinePoints, showStoryCyclesTogether], () => {
  if (selectedMapMode.value !== "story") return;

  renderCurrentMode();
});

onBeforeUnmount(() => {
  clearRoute(map.value);
  map.value?.remove();
  map.value = null;
  leaflet.value = null;
});
</script>

<style scoped>
.map-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #dce7dd;
}

.map {
  width: 100%;
  height: 100%;
  min-height: 0;
}

:deep(.leaflet-container) {
  width: 100%;
  height: 100%;
  font-family: inherit;
}
</style>
