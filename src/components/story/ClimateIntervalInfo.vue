<template>
  <article class="climate-interval-info">
    <p class="climate-interval-info__eyebrow">
      {{ t("story.acts.act5.climateInfo.eyebrow") }}
    </p>
    <p class="climate-interval-info__interval">{{ step.interval }}</p>
    <p class="climate-interval-info__value">{{ temperatureLabel }}</p>
    <p class="climate-interval-info__context">{{ contextLabel }}</p>
    <p class="climate-interval-info__progress">
      {{
        t("story.acts.act5.climateInfo.periodProgress", {
          current: stepIndex + 1,
          total: totalSteps,
        })
      }}
    </p>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  formatClimateTemperature,
  type ClimateMovementFlowStep,
} from "~/utils/movement/acts/climate/climateSeasonData";

const props = defineProps<{
  step: ClimateMovementFlowStep;
  stepIndex: number;
  totalSteps: number;
}>();

const { t } = useI18n();

const temperatureLabel = computed(() =>
  formatClimateTemperature({
    value: props.step.displayValue,
    type: props.step.displayValueType,
    unit: props.step.displayUnit,
  }),
);
const contextLabel = computed(() =>
  props.step.isBaseline
    ? t("story.acts.act5.climateInfo.referencePeriod")
    : t("story.acts.act5.climateInfo.vsBaseline"),
);
</script>

<style scoped>
.climate-interval-info {
  width: var(--climate-act-clock-size);
  max-width: min(
    100%,
    calc(100dvh - var(--climate-act-bottom-bar-height) - 260px)
  );
  display: grid;
  justify-items: center;
  gap: clamp(8px, 1.2dvh, 14px);
  padding: clamp(16px, 2.2vw, 28px);
  text-align: center;
  color: #17241c;
}

.climate-interval-info__eyebrow,
.climate-interval-info__context,
.climate-interval-info__progress {
  margin: 0;
  color: rgba(31, 49, 39, 0.6);
  font-size: clamp(0.76rem, 0.95vw, 1rem);
  font-weight: 800;
  text-transform: uppercase;
}

.climate-interval-info__interval,
.climate-interval-info__value {
  margin: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  line-height: 0.96;
}

.climate-interval-info__interval {
  font-size: clamp(2.2rem, 4.5vw, 4.7rem);
  font-weight: 850;
}

.climate-interval-info__value {
  color: black;
  font-size: clamp(2.4rem, 5vw, 5.5rem);
  font-weight: 850;
}
</style>
