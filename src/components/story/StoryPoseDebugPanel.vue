<template>
  <section class="pose-debug-panel" aria-label="Pose recognition debug">
    <header class="pose-debug-panel__header">
      <div>
        <span>Pose Debug</span>
        <strong>{{ calibration.calibrated ? "Ready" : "Not ready" }}</strong>
      </div>

      <label class="pose-debug-panel__target">
        <span>Target</span>
        <select :value="targetPoseId" @change="handleTargetChange">
          <option
            v-for="definition in definitions"
            :key="definition.id"
            :value="definition.id"
          >
            {{ definition.label }}
          </option>
        </select>
      </label>
    </header>

    <dl class="pose-debug-panel__calibration">
      <div>
        <dt>Neutral body span</dt>
        <dd>{{ formatValue(calibration.neutralBodySpan) }}</dd>
      </div>
      <div>
        <dt>Neutral hip height</dt>
        <dd>{{ formatValue(calibration.neutralHipHeight) }}</dd>
      </div>
      <div>
        <dt>Samples</dt>
        <dd>{{ calibration.sampleCount }}</dd>
      </div>
    </dl>

    <section class="pose-debug-panel__features" aria-label="Current features">
      <h2>Current features</h2>
      <dl>
        <div v-for="feature in featureRows" :key="feature.name">
          <dt>{{ feature.label }}</dt>
          <dd>{{ formatValue(features[feature.name]) }}</dd>
        </div>
      </dl>
    </section>

    <section class="pose-debug-panel__poses" aria-label="Pose evaluations">
      <article
        v-for="definition in definitions"
        :key="definition.id"
        class="pose-debug-panel__pose"
        :class="{
          'pose-debug-panel__pose--target': definition.id === targetPoseId,
          'pose-debug-panel__pose--stable':
            stableResults[definition.id]?.stableMatched,
        }"
      >
        <header>
          <strong>{{ definition.label }}</strong>
          <span>
            {{ stableResults[definition.id]?.stableMatched ? "Stable" : "Raw" }}
          </span>
        </header>

        <dl class="pose-debug-panel__score">
          <div>
            <dt>Raw score</dt>
            <dd>{{ formatScore(evaluations[definition.id]?.score) }}</dd>
          </div>
          <div>
            <dt>Raw matched</dt>
            <dd>{{ formatBoolean(evaluations[definition.id]?.matched) }}</dd>
          </div>
          <div>
            <dt>Stable matched</dt>
            <dd>
              {{ formatBoolean(stableResults[definition.id]?.stableMatched) }}
            </dd>
          </div>
          <div>
            <dt>Stable duration</dt>
            <dd>
              {{
                Math.round(stableResults[definition.id]?.stableDurationMs ?? 0)
              }}
              ms
            </dd>
          </div>
        </dl>

        <ul class="pose-debug-panel__conditions">
          <li
            v-for="condition in evaluations[definition.id]?.conditionResults ??
            []"
            :key="condition.id"
          >
            <span
              class="pose-debug-panel__condition-state"
              :class="{
                'pose-debug-panel__condition-state--matched': condition.matched,
              }"
            >
              {{ condition.matched ? "OK" : "NO" }}
            </span>
            <span>{{ condition.id }}</span>
            <small>{{ formatCondition(condition) }}</small>
          </li>
        </ul>
      </article>
    </section>
  </section>
</template>

<script setup lang="ts">
import type {
  PoseCalibrationState,
  PoseConditionResult,
  PoseDefinition,
  PoseEvaluationResult,
  PoseFeatureName,
  PoseFeatures,
  StablePoseResult,
  StoryPoseId,
} from "~/types/pose";

defineProps<{
  definitions: PoseDefinition[];
  features: PoseFeatures;
  evaluations: Record<StoryPoseId, PoseEvaluationResult>;
  stableResults: Record<StoryPoseId, StablePoseResult | null>;
  calibration: PoseCalibrationState;
  targetPoseId: StoryPoseId;
}>();

const emit = defineEmits<{
  "update:targetPoseId": [poseId: StoryPoseId];
}>();

const featureRows: Array<{
  name: PoseFeatureName;
  label: string;
}> = [
  { name: "bodySpanRatio", label: "Body span ratio" },
  { name: "hipHeightRatio", label: "Hip height ratio" },
  { name: "averageKneeAngle", label: "Average knee angle" },
  { name: "averageElbowAngle", label: "Average elbow angle" },
  {
    name: "wristSpanInShoulderWidths",
    label: "Wrist span in shoulder widths",
  },
  { name: "wristsAtOrAboveShoulders", label: "Wrists at/above shoulders" },
  { name: "wristsAboveHead", label: "Wrists above head" },
];

const handleTargetChange = (event: Event) => {
  const target = event.target as HTMLSelectElement | null;

  if (!target) return;

  emit("update:targetPoseId", target.value as StoryPoseId);
};

const formatValue = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }

  return value >= 10 ? value.toFixed(0) : value.toFixed(2);
};

const formatScore = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }

  return value.toFixed(2);
};

const formatBoolean = (value: boolean | null | undefined) =>
  value ? "true" : "false";

const formatOperator = (condition: PoseConditionResult) => {
  if (condition.threshold.operator === "lessThanOrEqual") return "<=";
  if (condition.threshold.operator === "greaterThanOrEqual") return ">=";

  return "between";
};

const formatCondition = (condition: PoseConditionResult) => {
  const value = formatValue(condition.value);

  if (condition.threshold.operator === "between") {
    return `${value} between ${formatValue(condition.threshold.min)} and ${formatValue(
      condition.threshold.max,
    )}`;
  }

  return `${value} ${formatOperator(condition)} ${formatValue(
    condition.threshold.value,
  )}`;
};
</script>

<style scoped>
.pose-debug-panel {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 9;
  display: grid;
  width: min(520px, calc(60% - 24px));
  max-height: calc(100dvh - 24px);
  gap: 8px;
  overflow: auto;
  padding: 10px;
  border: 1px solid rgba(31, 49, 39, 0.16);
  border-radius: 8px;
  background: rgba(248, 251, 247, 0.88);
  color: #26382f;
  box-shadow: 0 12px 30px rgba(32, 50, 40, 0.16);
  backdrop-filter: blur(10px);
  font-size: 0.72rem;
}

.pose-debug-panel__header,
.pose-debug-panel__target {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pose-debug-panel__header span,
.pose-debug-panel__target span,
.pose-debug-panel dt {
  color: rgba(31, 49, 39, 0.58);
  font-size: 0.58rem;
  font-weight: 800;
  text-transform: uppercase;
}

.pose-debug-panel__header strong {
  display: block;
  margin-top: 1px;
  font-size: 0.92rem;
}

.pose-debug-panel__target select {
  max-width: 180px;
  min-height: 30px;
  border: 1px solid rgba(31, 49, 39, 0.16);
  border-radius: 6px;
  background: #ffffff;
  color: #26382f;
  font: inherit;
  font-weight: 750;
}

.pose-debug-panel__calibration,
.pose-debug-panel__features dl,
.pose-debug-panel__score {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
}

.pose-debug-panel__features h2 {
  margin: 0 0 5px;
  font-size: 0.72rem;
}

.pose-debug-panel dd {
  margin: 1px 0 0;
  overflow: hidden;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pose-debug-panel__poses {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.pose-debug-panel__pose {
  min-width: 0;
  padding: 8px;
  border: 1px solid rgba(31, 49, 39, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.58);
}

.pose-debug-panel__pose--target {
  border-color: rgba(38, 56, 47, 0.42);
}

.pose-debug-panel__pose--stable {
  background: rgba(216, 244, 224, 0.78);
}

.pose-debug-panel__pose header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}

.pose-debug-panel__pose header strong {
  overflow: hidden;
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pose-debug-panel__pose header span {
  color: rgba(31, 49, 39, 0.58);
  font-size: 0.62rem;
  font-weight: 800;
}

.pose-debug-panel__score {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.pose-debug-panel__conditions {
  display: grid;
  gap: 5px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.pose-debug-panel__conditions li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 3px 5px;
  min-width: 0;
}

.pose-debug-panel__condition-state {
  grid-row: span 2;
  min-width: 24px;
  color: #8d2a23;
  font-size: 0.58rem;
  font-weight: 900;
}

.pose-debug-panel__condition-state--matched {
  color: #24763a;
}

.pose-debug-panel__conditions span:not(.pose-debug-panel__condition-state),
.pose-debug-panel__conditions small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pose-debug-panel__conditions span:not(.pose-debug-panel__condition-state) {
  font-weight: 800;
}

.pose-debug-panel__conditions small {
  color: rgba(31, 49, 39, 0.64);
  font-size: 0.62rem;
  font-weight: 700;
}
</style>
