import arrivalOpenDefinition from "~/assets/pose-definitions/migration/arrival-open.json";
import crouchDefinition from "~/assets/pose-definitions/migration/crouch.json";
import departureExtendedDefinition from "~/assets/pose-definitions/migration/departure-extended.json";
import type {
  PoseConditionDefinition,
  PoseConditionOperator,
  PoseDefinition,
  PoseFeatureName,
  StoryPoseId,
} from "~/types/pose";

const poseFeatureNames: PoseFeatureName[] = [
  "bodySpanRatio",
  "hipHeightRatio",
  "averageKneeAngle",
  "averageElbowAngle",
  "wristSpanInShoulderWidths",
  "wristsAtOrAboveShoulders",
  "wristsAboveHead",
];

const poseConditionOperators: PoseConditionOperator[] = [
  "lessThanOrEqual",
  "greaterThanOrEqual",
  "between",
];

const storyPoseIds: StoryPoseId[] = [
  "crouch",
  "departure-extended",
  "arrival-open",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

const isString = (value: unknown): value is string => typeof value === "string";

// Validates one JSON condition before it reaches the live pose evaluator.
const readConditionDefinition = (
  value: unknown,
  definitionId: string,
): PoseConditionDefinition => {
  if (!isRecord(value)) {
    throw new Error(`Condition in "${definitionId}" is not an object.`);
  }

  const { id, feature, operator, weight, required, min, max } = value;
  const thresholdValue = value.value;

  if (!isString(id)) {
    throw new Error(`Condition in "${definitionId}" is missing a string id.`);
  }

  if (!poseFeatureNames.includes(feature as PoseFeatureName)) {
    throw new Error(
      `Condition "${id}" in "${definitionId}" uses unknown feature "${String(
        feature,
      )}".`,
    );
  }

  if (!poseConditionOperators.includes(operator as PoseConditionOperator)) {
    throw new Error(
      `Condition "${id}" in "${definitionId}" uses unknown operator "${String(
        operator,
      )}".`,
    );
  }

  if (!isNumber(weight) || weight <= 0) {
    throw new Error(
      `Condition "${id}" in "${definitionId}" requires a positive weight.`,
    );
  }

  if (!isBoolean(required)) {
    throw new Error(
      `Condition "${id}" in "${definitionId}" requires a boolean required flag.`,
    );
  }

  if (
    (operator === "lessThanOrEqual" || operator === "greaterThanOrEqual") &&
    !isNumber(thresholdValue)
  ) {
    throw new Error(
      `Condition "${id}" in "${definitionId}" requires numeric value.`,
    );
  }

  if (
    operator === "between" &&
    (!isNumber(min) || !isNumber(max) || min > max)
  ) {
    throw new Error(
      `Condition "${id}" in "${definitionId}" requires valid min and max.`,
    );
  }

  return {
    id,
    feature: feature as PoseFeatureName,
    operator: operator as PoseConditionOperator,
    value: isNumber(thresholdValue) ? thresholdValue : undefined,
    min: isNumber(min) ? min : undefined,
    max: isNumber(max) ? max : undefined,
    weight,
    required,
  };
};

// Keeps imported JSON definitions strict and developer errors actionable.
const readPoseDefinition = (value: unknown): PoseDefinition => {
  if (!isRecord(value)) {
    throw new Error("Pose definition is not an object.");
  }

  const {
    id,
    label,
    minimumScore,
    minimumMatchedConditions,
    stabilityMs,
    conditions,
  } = value;

  if (!storyPoseIds.includes(id as StoryPoseId)) {
    throw new Error(`Unknown pose id "${String(id)}".`);
  }

  if (!isString(label)) {
    throw new Error(`Pose "${String(id)}" requires a string label.`);
  }

  if (!isNumber(minimumScore) || minimumScore < 0 || minimumScore > 1) {
    throw new Error(`Pose "${String(id)}" requires minimumScore from 0 to 1.`);
  }

  if (!isNumber(minimumMatchedConditions) || minimumMatchedConditions < 0) {
    throw new Error(
      `Pose "${String(id)}" requires minimumMatchedConditions >= 0.`,
    );
  }

  if (!isNumber(stabilityMs) || stabilityMs < 0) {
    throw new Error(`Pose "${String(id)}" requires stabilityMs >= 0.`);
  }

  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new Error(`Pose "${String(id)}" requires at least one condition.`);
  }

  return {
    id: id as StoryPoseId,
    label,
    minimumScore,
    minimumMatchedConditions,
    stabilityMs,
    conditions: conditions.map((condition) =>
      readConditionDefinition(condition, String(id)),
    ),
  };
};

// Registers a pose definition with a clear dev-console prefix on schema errors.
const registerDefinition = (value: unknown) => {
  try {
    return readPoseDefinition(value);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown validation error.";

    console.error(`[PoseDefinition] ${message}`);
    throw error;
  }
};

export const poseDefinitions = [
  registerDefinition(crouchDefinition),
  registerDefinition(departureExtendedDefinition),
  registerDefinition(arrivalOpenDefinition),
];

export const poseDefinitionsById: Record<StoryPoseId, PoseDefinition> = {
  crouch: poseDefinitions.find((definition) => definition.id === "crouch")!,
  "departure-extended": poseDefinitions.find(
    (definition) => definition.id === "departure-extended",
  )!,
  "arrival-open": poseDefinitions.find(
    (definition) => definition.id === "arrival-open",
  )!,
};

export const getPoseDefinition = (id: StoryPoseId) => poseDefinitionsById[id];
