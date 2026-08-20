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
import { useStoryMarkerInterpolation } from "~/composables/useStoryMarkerInterpolation";
import { useStorkData } from "~/composables/useStorkData";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import type {
  MigrationActMapFrame,
  MigrationMapCameraMode,
} from "~/types/migrationAct";
import type {
  StorkDataSource,
  StorkMigrationEvent,
  StorkMigrationPhase,
  StorkStoryCycleDefinition,
} from "~/types/stork";
import { migrationStoryCycleDefinitions as defaultStoryCycleDefinitions } from "~/utils/migrationStoryData";
import {
  buildPreparedStoryTimeline,
  getWeightedStoryTimelineDayAtElapsedMs,
} from "~/utils/storyCycle";
import { getMigrationTimelineDayAtElapsedMs } from "~/utils/migrationActs/timeline";

type LeafletMapInstance = LeafletRouteMap & {
  remove: () => void;
  invalidateSize: () => void;
  on: (eventTypes: string, handler: () => void) => void;
  off: (eventTypes: string, handler: () => void) => void;
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
let lastEmittedStoryFrameKey = "";
const props = withDefaults(
  defineProps<{
    showControls?: boolean;
    showMapNavigation?: boolean;
    storyCycleIds?: string[];
    storyCycleDefinitions?: StorkStoryCycleDefinition[];
    singleStoryCycleMode?: boolean;
    dataSource?: StorkDataSource;
    playbackSource?: "story-playback" | "migration-runtime";
    cameraMode?: MigrationMapCameraMode;
    showStoryMarker?: boolean;
  }>(),
  {
    showControls: true,
    showMapNavigation: true,
    storyCycleIds: undefined,
    storyCycleDefinitions: undefined,
    singleStoryCycleMode: false,
    dataSource: "raw",
    playbackSource: "migration-runtime",
    cameraMode: "migration",
    showStoryMarker: true,
  },
);
const emit = defineEmits<{
  "story-frame": [frame: MigrationActMapFrame];
}>();
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
  dataSource: computed(() => props.dataSource),
});

const migrationActStore = useMigrationActStore();
const migrationActRefs = storeToRefs(migrationActStore);
const usesMigrationRuntime = computed(
  () => props.playbackSource === "migration-runtime",
);
const activeCycleId = computed(() => migrationActRefs.activeCycleId.value);
const currentDate = computed(() => migrationActRefs.currentDate.value);
const currentElapsedMs = computed(
  () => migrationActRefs.currentElapsedMs.value,
);
const cycleDurationMs = computed(() => migrationActRefs.cycleDurationMs.value);
const isPlaying = computed(() => migrationActRefs.isPlaying.value);
const playbackSessionId = computed(
  () => migrationActRefs.playbackSessionId.value,
);
const seekRevision = computed(() => migrationActRefs.seekRevision.value);

const {
  clearRoute,
  drawRoute,
  drawYearRoutes,
  drawSelectedPoint,
  drawSelectedYearPoints,
  drawSelectedStoryPoints,
  setSelectedStoryMarkerPosition,
} = useLeafletStorkRoute();

const interpolationRoute = computed(() => {
  if (props.dataSource !== "story") return null;
  if (visibleStoryCycleRoutes.value.length !== 1) return null;

  const route = visibleStoryCycleRoutes.value[0];
  return route?.id === activeCycleId.value ? route : null;
});

const interpolationTimeline = computed(() => {
  const route = interpolationRoute.value;

  if (usesMigrationRuntime.value && migrationActStore.timeline.length) {
    return migrationActStore.timeline;
  }

  return route
    ? buildPreparedStoryTimeline(route.points, cycleDurationMs.value)
    : [];
});

const currentTimelineDay = computed(() =>
  usesMigrationRuntime.value
    ? getMigrationTimelineDayAtElapsedMs(
        interpolationTimeline.value,
        currentElapsedMs.value,
      )
    : getWeightedStoryTimelineDayAtElapsedMs(
        interpolationTimeline.value,
        currentElapsedMs.value,
      ),
);

const activeRuntimeEvent = computed(
  () =>
    migrationActStore.events.find(
      (event) => event.id === migrationActStore.activeEventId,
    ) ?? null,
);

const pendingRuntimeEvent = computed(
  () =>
    migrationActStore.events.find(
      (event) => event.id === migrationActStore.pendingEventId,
    ) ??
    migrationActStore.events.find((event) => event.status === "pending") ??
    null,
);

const semanticCameraConfig = {
  migration: {
    padding: [54, 54] as [number, number],
    maxZoom: 6,
  },
  residence: {
    padding: [80, 80] as [number, number],
    maxZoom: 7,
  },
};

let lastSemanticCameraKey = "";
let markerRefreshFrame = 0;

function scheduleStoryMarkerRefresh() {
  if (selectedMapMode.value !== "story") return;

  if (markerRefreshFrame) {
    cancelAnimationFrame(markerRefreshFrame);
  }

  markerRefreshFrame = requestAnimationFrame(() => {
    markerRefreshFrame = 0;
    storyMarkerInterpolation.updateImmediately();
  });
}

const handleMapViewportChanged = () => {
  scheduleStoryMarkerRefresh();
};

const getActiveResidencePoints = () => {
  const route = interpolationRoute.value;
  const day = currentTimelineDay.value;

  if (!route || !day) return [];

  return route.points.filter(
    (point) => point.story?.phase === day.phase && point.story?.isRestDay,
  );
};

const getMigrationPhaseForEvent = (
  eventType: StorkMigrationEvent | null | undefined,
): Extract<
  StorkMigrationPhase,
  "autumn_migration" | "spring_migration"
> | null => {
  if (eventType === "autumn_departure" || eventType === "autumn_arrival") {
    return "autumn_migration";
  }

  if (eventType === "spring_departure" || eventType === "spring_arrival") {
    return "spring_migration";
  }

  return null;
};

const getActiveMigrationCameraPhase = () => {
  const eventPhase =
    getMigrationPhaseForEvent(activeRuntimeEvent.value?.eventType) ??
    getMigrationPhaseForEvent(pendingRuntimeEvent.value?.eventType);

  if (eventPhase) return eventPhase;

  const phase = currentTimelineDay.value?.phase;
  return phase === "autumn_migration" || phase === "spring_migration"
    ? phase
    : null;
};

const getActiveMigrationPoints = () => {
  const route = interpolationRoute.value;
  const migrationPhase = getActiveMigrationCameraPhase();

  if (!route) return [];

  const migrationPhasePoints = migrationPhase
    ? route.points.filter((point) => point.story?.phase === migrationPhase)
    : [];

  return migrationPhasePoints.length ? migrationPhasePoints : route.points;
};

const fitCameraToPoints = (
  points: Array<{ lat: number; lng: number }>,
  options: { maxZoom: number; padding: [number, number]; animate: boolean },
) => {
  if (!map.value || !leaflet.value || !points.length) return;

  map.value.stop?.();

  if (points.length === 1) {
    map.value.setView?.([points[0]!.lat, points[0]!.lng], options.maxZoom, {
      animate: options.animate,
    });
    return;
  }

  const boundsLine = leaflet.value.polyline(
    points.map((point) => [point.lat, point.lng]),
    {},
  );
  map.value.fitBounds(boundsLine.getBounds(), options);
};

const getSemanticCameraKey = () => {
  const day = currentTimelineDay.value;
  const route = interpolationRoute.value;
  const migrationCameraPhase = getActiveMigrationCameraPhase();

  if (!usesMigrationRuntime.value || selectedMapMode.value !== "story") {
    return "";
  }

  return props.cameraMode === "migration"
    ? `${route?.id ?? "none"}:migration:${migrationCameraPhase ?? "full"}`
    : `${route?.id ?? "none"}:residence:${day?.phase ?? "none"}`;
};

const applySemanticCamera = (animate = true, force = false) => {
  if (!usesMigrationRuntime.value || selectedMapMode.value !== "story") return;

  const cameraKey = getSemanticCameraKey();
  if (!force && cameraKey && cameraKey === lastSemanticCameraKey) return;
  lastSemanticCameraKey = cameraKey;

  if (props.cameraMode === "migration") {
    const config = semanticCameraConfig.migration;
    fitCameraToPoints(getActiveMigrationPoints(), {
      padding: config.padding,
      maxZoom: config.maxZoom,
      animate,
    });
    scheduleStoryMarkerRefresh();
    return;
  }

  const config = semanticCameraConfig.residence;
  fitCameraToPoints(getActiveResidencePoints(), {
    padding: config.padding,
    maxZoom: config.maxZoom,
    animate,
  });
  scheduleStoryMarkerRefresh();
};

const getStoryMarkerFrame = () => {
  const route = interpolationRoute.value;
  const elapsedMs = migrationActStore.currentElapsedMs;
  const currentDay = currentTimelineDay.value;

  if (!route || !currentDay) return null;

  const currentPoint = route.points[currentDay.relativeDay];
  const nextPoint = route.points[currentDay.relativeDay + 1];

  if (currentPoint) {
    const frameKey = `${route.id}:${currentPoint.date}`;
    if (frameKey !== lastEmittedStoryFrameKey) {
      lastEmittedStoryFrameKey = frameKey;
      emit("story-frame", {
        cycleId: route.id,
        date: currentPoint.date,
        phase: currentDay.phase,
        event: currentDay.event,
        markerLatLng: {
          lat: currentPoint.lat,
          lng: currentPoint.lng,
        },
        cameraReady: Boolean(map.value),
      });
    }
  }

  return {
    cycleId: route.id,
    currentDay,
    currentPoint,
    nextPoint,
    elapsedMs,
  };
};

const storyMarkerInterpolation = useStoryMarkerInterpolation({
  getFrame: getStoryMarkerFrame,
  isPlaybackActive: () => isPlaying.value,
  setMarkerPosition: setSelectedStoryMarkerPosition,
});

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

const isDefinedString = (value: string | undefined): value is string =>
  Boolean(value);

const getConfiguredStoryCycleIds = (): string[] =>
  props.storyCycleIds?.length
    ? [...props.storyCycleIds]
    : props.singleStoryCycleMode
      ? [activeStoryCycleDefinitions.value[0]?.label].filter(isDefinedString)
      : activeStoryCycleDefinitions.value.map((cycle) => cycle.label);

const getInitialStoryDate = () => {
  if (currentDate.value) return currentDate.value;

  const configuredCycleId = getConfiguredStoryCycleIds()[0];
  const configuredCycle = storyCycleRoutes.value.find(
    (cycle) => cycle.id === configuredCycleId,
  );

  return configuredCycle?.startDate ?? "2016-06-01";
};

const configureStoryMode = () => {
  selectedMapMode.value = "story";
  showStoryCyclesTogether.value = !props.singleStoryCycleMode;
  selectedStoryCycleIds.value = getConfiguredStoryCycleIds();
  seekStoryToDate(getInitialStoryDate());
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
    if (props.showStoryMarker) {
      drawSelectedStoryPoints(
        map.value,
        leaflet.value,
        selectedStoryPoints.value,
      );
    }
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
    leafletMap.on("zoomend moveend viewreset resize", handleMapViewportChanged);

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
      applySemanticCamera(false, true);
      storyMarkerInterpolation.updateImmediately();
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
    applySemanticCamera(true, true);
    scheduleStoryMarkerRefresh();
  },
);

watch(
  () => activeStoryCycleDefinitions.value.map((cycle) => cycle.label).join("|"),
  () => {
    configureStoryMode();
    renderCurrentMode();
    applySemanticCamera(true, true);
    scheduleStoryMarkerRefresh();
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
    applySemanticCamera(true, true);
    scheduleStoryMarkerRefresh();
  },
);

watch(selectedStoryPoints, (points) => {
  if (selectedMapMode.value !== "story") return;
  if (!props.showStoryMarker) return;

  const usesInterpolatedMarker = Boolean(interpolationRoute.value);
  drawSelectedStoryPoints(map.value, leaflet.value, points, {
    updatePositions: !usesInterpolatedMarker,
  });

  if (points[0]?.point.story?.isRestDay) {
    storyMarkerInterpolation.updateImmediately();
  } else {
    storyMarkerInterpolation.start();
  }
});

watch(isPlaying, () => {
  storyMarkerInterpolation.updateImmediately();
});

watch(currentElapsedMs, () => {
  storyMarkerInterpolation.update();
});

watch(seekRevision, () => {
  storyMarkerInterpolation.updateImmediately();
});

watch([playbackSessionId, activeCycleId, cycleDurationMs], () => {
  lastEmittedStoryFrameKey = "";
  lastSemanticCameraKey = "";
  renderCurrentMode();
  applySemanticCamera(false, true);
  storyMarkerInterpolation.updateImmediately();
});

watch(getSemanticCameraKey, () => {
  applySemanticCamera();
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
  scheduleStoryMarkerRefresh();
});

watch(
  () => props.showStoryMarker,
  () => {
    renderCurrentMode();
    scheduleStoryMarkerRefresh();
  },
);

onBeforeUnmount(() => {
  if (markerRefreshFrame) {
    cancelAnimationFrame(markerRefreshFrame);
    markerRefreshFrame = 0;
  }
  storyMarkerInterpolation.stop();
  map.value?.stop?.();
  map.value?.off?.(
    "zoomend moveend viewreset resize",
    handleMapViewportChanged,
  );
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

:deep(.stork-route-div-icon) {
  border: 0;
  background: transparent;
}

:deep(.stork-route-marker) {
  display: grid;
  width: 84px;
  height: 48px;
  place-items: center;
  pointer-events: none;
}

:deep(.stork-route-marker__image) {
  display: block;
  width: 84px;
  height: 48px;
  object-fit: contain;
  filter: drop-shadow(0 3px 4px rgba(22, 22, 22, 0.32));
  transform-origin: center;
}

:deep(.stork-route-marker__image--mirrored) {
  transform: scaleX(-1);
}
</style>
