export type StoryPoseId = "crouch" | "departure-extended" | "arrival-open";

export type PoseFeatureName =
  | "bodySpanRatio"
  | "hipHeightRatio"
  | "averageKneeAngle"
  | "averageElbowAngle"
  | "wristSpanInShoulderWidths"
  | "wristsAtOrAboveShoulders"
  | "wristsAboveHead";

export type PoseConditionOperator =
  | "lessThanOrEqual"
  | "greaterThanOrEqual"
  | "between";

export type PoseConditionDefinition = {
  id: string;
  feature: PoseFeatureName;
  operator: PoseConditionOperator;
  value?: number;
  min?: number;
  max?: number;
  weight: number;
  required: boolean;
};

export type PoseDefinition = {
  id: StoryPoseId;
  label: string;
  minimumScore: number;
  minimumMatchedConditions: number;
  stabilityMs: number;
  conditions: PoseConditionDefinition[];
};

export type PoseFeatures = Record<PoseFeatureName, number | null>;

export type PoseConditionResult = {
  id: string;
  feature: PoseFeatureName;
  value: number | null;
  matched: boolean;
  evaluable: boolean;
  weight: number;
  required: boolean;
  threshold: {
    operator: PoseConditionOperator;
    value?: number;
    min?: number;
    max?: number;
  };
};

export type PoseEvaluationResult = {
  poseId: StoryPoseId;
  matched: boolean;
  score: number;
  matchedConditionCount: number;
  evaluableConditionCount: number;
  requiredConditionsMatched: boolean;
  timestamp: number;
  conditionResults: PoseConditionResult[];
};

export type StablePoseState = {
  poseId: StoryPoseId;
  matchedSince: number | null;
  lastMatchedAt: number | null;
  stableDurationMs: number;
  stableMatched: boolean;
};

export type StablePoseResult = StablePoseState & {
  evaluation: PoseEvaluationResult;
};

export type PoseCalibrationState = {
  neutralBodySpan: number | null;
  neutralHipHeight: number | null;
  sampleCount: number;
  calibrated: boolean;
};

export type PoseLandmarkLike = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
};
