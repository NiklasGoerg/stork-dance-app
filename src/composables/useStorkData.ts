import { computed, ref, unref, watch, type MaybeRef } from "vue";
import storkDataUrl from "~/assets/storkdata/daily_stork_data.csv?url";
import { parseCsvLine } from "~/utils/csv";
import type {
  StorkDataPoint,
  StorkMapMode,
  StorkStoryCycleDefinition,
  StorkStoryCycleRoute,
  StorkStoryPoint,
  StorkYearPoint,
  StorkYearRoute,
} from "~/types/stork";
import { storyCycleDefinitions } from "~/utils/storkStoryCycles";
import {
  formatStoryDate,
  getDayProgressInStoryCycle,
  getStoryDateFromCycleOffset,
  getStoryDayDistance,
  type StoryDateInput,
} from "~/utils/storyCycle";

const storkPoints = ref<StorkDataPoint[]>([]);
const selectedTag = ref("");
const selectedYear = ref<number | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
const hasLoaded = ref(false);
const selectedPointIndex = ref(0);
const selectedMapMode = ref<StorkMapMode>("explore");
const selectedDayOfYear = ref(1);
const selectedStoryIndex = ref(0);
const selectedStoryDate = ref<string | null>(null);
const showStoryCyclesTogether = ref(false);
const selectedStoryCycleIds = ref(
  storyCycleDefinitions.map((cycle) => cycle.label),
);

type UseStorkDataOptions = {
  storyCycleDefinitions?: MaybeRef<StorkStoryCycleDefinition[]>;
};

const routeColors = [
  "#c1121f",
  "#1f77b4",
  "#2ca02c",
  "#ffb000",
  "#7b2cbf",
  "#009688",
  "#e76f51",
  "#4d908e",
  "#f72585",
  "#4361ee",
];

const getRouteColor = (index: number) =>
  routeColors[index % routeColors.length] ?? "#c1121f";

const getDayOfYear = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) return 1;

  const currentDate = Date.UTC(year, month - 1, day);
  const firstDayOfYear = Date.UTC(year, 0, 1);

  return Math.floor((currentDate - firstDayOfYear) / 86400000) + 1;
};

const getClosestPointForStoryDate = (
  points: StorkDataPoint[],
  storyDate: StoryDateInput,
) => {
  if (!points.length) return null;

  return points.reduce((closestPoint, pointCandidate) => {
    const closestDistance = getStoryDayDistance(closestPoint.date, storyDate);
    const candidateDistance = getStoryDayDistance(
      pointCandidate.date,
      storyDate,
    );

    return candidateDistance < closestDistance ? pointCandidate : closestPoint;
  });
};

const parseStorkCsv = (csv: string) => {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0] ?? "");

  const tagIndex = header.indexOf("tag-local-identifier");
  const dateIndex = header.indexOf("date");
  const timestampIndex = header.indexOf("timestamp");
  const latIndex = header.indexOf("location-lat");
  const lngIndex = header.indexOf("location-long");

  if ([tagIndex, dateIndex, timestampIndex, latIndex, lngIndex].includes(-1)) {
    throw new Error("CSV columns do not match the expected stork data format.");
  }

  const points: StorkDataPoint[] = [];

  for (const line of lines.slice(1)) {
    const row = parseCsvLine(line);
    const tag = row[tagIndex];
    const date = row[dateIndex];
    const timestamp = row[timestampIndex];
    const lat = Number(row[latIndex]);
    const lng = Number(row[lngIndex]);
    const year = Number(date?.slice(0, 4));

    if (!tag || !date || !timestamp || !Number.isFinite(year)) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < 0) continue;

    points.push({ tag, date, timestamp, year, lat, lng });
  }

  return points;
};

export const useStorkData = (options: UseStorkDataOptions = {}) => {
  const activeStoryCycleDefinitions = computed(
    () => unref(options.storyCycleDefinitions) ?? storyCycleDefinitions,
  );

  const loadStorkData = async () => {
    if (hasLoaded.value || isLoading.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(storkDataUrl);

      if (!response.ok) {
        throw new Error(`Could not load stork data (${response.status}).`);
      }

      storkPoints.value = parseStorkCsv(await response.text());
      hasLoaded.value = true;
    } catch (loadError) {
      error.value =
        loadError instanceof Error
          ? loadError.message
          : "Could not load stork data.";
    } finally {
      isLoading.value = false;
    }
  };

  const availableTags = computed(() =>
    [...new Set(storkPoints.value.map((point) => point.tag))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    ),
  );

  const availableYearsForSelectedTag = computed(() => {
    if (!selectedTag.value) return [];

    return [
      ...new Set(
        storkPoints.value
          .filter((point) => point.tag === selectedTag.value)
          .map((point) => point.year),
      ),
    ].sort((a, b) => a - b);
  });

  const selectedRoutePoints = computed(() => {
    if (!selectedTag.value || selectedYear.value === null) return [];

    return storkPoints.value
      .filter(
        (point) =>
          point.tag === selectedTag.value && point.year === selectedYear.value,
      )
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  });

  const selectedRoutePoint = computed(
    () => selectedRoutePoints.value[selectedPointIndex.value] ?? null,
  );

  const allYearRouteGroups = computed<StorkYearRoute[]>(() => {
    if (!selectedTag.value) return [];

    return availableYearsForSelectedTag.value.map((year, index) => ({
      year,
      color: getRouteColor(index),
      points: storkPoints.value
        .filter(
          (point) => point.tag === selectedTag.value && point.year === year,
        )
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    }));
  });

  const comparisonDayBounds = computed(() => {
    const days = allYearRouteGroups.value
      .flatMap((route) => route.points)
      .map((point) => getDayOfYear(point.date));

    if (!days.length) {
      return { min: 1, max: 366 };
    }

    return {
      min: Math.min(...days),
      max: Math.max(...days),
    };
  });

  const selectedAllYearPoints = computed<StorkYearPoint[]>(() =>
    allYearRouteGroups.value.flatMap((route) => {
      if (!route.points.length) return [];

      const point =
        route.points.reduce((closestPoint, pointCandidate) => {
          const closestDistance = Math.abs(
            getDayOfYear(closestPoint.date) - selectedDayOfYear.value,
          );
          const candidateDistance = Math.abs(
            getDayOfYear(pointCandidate.date) - selectedDayOfYear.value,
          );

          return candidateDistance < closestDistance
            ? pointCandidate
            : closestPoint;
        }) ?? null;

      return point ? [{ year: route.year, color: route.color, point }] : [];
    }),
  );

  const storyCycleRoutes = computed<StorkStoryCycleRoute[]>(() =>
    activeStoryCycleDefinitions.value.map((cycle, index) => {
      const startDate = `${cycle.targetYear}-06-01`;
      const endDate = `${cycle.targetYear + 1}-05-31`;

      return {
        ...cycle,
        id: cycle.label,
        color: getRouteColor(index),
        startDate,
        endDate,
        points: storkPoints.value
          .filter(
            (point) =>
              point.tag === cycle.tag &&
              point.date >= startDate &&
              point.date <= endDate,
          )
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      };
    }),
  );

  const visibleStoryCycleRoutes = computed<StorkStoryCycleRoute[]>(() => {
    const visibleIds = new Set(selectedStoryCycleIds.value);

    return storyCycleRoutes.value.filter((cycle) => visibleIds.has(cycle.id));
  });

  const storyTimelinePoints = computed<StorkStoryPoint[]>(() =>
    visibleStoryCycleRoutes.value
      .flatMap((cycle) =>
        cycle.points.map((point) => ({
          cycle,
          point,
          timelineIndex: 0,
        })),
      )
      .map((storyPoint, index) => ({
        ...storyPoint,
        timelineIndex: index,
      })),
  );

  const selectedStoryPoint = computed(
    () => storyTimelinePoints.value[selectedStoryIndex.value] ?? null,
  );

  const storyCycleSliderMax = computed(() => {
    if (!showStoryCyclesTogether.value) {
      return Math.max(storyTimelinePoints.value.length - 1, 0);
    }

    return Math.max(
      ...visibleStoryCycleRoutes.value.map(
        (cycle) => getDayProgressInStoryCycle(cycle.startDate).totalDays - 1,
      ),
      0,
    );
  });

  const selectedStoryPoints = computed<StorkStoryPoint[]>(() => {
    if (!showStoryCyclesTogether.value) {
      return selectedStoryPoint.value ? [selectedStoryPoint.value] : [];
    }

    const dateForSelection =
      selectedStoryDate.value ??
      formatStoryDate(
        getStoryDateFromCycleOffset(
          visibleStoryCycleRoutes.value[0]?.startDate ?? "2022-06-01",
          selectedStoryIndex.value,
        ),
      );
    const storyDayOffset =
      getDayProgressInStoryCycle(dateForSelection).elapsedDays;

    return visibleStoryCycleRoutes.value.flatMap((cycle) => {
      const cycleDate = getStoryDateFromCycleOffset(
        cycle.startDate,
        storyDayOffset,
      );
      const point = getClosestPointForStoryDate(cycle.points, cycleDate);

      return point
        ? [
            {
              cycle,
              point,
              timelineIndex: selectedStoryIndex.value,
            },
          ]
        : [];
    });
  });

  const seekStoryToDate = (date: StoryDateInput) => {
    selectedStoryDate.value = formatStoryDate(date);
    selectedStoryIndex.value = getDayProgressInStoryCycle(date).elapsedDays;
  };

  watch(availableTags, (tags) => {
    if (!selectedTag.value && tags[0]) {
      selectedTag.value = tags[0];
    }
  });

  watch(availableYearsForSelectedTag, (years) => {
    if (!years.length) {
      selectedYear.value = null;
      return;
    }

    if (selectedYear.value === null || !years.includes(selectedYear.value)) {
      selectedYear.value = years[0] ?? null;
    }
  });

  watch(selectedRoutePoints, (points) => {
    if (selectedPointIndex.value > points.length - 1) {
      selectedPointIndex.value = Math.max(points.length - 1, 0);
      return;
    }

    selectedPointIndex.value = 0;
  });

  watch(comparisonDayBounds, ({ min, max }) => {
    if (selectedDayOfYear.value < min || selectedDayOfYear.value > max) {
      selectedDayOfYear.value = min;
    }
  });

  watch(storyCycleSliderMax, (max) => {
    if (selectedStoryIndex.value > max) {
      selectedStoryIndex.value = max;
    }
  });

  watch(selectedStoryIndex, (index) => {
    if (!showStoryCyclesTogether.value) return;

    selectedStoryDate.value = formatStoryDate(
      getStoryDateFromCycleOffset(
        visibleStoryCycleRoutes.value[0]?.startDate ?? "2022-06-01",
        index,
      ),
    );
  });

  watch(showStoryCyclesTogether, (showTogether) => {
    if (!showTogether) {
      selectedStoryDate.value = null;
      return;
    }

    selectedStoryDate.value = formatStoryDate(
      getStoryDateFromCycleOffset(
        visibleStoryCycleRoutes.value[0]?.startDate ?? "2022-06-01",
        selectedStoryIndex.value,
      ),
    );
  });

  watch(selectedStoryCycleIds, (ids) => {
    const nextIds = ids.filter((id, index) => {
      const isKnownCycle = activeStoryCycleDefinitions.value.some(
        (cycle) => cycle.label === id,
      );

      return isKnownCycle && ids.indexOf(id) === index;
    });

    if (
      nextIds.length === ids.length &&
      nextIds.every((id) => ids.includes(id))
    ) {
      return;
    }

    selectedStoryCycleIds.value = nextIds;
  });

  return {
    storkPoints,
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
    selectedStoryDate,
    selectedStoryCycleIds,
    showStoryCyclesTogether,
    storyCycleSliderMax,
    seekStoryToDate,
    isLoading,
    error,
    loadStorkData,
  };
};
