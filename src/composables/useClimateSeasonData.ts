import { computed, ref } from "vue";
import temperatureSeasonsDataUrl from "~/assets/climate_data/temperature_seasons_data.csv?url";
import {
  buildSeasonTimeline,
  climateDataSourcePath,
  getBaselineStep,
  parseClimateSeasonDataCsv,
} from "~/utils/movement/acts/climate/climateSeasonData";
import type {
  ClimateDataValidationError,
  ClimateSeason,
  ClimateSeasonDataset,
  ClimateSeasonLoaderState,
} from "~/types/climate";

const dataset = ref<ClimateSeasonDataset | null>(null);
const validationErrors = ref<ClimateDataValidationError[]>([]);
const isLoading = ref(false);
const hasLoaded = ref(false);
const error = ref<string | null>(null);

export const useClimateSeasonData = () => {
  const loaderState = computed<ClimateSeasonLoaderState>(() => {
    if (isLoading.value) return "loading";
    if (dataset.value) return "loaded";
    if (error.value || validationErrors.value.length) return "error";

    return "idle";
  });

  const loadClimateSeasonData = async () => {
    if (hasLoaded.value || isLoading.value) return dataset.value;

    isLoading.value = true;
    error.value = null;
    validationErrors.value = [];

    try {
      const response = await fetch(temperatureSeasonsDataUrl);

      if (!response.ok) {
        throw new Error(`Could not load climate data (${response.status}).`);
      }

      const result = parseClimateSeasonDataCsv(await response.text());

      validationErrors.value = result.errors;

      if (!result.dataset || result.errors.length) {
        throw new Error("Climate data validation failed.");
      }

      dataset.value = result.dataset;
      hasLoaded.value = true;
      return dataset.value;
    } catch (loadError) {
      error.value =
        loadError instanceof Error
          ? loadError.message
          : "Could not load climate data.";
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  const getSeasonTimeline = (season: ClimateSeason) =>
    dataset.value ? buildSeasonTimeline(dataset.value, season) : [];

  const getSeasonBaselineStep = (season: ClimateSeason) =>
    dataset.value ? getBaselineStep(dataset.value, season) : null;

  return {
    dataset,
    validationErrors,
    isLoading,
    hasLoaded,
    error,
    loaderState,
    csvLoaded: computed(() => Boolean(dataset.value)),
    sourcePath: climateDataSourcePath,
    loadClimateSeasonData,
    getSeasonTimeline,
    getSeasonBaselineStep,
  };
};
