import {
  computed,
  readonly,
  ref,
  unref,
  watch,
  type MaybeRef,
  type Ref,
} from "vue";
import type {
  PoseCalibrationState,
  PoseDefinition,
  PoseEvaluationResult,
  PoseFeatures,
  PoseLandmarkLike,
  StablePoseResult,
  StablePoseState,
  StoryPoseId,
} from "~/types/pose";
import {
  POSE_EVALUATION_INTERVAL_MS,
  createStablePoseState,
  evaluatePose,
  updateStablePoseMatch,
} from "~/utils/pose/poseEvaluator";
import {
  createEmptyPoseFeatures,
  extractBodyCalibrationMeasurements,
  extractPoseFeatures,
  isLikelyNeutralStandingPose,
} from "~/utils/pose/poseFeatures";
import { poseDefinitions } from "~/utils/pose/poseDefinitionRegistry";

type PoseComparisonOptions = {
  landmarks: Ref<PoseLandmarkLike[] | null>;
  freezeCalibration?: MaybeRef<boolean>;
  definitions?: PoseDefinition[];
};

const maxCalibrationSamples = 16;
const minCalibrationSamples = 8;

const createInitialCalibration = (): PoseCalibrationState => ({
  neutralBodySpan: null,
  neutralHipHeight: null,
  sampleCount: 0,
  calibrated: false,
});

const median = (values: number[]) => {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  const upperMiddle = sorted[midpoint];

  if (upperMiddle === undefined) return null;

  if (sorted.length % 2 === 1) return upperMiddle;

  const lowerMiddle = sorted[midpoint - 1];

  return lowerMiddle === undefined
    ? upperMiddle
    : (lowerMiddle + upperMiddle) / 2;
};

const createEvaluationRecord = (
  definitions: PoseDefinition[],
  timestamp: number,
) =>
  definitions.reduce(
    (record, definition) => ({
      ...record,
      [definition.id]: evaluatePose(
        definition,
        createEmptyPoseFeatures(),
        timestamp,
      ),
    }),
    {} as Record<StoryPoseId, PoseEvaluationResult>,
  );

const createStableStateRecord = (definitions: PoseDefinition[]) =>
  definitions.reduce(
    (record, definition) => ({
      ...record,
      [definition.id]: createStablePoseState(definition.id),
    }),
    {} as Record<StoryPoseId, StablePoseState>,
  );

export const usePoseComparison = ({
  landmarks,
  freezeCalibration = false,
  definitions = poseDefinitions,
}: PoseComparisonOptions) => {
  const currentFeatures = ref<PoseFeatures>(createEmptyPoseFeatures());
  const currentEvaluations = ref<Record<StoryPoseId, PoseEvaluationResult>>(
    createEvaluationRecord(definitions, 0),
  );
  const stableResults = ref<Record<StoryPoseId, StablePoseResult | null>>(
    definitions.reduce(
      (record, definition) => ({
        ...record,
        [definition.id]: null,
      }),
      {} as Record<StoryPoseId, StablePoseResult | null>,
    ),
  );
  const calibration = ref<PoseCalibrationState>(createInitialCalibration());
  const targetPoseId = ref<StoryPoseId>("crouch");
  const calibrationSamples = ref<
    Array<{
      bodySpan: number;
      hipHeight: number;
    }>
  >([]);

  let lastEvaluatedAt = 0;
  let stableStates = createStableStateRecord(definitions);

  const stableMatches = computed(() =>
    definitions.reduce(
      (record, definition) => ({
        ...record,
        [definition.id]:
          stableResults.value[definition.id]?.stableMatched ?? false,
      }),
      {} as Record<StoryPoseId, boolean>,
    ),
  );

  // Learns the user's neutral standing height from recent high-confidence frames.
  const updateCalibration = (nextLandmarks: PoseLandmarkLike[]) => {
    if (
      unref(freezeCalibration) ||
      !isLikelyNeutralStandingPose(nextLandmarks)
    ) {
      return;
    }

    const measurements = extractBodyCalibrationMeasurements(nextLandmarks);

    if (measurements.bodySpan === null || measurements.hipHeight === null) {
      return;
    }

    calibrationSamples.value = [
      ...calibrationSamples.value,
      {
        bodySpan: measurements.bodySpan,
        hipHeight: measurements.hipHeight,
      },
    ].slice(-maxCalibrationSamples);

    const neutralBodySpan = median(
      calibrationSamples.value.map((sample) => sample.bodySpan),
    );
    const neutralHipHeight = median(
      calibrationSamples.value.map((sample) => sample.hipHeight),
    );

    calibration.value = {
      neutralBodySpan,
      neutralHipHeight,
      sampleCount: calibrationSamples.value.length,
      calibrated:
        calibrationSamples.value.length >= minCalibrationSamples &&
        neutralBodySpan !== null &&
        neutralHipHeight !== null,
    };
  };

  // Converts the latest MediaPipe landmarks into features, raw pose scores, and stable matches.
  const evaluateCurrentLandmarks = (timestamp = performance.now()) => {
    if (timestamp - lastEvaluatedAt < POSE_EVALUATION_INTERVAL_MS) return;

    lastEvaluatedAt = timestamp;

    const nextLandmarks = landmarks.value;

    if (nextLandmarks?.length) {
      updateCalibration(nextLandmarks);
    }

    currentFeatures.value = extractPoseFeatures(
      nextLandmarks,
      calibration.value,
    );

    const nextEvaluations = definitions.reduce(
      (record, definition) => {
        const evaluation = evaluatePose(
          definition,
          currentFeatures.value,
          timestamp,
        );
        const stableResult = updateStablePoseMatch(
          evaluation,
          stableStates[definition.id] ?? createStablePoseState(definition.id),
          definition.stabilityMs,
        );

        stableStates = {
          ...stableStates,
          [definition.id]: stableResult,
        };

        stableResults.value = {
          ...stableResults.value,
          [definition.id]: stableResult,
        };

        return {
          ...record,
          [definition.id]: evaluation,
        };
      },
      {} as Record<StoryPoseId, PoseEvaluationResult>,
    );

    currentEvaluations.value = nextEvaluations;
  };

  // Clears temporal pose memory between gesture attempts so old matches cannot carry over.
  const resetStability = () => {
    stableStates = createStableStateRecord(definitions);
    stableResults.value = definitions.reduce(
      (record, definition) => ({
        ...record,
        [definition.id]: null,
      }),
      {} as Record<StoryPoseId, StablePoseResult | null>,
    );
  };

  watch(
    landmarks,
    () => {
      evaluateCurrentLandmarks();
    },
    { immediate: true },
  );

  return {
    targetPoseId,
    currentFeatures: readonly(currentFeatures),
    currentEvaluations: readonly(currentEvaluations),
    stableMatches,
    stableResults: readonly(stableResults),
    calibration: readonly(calibration),
    evaluateCurrentLandmarks,
    resetStability,
  };
};
