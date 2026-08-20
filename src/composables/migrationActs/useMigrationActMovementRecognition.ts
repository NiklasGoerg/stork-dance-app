import { computed, ref, shallowRef } from "vue";
import { useSkeletonVisualFeedback } from "~/composables/useSkeletonVisualFeedback";
import type {
  MigrationMovementEvaluationStatus,
  MigrationMovementBarEvaluation,
  MigrationMovementBeatEvaluation,
  MigrationMovementBeatIndex,
  MigrationMovementPhraseEvaluation,
  MigrationMovementPhraseIndex,
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
  evaluateMigrationMovementBeat,
  evaluateMigrationMovementWindow,
  type MigrationMovementBeatResult,
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
  const lastBarEvaluation = shallowRef<MigrationMovementBarEvaluation | null>(
    null,
  );
  const lastBeatEvaluation = shallowRef<MigrationMovementBeatEvaluation | null>(
    null,
  );
  const lastPhraseEvaluation =
    shallowRef<MigrationMovementPhraseEvaluation | null>(null);
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
  let currentBeatIndex: MigrationMovementBeatIndex | null = null;
  let currentBarEvaluable = false;
  const beatEvaluations = new Map<
    MigrationMovementBeatIndex,
    MigrationMovementBeatEvaluation
  >();
  let lastSampleAtMs = Number.NEGATIVE_INFINITY;
  let lastDebugUpdateAtMs = Number.NEGATIVE_INFINITY;
  let baselineCaptureStartedAtMs: number | null = null;
  let baselineHipCenterX: number | null = null;
  let baselineTorsoScale: number | null = null;
  let recognitionSessionId = 0;
  let transportOriginMs = 0;
  let recognitionPrerollMs = 0;
  let activeMovementId = "";

  const clearSamplesAndBaselines = () => {
    windowSamples = [];
    trendSamples = [];
    currentBarIndex = null;
    currentBeatIndex = null;
    currentBarEvaluable = false;
    beatEvaluations.clear();
    lastSampleAtMs = Number.NEGATIVE_INFINITY;
    lastDebugUpdateAtMs = Number.NEGATIVE_INFINITY;
    baselineCaptureStartedAtMs = null;
    baselineHipCenterX = null;
    baselineTorsoScale = null;
    transportOriginMs = 0;
    recognitionPrerollMs = 0;
    activeMovementId = "";
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
    lastBarEvaluation.value = null;
    lastBeatEvaluation.value = null;
    lastPhraseEvaluation.value = null;
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
      movementId = profile,
    }: {
      transportTimeMs?: number;
      movementElapsedMs?: number;
      prerollMs?: number;
      movementId?: string;
    } = {},
  ) => {
    prepare(profile);
    transportOriginMs = transportTimeMs - Math.max(movementElapsedMs, 0);
    recognitionPrerollMs = Math.max(prerollMs, 0);
    activeMovementId = movementId;
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

  const publishBeatEvaluation = (
    barIndex: number,
    beatIndex: MigrationMovementBeatIndex,
    result: MigrationMovementBeatResult,
  ) => {
    const profile = recognitionProfile.value;
    if (!profile) return;

    const evaluatedAtMs = performance.now();
    const evaluationId = `migration-${recognitionSessionId}-${profile}-${barIndex}-${beatIndex}`;
    const evaluation: MigrationMovementBeatEvaluation = {
      evaluationId,
      sessionId: recognitionSessionId,
      profile,
      movementId: activeMovementId || profile,
      barIndex,
      beatIndex,
      status: result.status,
      detectedSide: result.detectedSide,
      criteria: result.criteria,
      metrics: result.metrics,
      evaluatedAtMs,
    };

    beatEvaluations.set(beatIndex, evaluation);
    lastBeatEvaluation.value = evaluation;
    if (result.status !== "success") return;

    const config = migrationMovementRecognitionConfig[profile];
    lastPulseAt.value = evaluatedAtMs;
    lastSuccessfulEvaluationId.value = evaluationId;
    triggerBeatSuccess({
      evaluationId,
      flowId: "migration-act",
      flowStepId: profile,
      measureIndex: barIndex,
      beatIndex,
      result: "passed",
      pulseDurationMs: config.pulseDurationMs,
    });
  };

  const isReturnBeat = (beatIndex: MigrationMovementBeatIndex) =>
    beatIndex === 2 || beatIndex === 4;

  const getPhraseIndexForBeat = (
    beatIndex: MigrationMovementBeatIndex,
  ): MigrationMovementPhraseIndex => (beatIndex <= 2 ? 1 : 2);

  const publishPhraseEvaluation = (
    barIndex: number,
    phraseIndex: MigrationMovementPhraseIndex,
  ) => {
    const profile = recognitionProfile.value;
    if (!profile) return;

    const phraseBeats =
      phraseIndex === 1 ? ([1, 2] as const) : ([3, 4] as const);
    const beatResults = phraseBeats
      .map((beatIndex) => beatEvaluations.get(beatIndex))
      .filter((result): result is MigrationMovementBeatEvaluation =>
        Boolean(result),
      );
    const statuses = beatResults.map((result) => result.status);
    const status =
      beatResults.length < phraseBeats.length ||
      statuses.includes("not_evaluable")
        ? "not_evaluable"
        : statuses.every((beatStatus) => beatStatus === "success")
          ? "success"
          : "failed";

    lastPhraseEvaluation.value = {
      evaluationId: `migration-${recognitionSessionId}-${profile}-${barIndex}-phrase-${phraseIndex}`,
      sessionId: recognitionSessionId,
      profile,
      movementId: activeMovementId || profile,
      barIndex,
      phraseIndex,
      status,
      beatResults,
      evaluatedAtMs: performance.now(),
    };
  };

  const getBeatEndMs = (beatIndex: MigrationMovementBeatIndex) =>
    beatIndex * MIGRATION_RECOGNITION_THRESHOLDS.beatDurationMs +
    (isReturnBeat(beatIndex)
      ? MIGRATION_RECOGNITION_THRESHOLDS.migrationReturnWindowAfterMs
      : 0);

  const evaluateCurrentBeat = (
    barIndex: number,
    beatIndex: MigrationMovementBeatIndex,
    finalize: boolean,
  ) => {
    if (
      !recognitionProfile.value ||
      beatEvaluations.get(beatIndex)?.status === "success"
    ) {
      return;
    }

    const beatStartMs =
      (beatIndex - 1) * MIGRATION_RECOGNITION_THRESHOLDS.beatDurationMs;
    const beatEndMs = getBeatEndMs(beatIndex);
    const beatSamples = windowSamples.filter(
      (sample) =>
        sample.barElapsedMs >= beatStartMs && sample.barElapsedMs < beatEndMs,
    );
    const returnSide =
      beatIndex === 2
        ? beatEvaluations.get(1)?.detectedSide
        : beatIndex === 4
          ? beatEvaluations.get(3)?.detectedSide
          : null;
    const expectedDirection = activeMovementId.startsWith("autumn-")
      ? "outbound"
      : activeMovementId.startsWith("spring-")
        ? "return"
        : null;
    const thresholdScale = activeMovementId.startsWith("spring-")
      ? MIGRATION_RECOGNITION_THRESHOLDS.springMigrationThresholdScale
      : 1;
    const evaluation = evaluateMigrationMovementBeat({
      profile: recognitionProfile.value,
      samples: beatSamples,
      beatIndex,
      barBaseline: windowSamples[0] ?? null,
      expectedDirection,
      thresholdScale,
      returnSide,
      actionSamples: isReturnBeat(beatIndex)
        ? windowSamples.filter(
            (sample) =>
              sample.barElapsedMs >=
                (beatIndex - 2) *
                  MIGRATION_RECOGNITION_THRESHOLDS.beatDurationMs &&
              sample.barElapsedMs < beatStartMs,
          )
        : [],
    });
    if (evaluation.status === "success" || finalize) {
      publishBeatEvaluation(barIndex, beatIndex, evaluation);
      if (isReturnBeat(beatIndex)) {
        publishPhraseEvaluation(barIndex, getPhraseIndexForBeat(beatIndex));
      }
    }
  };

  const evaluateExtendedReturnBeat = (
    barIndex: number,
    barElapsedMs: number,
  ) => {
    const beat2EndMs = 2 * MIGRATION_RECOGNITION_THRESHOLDS.beatDurationMs;
    const beat2ExtendedEndMs =
      beat2EndMs +
      MIGRATION_RECOGNITION_THRESHOLDS.migrationReturnWindowAfterMs;
    const pendingBeat =
      barElapsedMs >= beat2EndMs &&
      barElapsedMs < 3 * MIGRATION_RECOGNITION_THRESHOLDS.beatDurationMs
        ? 2
        : null;

    if (!pendingBeat || beatEvaluations.get(pendingBeat)?.status === "success")
      return;

    evaluateCurrentBeat(
      barIndex,
      pendingBeat,
      barElapsedMs >= beat2ExtendedEndMs,
    );
  };

  const evaluateCompletedBar = (barIndex: number) => {
    const profile = recognitionProfile.value;

    if (!profile || !currentBarEvaluable || !windowSamples.length) return;

    const expectedDirection = activeMovementId.startsWith("autumn-")
      ? "outbound"
      : activeMovementId.startsWith("spring-")
        ? "return"
        : null;
    const thresholdScale = activeMovementId.startsWith("spring-")
      ? MIGRATION_RECOGNITION_THRESHOLDS.springMigrationThresholdScale
      : 1;
    const evaluation = evaluateMigrationMovementWindow(
      profile,
      windowSamples,
      expectedDirection,
      thresholdScale,
    );
    const beatResults = ([1, 2, 3, 4] as const)
      .map((beatIndex) => beatEvaluations.get(beatIndex))
      .filter((result): result is MigrationMovementBeatEvaluation =>
        Boolean(result),
      );
    const statuses = beatResults.map((result) => result.status);
    const status =
      beatResults.length < MIGRATION_RECOGNITION_THRESHOLDS.beatsPerBar ||
      statuses.includes("not_evaluable")
        ? "not_evaluable"
        : statuses.every((beatStatus) => beatStatus === "success")
          ? "success"
          : "failed";
    const evaluatedAtMs = performance.now();
    const evaluationId = `migration-${recognitionSessionId}-${profile}-${barIndex}`;

    lastEvaluationStatus.value = status;
    wingBeatDetected.value = evaluation.wingBeat === "success";
    stepActivityDetected.value = evaluation.stepActivity === "success";
    stanceWidthChangeDetected.value =
      evaluation.stanceWidthChange === "success";
    verticalBounceDetected.value = evaluation.verticalBounce === "success";
    lastBarEvaluation.value = {
      evaluationId,
      sessionId: recognitionSessionId,
      profile,
      movementId: activeMovementId || profile,
      barIndex,
      status,
      beatResults,
      criteria: {
        wingBeat: evaluation.wingBeat,
        stepActivity: evaluation.stepActivity,
        stanceWidthChange: evaluation.stanceWidthChange,
        verticalBounce: evaluation.verticalBounce,
      },
      evaluatedAtMs,
    };

    // Beat 4 already owns the short visual confirmation. The bar result only
    // drives text/progress so it cannot create a second overlapping pulse.
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
    const beatIndex = Math.min(
      Math.floor(
        barElapsedMs / MIGRATION_RECOGNITION_THRESHOLDS.beatDurationMs,
      ) + 1,
      MIGRATION_RECOGNITION_THRESHOLDS.beatsPerBar,
    ) as MigrationMovementBeatIndex;

    if (currentBarIndex === null) {
      currentBarIndex = barIndex;
      currentBeatIndex = beatIndex;
      currentBarEvaluable =
        barElapsedMs <=
        MIGRATION_RECOGNITION_THRESHOLDS.initialBarCaptureWindowMs;
    } else if (barIndex !== currentBarIndex) {
      if (currentBeatIndex !== null) {
        evaluateCurrentBeat(currentBarIndex, currentBeatIndex, true);
      }
      evaluateCompletedBar(currentBarIndex);
      windowSamples = [];
      beatEvaluations.clear();
      currentBarIndex = barIndex;
      currentBeatIndex = beatIndex;
      currentBarEvaluable =
        barElapsedMs <=
        MIGRATION_RECOGNITION_THRESHOLDS.initialBarCaptureWindowMs;
    } else if (beatIndex !== currentBeatIndex) {
      if (currentBeatIndex !== null) {
        evaluateCurrentBeat(
          currentBarIndex,
          currentBeatIndex,
          !isReturnBeat(currentBeatIndex),
        );
      }
      currentBeatIndex = beatIndex;
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
    currentBeatWindow.value = `${barIndex}:${beatIndex}`;
    evaluateExtendedReturnBeat(barIndex, barElapsedMs);
    evaluateCurrentBeat(barIndex, beatIndex, false);
    updateTrends(sample, timestampMs);
  };

  const cleanup = () => reset();

  const diagnostics = computed(() => {
    const beat = lastBeatEvaluation.value;
    const barBeat = (beatIndex: MigrationMovementBeatIndex) =>
      lastBarEvaluation.value?.beatResults.find(
        (result) => result.beatIndex === beatIndex,
      );
    const beatWindowStartMs = beat
      ? (beat.beatIndex - 1) * MIGRATION_RECOGNITION_THRESHOLDS.beatDurationMs
      : null;
    return {
      currentMovementId: activeMovementId || null,
      currentBarIndex,
      currentBeat: currentBeatIndex,
      beatWindowStartMs,
      beatWindowEndMs:
        beatWindowStartMs === null
          ? null
          : beatWindowStartMs + MIGRATION_RECOGNITION_THRESHOLDS.beatDurationMs,
      lastBeatEvaluationStatus: beat?.status ?? "idle",
      lastBeatEvaluationId: beat?.evaluationId ?? null,
      activeSide: beat?.metrics.activeSide ?? null,
      activeFootDelta: beat?.metrics.activeFootDelta ?? null,
      baselineFootX: beat?.metrics.baselineFootX ?? null,
      actionFootX: beat?.metrics.actionFootX ?? null,
      returnFootX: beat?.metrics.returnFootX ?? null,
      returnDelta: beat?.metrics.returnDelta ?? null,
      returnStartDistance: beat?.metrics.returnStartDistance ?? null,
      returnFinalDistance: beat?.metrics.returnFinalDistance ?? null,
      returnMovement: beat?.metrics.returnMovement ?? null,
      sampleWindowStartMs: beat?.metrics.sampleWindowStartMs ?? null,
      sampleWindowEndMs: beat?.metrics.sampleWindowEndMs ?? null,
      stanceWidthChange: beat?.metrics.stanceChange ?? null,
      actionStanceWidth: beat?.metrics.actionStanceWidth ?? null,
      returnStanceWidth: beat?.metrics.returnStanceWidth ?? null,
      validSampleCount: beat?.metrics.validSampleCount ?? 0,
      actionSampleCount: beat?.metrics.actionSampleCount ?? 0,
      directionScore: beat?.metrics.directionScore ?? null,
      expectedDirection: beat?.metrics.expectedDirection ?? null,
      summer: {
        rightStepDelta: barBeat(1)?.metrics.activeFootDelta ?? null,
        rightReturnDelta: barBeat(2)?.metrics.returnDelta ?? null,
        leftStepDelta: barBeat(3)?.metrics.activeFootDelta ?? null,
        leftReturnDelta: barBeat(4)?.metrics.returnDelta ?? null,
      },
      winter: {
        rightStepOutDelta: barBeat(1)?.metrics.activeFootDelta ?? null,
        leftCloseDelta: barBeat(2)?.metrics.activeFootDelta ?? null,
        leftStepOutDelta: barBeat(3)?.metrics.activeFootDelta ?? null,
        rightCloseDelta: barBeat(4)?.metrics.activeFootDelta ?? null,
      },
      migration: {
        beat1FootActivity: barBeat(1)?.criteria.footActivity ?? "idle",
        beat1ArmsUp: barBeat(1)?.criteria.armsUp ?? "idle",
        beat2Return: barBeat(2)?.criteria.returnToBaseline ?? "idle",
        beat2FootDelta: barBeat(2)?.metrics.activeFootDelta ?? null,
        beat2ReturnDelta: barBeat(2)?.metrics.returnDelta ?? null,
        beat2ReturnFinalDistance:
          barBeat(2)?.metrics.returnFinalDistance ?? null,
        beat2DetectedSide: barBeat(2)?.detectedSide ?? null,
        beat2ArmsDown: barBeat(2)?.criteria.armsDown ?? "idle",
        beat3FootActivity: barBeat(3)?.criteria.footActivity ?? "idle",
        beat3ArmsUp: barBeat(3)?.criteria.armsUp ?? "idle",
        beat4Return: barBeat(4)?.criteria.returnToBaseline ?? "idle",
        beat4FootDelta: barBeat(4)?.metrics.activeFootDelta ?? null,
        beat4ReturnDelta: barBeat(4)?.metrics.returnDelta ?? null,
        beat4ReturnFinalDistance:
          barBeat(4)?.metrics.returnFinalDistance ?? null,
        beat4DetectedSide: barBeat(4)?.detectedSide ?? null,
        beat4ArmsDown: barBeat(4)?.criteria.armsDown ?? "idle",
      },
      configuredThresholds: {
        summerStepDelta: MIGRATION_RECOGNITION_THRESHOLDS.summerStepDelta,
        summerReturnDelta: MIGRATION_RECOGNITION_THRESHOLDS.summerReturnDelta,
        summerMaximumReturnDistance:
          MIGRATION_RECOGNITION_THRESHOLDS.summerMaximumReturnDistance,
        winterStepOutDelta: MIGRATION_RECOGNITION_THRESHOLDS.winterStepOutDelta,
        winterCloseDelta: MIGRATION_RECOGNITION_THRESHOLDS.winterCloseDelta,
        migrationFootActivity:
          MIGRATION_RECOGNITION_THRESHOLDS.migrationFootActivity,
        migrationReturnDelta:
          MIGRATION_RECOGNITION_THRESHOLDS.migrationReturnDelta,
        migrationMaximumReturnDistance:
          MIGRATION_RECOGNITION_THRESHOLDS.migrationMaximumReturnDistance,
        migrationDirectionIsRequired:
          MIGRATION_RECOGNITION_THRESHOLDS.migrationDirectionIsRequired,
      },
    };
  });

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
    lastBarEvaluation,
    lastBeatEvaluation,
    lastPhraseEvaluation,
    validPoseSampleCount,
    currentBeatWindow,
    diagnostics,
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
