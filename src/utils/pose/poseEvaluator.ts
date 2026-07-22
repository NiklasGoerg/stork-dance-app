import type {
  PoseConditionDefinition,
  PoseConditionResult,
  PoseDefinition,
  PoseEvaluationResult,
  PoseFeatures,
  StablePoseResult,
  StablePoseState,
} from "~/types/pose";

export const POSE_EVALUATION_INTERVAL_MS = 80;
const stableGraceMs = 100;

const getFeatureValue = (
  features: PoseFeatures,
  condition: PoseConditionDefinition,
) => features[condition.feature];

// Evaluates one rule from a pose definition against the current feature set.
export const evaluatePoseCondition = (
  condition: PoseConditionDefinition,
  features: PoseFeatures,
): PoseConditionResult => {
  const value = getFeatureValue(features, condition);
  const evaluable = value !== null && Number.isFinite(value);
  let matched = false;

  if (evaluable) {
    if (condition.operator === "lessThanOrEqual") {
      matched = typeof condition.value === "number" && value <= condition.value;
    }

    if (condition.operator === "greaterThanOrEqual") {
      matched = typeof condition.value === "number" && value >= condition.value;
    }

    if (condition.operator === "between") {
      matched =
        typeof condition.min === "number" &&
        typeof condition.max === "number" &&
        value >= condition.min &&
        value <= condition.max;
    }
  }

  return {
    id: condition.id,
    feature: condition.feature,
    value,
    matched,
    evaluable,
    weight: condition.weight,
    required: condition.required,
    threshold: {
      operator: condition.operator,
      value: condition.value,
      min: condition.min,
      max: condition.max,
    },
  };
};

// Combines weighted rules, required rules, and minimum match counts into one pose score.
export const evaluatePose = (
  definition: PoseDefinition,
  features: PoseFeatures,
  timestamp: number,
): PoseEvaluationResult => {
  const conditionResults = definition.conditions.map((condition) =>
    evaluatePoseCondition(condition, features),
  );
  const evaluableConditionResults = conditionResults.filter(
    (result) => result.evaluable,
  );
  const matchedConditionResults = evaluableConditionResults.filter(
    (result) => result.matched,
  );
  const totalEvaluableWeight = evaluableConditionResults.reduce(
    (sum, result) => sum + result.weight,
    0,
  );
  const matchedWeight = matchedConditionResults.reduce(
    (sum, result) => sum + result.weight,
    0,
  );
  const requiredConditionsMatched = conditionResults
    .filter((result) => result.required)
    .every((result) => result.evaluable && result.matched);
  const score =
    totalEvaluableWeight > 0 ? matchedWeight / totalEvaluableWeight : 0;
  const matched =
    requiredConditionsMatched &&
    matchedConditionResults.length >= definition.minimumMatchedConditions &&
    score >= definition.minimumScore;

  return {
    poseId: definition.id,
    matched,
    score,
    matchedConditionCount: matchedConditionResults.length,
    evaluableConditionCount: evaluableConditionResults.length,
    requiredConditionsMatched,
    timestamp,
    conditionResults,
  };
};

export const createStablePoseState = (
  poseId: PoseDefinition["id"],
): StablePoseState => ({
  poseId,
  matchedSince: null,
  lastMatchedAt: null,
  stableDurationMs: 0,
  stableMatched: false,
});

// Adds short temporal smoothing so one jittery frame does not break a recognized pose.
export const updateStablePoseMatch = (
  evaluation: PoseEvaluationResult,
  previousState: StablePoseState,
  stabilityMs: number,
): StablePoseResult => {
  const now = evaluation.timestamp;

  if (evaluation.matched) {
    const matchedSince = previousState.matchedSince ?? now;
    const stableDurationMs = now - matchedSince;

    return {
      ...previousState,
      matchedSince,
      lastMatchedAt: now,
      stableDurationMs,
      stableMatched: stableDurationMs >= stabilityMs,
      evaluation,
    };
  }

  if (
    previousState.lastMatchedAt !== null &&
    now - previousState.lastMatchedAt <= stableGraceMs
  ) {
    const matchedSince =
      previousState.matchedSince ?? previousState.lastMatchedAt;
    const stableDurationMs = now - matchedSince;

    return {
      ...previousState,
      matchedSince,
      stableDurationMs,
      stableMatched: stableDurationMs >= stabilityMs,
      evaluation,
    };
  }

  return {
    ...createStablePoseState(evaluation.poseId),
    evaluation,
  };
};
