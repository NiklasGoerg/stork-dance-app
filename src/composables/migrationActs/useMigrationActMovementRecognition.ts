import { ref } from "vue";
import { useSkeletonVisualFeedback } from "~/composables/useSkeletonVisualFeedback";
import type {
  MigrationMovementEvaluationStatus,
  MigrationMovementRecognitionProfile,
  MigrationMovementWingState,
} from "~/types/migrationAct";
import type { PoseLandmarkLike } from "~/types/pose";
import { POSE_LANDMARK } from "~/utils/pose/poseLandmarks";
import {
  calculateHipCenter,
  calculateLateralLean,
  calculateStanceWidth,
  calculateTorsoScale,
  getMigrationMovementVisiblePoint,
} from "~/utils/migrationActs/migrationMovementMetrics";
import {
  calculateWingState,
  evaluateMigrationMovementWindow,
  type MigrationMovementRecognitionSample,
} from "~/utils/migrationActs/migrationMovementCriteria";
import {
  MIGRATION_RECOGNITION_THRESHOLDS,
  migrationMovementRecognitionConfig,
} from "~/utils/migrationActs/migrationMovementConfig";

type TrendSample = {
  timestampMs: number;
  hipCenterX: number | null;
  torsoScale: number | null;
  lean: number | null;
};

const getMedian = (values: Array<number | null>) => {
  const valid = values
    .filter((value): value is number => value !== null)
    .sort((first, second) => first - second);

  if (!valid.length) return null;

  const middle = Math.floor(valid.length / 2);
  const upper = valid[middle];
  const lower = valid[Math.max(0, middle - 1)];

  if (upper === undefined || lower === undefined) return null;

  return valid.length % 2 === 0 ? (lower + upper) / 2 : upper;
};

export const useMigrationActMovementRecognition = () => {
  const recognitionProfile = ref<MigrationMovementRecognitionProfile | null>(
    null,
  );
  const recognitionActive = ref(false);
  const lastEvaluationStatus = ref<MigrationMovementEvaluationStatus>("idle");
  const wingState = ref<MigrationMovementWingState>("not_evaluable");
  const wingBeatDetected = ref(false);
  const stepActivityDetected = ref(false);
  const stanceWidthChangeDetected = ref(false);
  const verticalBounceDetected = ref(false);
  const hipCenterX = ref<number | null>(null);
  const torsoScale = ref<number | null>(null);
  const directionTrend = ref<number | null>(null);
  const depthTrend = ref<number | null>(null);
  const lean = ref<number | null>(null);
  const lastPulseAt = ref<number | null>(null);
  const lastSuccessfulEvaluationId = ref<string | null>(null);
  const validPoseSampleCount = ref(0);
  const currentBeatWindow = ref("none");
  const {
    skeletonFeedbackState,
    pulseProgress,
    triggerBeatSuccess,
    resetSkeletonFeedback,
  } = useSkeletonVisualFeedback();

  let windowSamples: MigrationMovementRecognitionSample[] = [];
  let trendSamples: TrendSample[] = [];
  let currentBarIndex: number | null = null;
  let currentBarEvaluable = false;
  let lastSampleAtMs = Number.NEGATIVE_INFINITY;
  let lastDebugUpdateAtMs = Number.NEGATIVE_INFINITY;
  let baselineCaptureStartedAtMs: number | null = null;
  let baselineHipCenterX: number | null = null;
  let baselineTorsoScale: number | null = null;
  let recognitionSessionId = 0;
  let transportOriginMs = 0;
  let recognitionPrerollMs = 0;

  const clearSamplesAndBaselines = () => {
    windowSamples = [];
    trendSamples = [];
    currentBarIndex = null;
    currentBarEvaluable = false;
    lastSampleAtMs = Number.NEGATIVE_INFINITY;
    lastDebugUpdateAtMs = Number.NEGATIVE_INFINITY;
    baselineCaptureStartedAtMs = null;
    baselineHipCenterX = null;
    baselineTorsoScale = null;
    transportOriginMs = 0;
    recognitionPrerollMs = 0;
    validPoseSampleCount.value = 0;
    currentBeatWindow.value = "none";
    hipCenterX.value = null;
    torsoScale.value = null;
    directionTrend.value = null;
    depthTrend.value = null;
    lean.value = null;
    wingState.value = "not_evaluable";
  };

  const clearEvaluation = () => {
    lastEvaluationStatus.value = "idle";
    wingBeatDetected.value = false;
    stepActivityDetected.value = false;
    stanceWidthChangeDetected.value = false;
    verticalBounceDetected.value = false;
    lastPulseAt.value = null;
    lastSuccessfulEvaluationId.value = null;
  };

  const prepare = (profile: MigrationMovementRecognitionProfile | null) => {
    recognitionSessionId++;
    recognitionProfile.value = profile;
    recognitionActive.value = false;
    clearSamplesAndBaselines();
    clearEvaluation();
    resetSkeletonFeedback();
  };

  const start = (
    profile: MigrationMovementRecognitionProfile,
    {
      transportTimeMs = 0,
      movementElapsedMs = 0,
      prerollMs = 0,
    }: {
      transportTimeMs?: number;
      movementElapsedMs?: number;
      prerollMs?: number;
    } = {},
  ) => {
    prepare(profile);
    transportOriginMs = transportTimeMs - Math.max(movementElapsedMs, 0);
    recognitionPrerollMs = Math.max(prerollMs, 0);
    recognitionActive.value =
      migrationMovementRecognitionConfig[profile].enabled;
  };

  const pause = () => {
    recognitionSessionId++;
    recognitionActive.value = false;
    clearSamplesAndBaselines();
    clearEvaluation();
    resetSkeletonFeedback();
  };

  const reset = () => prepare(null);

  const updateTrends = (
    sample: MigrationMovementRecognitionSample,
    timestampMs: number,
  ) => {
    trendSamples.push({
      timestampMs,
      hipCenterX: sample.hipCenter?.x ?? null,
      torsoScale: sample.torsoScale,
      lean: sample.lean,
    });
    trendSamples = trendSamples.filter(
      (trendSample) =>
        timestampMs - trendSample.timestampMs <=
        MIGRATION_RECOGNITION_THRESHOLDS.smoothingWindowMs,
    );

    const smoothedHipCenterX = getMedian(
      trendSamples.map((trendSample) => trendSample.hipCenterX),
    );
    const smoothedTorsoScale = getMedian(
      trendSamples.map((trendSample) => trendSample.torsoScale),
    );
    const smoothedLean = getMedian(
      trendSamples.map((trendSample) => trendSample.lean),
    );

    baselineCaptureStartedAtMs ??= timestampMs;
    if (
      timestampMs - baselineCaptureStartedAtMs <=
      MIGRATION_RECOGNITION_THRESHOLDS.smoothingWindowMs
    ) {
      baselineHipCenterX = smoothedHipCenterX ?? baselineHipCenterX;
      baselineTorsoScale = smoothedTorsoScale ?? baselineTorsoScale;
    }

    if (
      timestampMs - lastDebugUpdateAtMs <
      MIGRATION_RECOGNITION_THRESHOLDS.debugUpdateIntervalMs
    ) {
      return;
    }

    lastDebugUpdateAtMs = timestampMs;
    hipCenterX.value = smoothedHipCenterX;
    torsoScale.value = smoothedTorsoScale;
    lean.value = smoothedLean;
    directionTrend.value =
      smoothedHipCenterX !== null &&
      baselineHipCenterX !== null &&
      baselineTorsoScale !== null
        ? (smoothedHipCenterX - baselineHipCenterX) / baselineTorsoScale
        : null;
    depthTrend.value =
      smoothedTorsoScale !== null && baselineTorsoScale !== null
        ? (smoothedTorsoScale - baselineTorsoScale) / baselineTorsoScale
        : null;
  };

  const evaluateCompletedBar = (barIndex: number) => {
    const profile = recognitionProfile.value;

    if (!profile || !currentBarEvaluable || !windowSamples.length) return;

    const evaluation = evaluateMigrationMovementWindow(profile, windowSamples);

    lastEvaluationStatus.value = evaluation.status;
    wingBeatDetected.value = evaluation.wingBeat === "success";
    stepActivityDetected.value = evaluation.stepActivity === "success";
    stanceWidthChangeDetected.value =
      evaluation.stanceWidthChange === "success";
    verticalBounceDetected.value = evaluation.verticalBounce === "success";

    if (evaluation.status !== "success") return;

    const pulseAt = performance.now();
    const config = migrationMovementRecognitionConfig[profile];

    const evaluationId = `migration-${recognitionSessionId}-${profile}-${barIndex}`;

    lastPulseAt.value = pulseAt;
    lastSuccessfulEvaluationId.value = evaluationId;
    triggerBeatSuccess({
      evaluationId,
      flowId: "migration-act",
      flowStepId: profile,
      measureIndex: barIndex,
      beatIndex: MIGRATION_RECOGNITION_THRESHOLDS.beatsPerBar,
      result: "passed",
      pulseDurationMs: config.pulseDurationMs,
    });
  };

  const handlePoseFrame = ({
    landmarks,
    transportTimeMs,
    timestampMs = performance.now(),
  }: {
    landmarks: PoseLandmarkLike[] | null;
    transportTimeMs: number;
    timestampMs?: number;
  }) => {
    if (!recognitionActive.value || !recognitionProfile.value) return;
    if (
      timestampMs - lastSampleAtMs <
      MIGRATION_RECOGNITION_THRESHOLDS.sampleIntervalMs
    ) {
      return;
    }

    lastSampleAtMs = timestampMs;

    const movementTransportMs = Math.max(
      0,
      transportTimeMs - transportOriginMs,
    );
    const recognitionTransportMs = movementTransportMs - recognitionPrerollMs;

    if (recognitionTransportMs < 0) {
      currentBeatWindow.value = "preroll";
      return;
    }

    const normalizedTransportMs = recognitionTransportMs;
    const barIndex = Math.floor(
      normalizedTransportMs / MIGRATION_RECOGNITION_THRESHOLDS.barDurationMs,
    );
    const barElapsedMs =
      normalizedTransportMs % MIGRATION_RECOGNITION_THRESHOLDS.barDurationMs;

    if (currentBarIndex === null) {
      currentBarIndex = barIndex;
      currentBarEvaluable =
        barElapsedMs <=
        MIGRATION_RECOGNITION_THRESHOLDS.initialBarCaptureWindowMs;
    } else if (barIndex !== currentBarIndex) {
      evaluateCompletedBar(currentBarIndex);
      windowSamples = [];
      currentBarIndex = barIndex;
      currentBarEvaluable =
        barElapsedMs <=
        MIGRATION_RECOGNITION_THRESHOLDS.initialBarCaptureWindowMs;
    }

    const hipCenter = calculateHipCenter(landmarks);
    const sample: MigrationMovementRecognitionSample = {
      timestampMs,
      barElapsedMs,
      hipCenter,
      torsoScale: calculateTorsoScale(landmarks),
      stanceWidth: calculateStanceWidth(landmarks),
      lean: calculateLateralLean(landmarks),
      leftAnkle: getMigrationMovementVisiblePoint(
        landmarks,
        POSE_LANDMARK.LEFT_ANKLE,
      ),
      rightAnkle: getMigrationMovementVisiblePoint(
        landmarks,
        POSE_LANDMARK.RIGHT_ANKLE,
      ),
      wingState: calculateWingState(landmarks),
    };

    windowSamples.push(sample);
    windowSamples = windowSamples.slice(
      -MIGRATION_RECOGNITION_THRESHOLDS.maximumWindowSamples,
    );
    validPoseSampleCount.value = windowSamples.filter(
      (windowSample) => windowSample.torsoScale !== null,
    ).length;
    wingState.value = sample.wingState;
    currentBeatWindow.value = `${barIndex}:${Math.min(
      Math.floor(
        barElapsedMs / MIGRATION_RECOGNITION_THRESHOLDS.beatDurationMs,
      ) + 1,
      MIGRATION_RECOGNITION_THRESHOLDS.beatsPerBar,
    )}`;
    updateTrends(sample, timestampMs);
  };

  const cleanup = () => reset();

  return {
    recognitionProfile,
    recognitionActive,
    lastEvaluationStatus,
    wingState,
    wingBeatDetected,
    stepActivityDetected,
    stanceWidthChangeDetected,
    verticalBounceDetected,
    hipCenterX,
    torsoScale,
    directionTrend,
    depthTrend,
    lean,
    lastPulseAt,
    lastSuccessfulEvaluationId,
    validPoseSampleCount,
    currentBeatWindow,
    skeletonFeedbackState,
    pulseProgress,
    prepare,
    start,
    pause,
    reset,
    handlePoseFrame,
    cleanup,
  };
};
