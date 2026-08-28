import type {
  MigrationMovementBeatEvaluation,
  MigrationMovementBeatIndex,
  MigrationMovementCriterionStatus,
  MigrationMovementDirection,
  MigrationMovementRecognitionProfile,
  MigrationMovementWingState,
} from "~/types/migrationAct";
import type { PoseLandmarkLike } from "~/types/pose";
import type { PosePoint } from "~/utils/pose/poseGeometry";
import { POSE_LANDMARK } from "~/utils/pose/poseLandmarks";
import { MIGRATION_RECOGNITION_THRESHOLDS } from "~/utils/migrationActs/migrationMovementConfig";
import {
  calculateShoulderCenter,
  calculateTorsoScale,
  getMigrationMovementVisiblePoint,
} from "~/utils/migrationActs/migrationMovementMetrics";

export type MigrationMovementRecognitionSample = {
  timestampMs: number;
  barElapsedMs: number;
  hipCenter: PosePoint | null;
  torsoScale: number | null;
  stanceWidth: number | null;
  lean: number | null;
  leftAnkle: PosePoint | null;
  rightAnkle: PosePoint | null;
  wingState: MigrationMovementWingState;
};

export type MigrationBeatCriteria = MigrationMovementBeatEvaluation["criteria"];
export type MigrationBeatMetrics = MigrationMovementBeatEvaluation["metrics"];

export type MigrationMovementBeatResult = {
  status: MigrationMovementCriterionStatus;
  detectedSide: MigrationSummerStepSide | null;
  criteria: MigrationBeatCriteria;
  metrics: MigrationBeatMetrics;
};

export type MigrationMovementWindowEvaluation = {
  status: MigrationMovementCriterionStatus;
  wingBeat: MigrationMovementCriterionStatus;
  stepActivity: MigrationMovementCriterionStatus;
  stanceWidthChange: MigrationMovementCriterionStatus;
  verticalBounce: MigrationMovementCriterionStatus;
  beatResults: Array<
    MigrationMovementBeatResult & { beatIndex: MigrationMovementBeatIndex }
  >;
};

export type MigrationSummerStepSide = "left" | "right";
export type MigrationSummerBeatEvaluation = Pick<
  MigrationMovementBeatResult,
  "status" | "detectedSide"
>;

const notEvaluableCriteria = (): MigrationBeatCriteria => ({
  footActivity: "not_evaluable",
  returnToBaseline: "not_evaluable",
  stanceChange: "not_evaluable",
  armsUp: "not_evaluable",
  armsDown: "not_evaluable",
  direction: "not_evaluable",
});

const emptyMetrics = (
  expectedDirection: MigrationMovementDirection | null,
): MigrationBeatMetrics => ({
  activeSide: null,
  activeFootDelta: null,
  baselineFootX: null,
  actionFootX: null,
  returnFootX: null,
  returnDelta: null,
  returnStartDistance: null,
  returnFinalDistance: null,
  returnMovement: null,
  sampleWindowStartMs: null,
  sampleWindowEndMs: null,
  stanceChange: null,
  actionStanceWidth: null,
  returnStanceWidth: null,
  validSampleCount: 0,
  actionSampleCount: 0,
  directionScore: null,
  expectedDirection,
});

const getStatus = (evaluable: boolean, passed: boolean) =>
  !evaluable ? "not_evaluable" : passed ? "success" : "failed";

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const getScale = (samples: MigrationMovementRecognitionSample[]) => {
  const scales = samples
    .map((sample) => sample.torsoScale)
    .filter((scale): scale is number => scale !== null);
  return scales.length ? average(scales) : null;
};

const pointDistance = (first: PosePoint, second: PosePoint) =>
  Math.hypot(first.x - second.x, first.y - second.y);

const getPointRange = (
  samples: MigrationMovementRecognitionSample[],
  selectPoint: (sample: MigrationMovementRecognitionSample) => PosePoint | null,
) => {
  const points = samples
    .map(selectPoint)
    .filter((point): point is PosePoint => !!point);
  const torsoScale = getScale(samples);
  if (points.length < 2 || !torsoScale) return null;
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  return (
    Math.hypot(
      Math.max(...xValues) - Math.min(...xValues),
      Math.max(...yValues) - Math.min(...yValues),
    ) / torsoScale
  );
};

const getPointDelta = (
  samples: MigrationMovementRecognitionSample[],
  side: MigrationSummerStepSide,
) =>
  getPointRange(samples, (sample) =>
    side === "left" ? sample.leftAnkle : sample.rightAnkle,
  );

const getFootXMovement = (
  samples: MigrationMovementRecognitionSample[],
  side: MigrationSummerStepSide,
) => {
  const points = samples
    .map((sample) => (side === "left" ? sample.leftAnkle : sample.rightAnkle))
    .filter((point): point is PosePoint => !!point);
  const torsoScale = getScale(samples);
  const first = points[0];
  const last = points.at(-1);

  if (!first || !last || !torsoScale) return null;

  return (last.x - first.x) / torsoScale;
};

const getAnatomicalFootAction = (
  samples: MigrationMovementRecognitionSample[],
  side: MigrationSummerStepSide,
) => {
  const movement = getFootXMovement(samples, side);
  if (movement === null) return null;

  return side === "right" ? movement : -movement;
};

const getAnatomicalFootClose = (
  samples: MigrationMovementRecognitionSample[],
  side: MigrationSummerStepSide,
) => {
  const movement = getFootXMovement(samples, side);
  if (movement === null) return null;

  return side === "right" ? -movement : movement;
};

const getReturnMetrics = (
  returnSamples: MigrationMovementRecognitionSample[],
  actionSamples: MigrationMovementRecognitionSample[],
  baseline: MigrationMovementRecognitionSample,
  side: MigrationSummerStepSide,
) => {
  const baselinePoint =
    side === "left" ? baseline.leftAnkle : baseline.rightAnkle;
  const returnPoints = returnSamples
    .map((sample) => (side === "left" ? sample.leftAnkle : sample.rightAnkle))
    .filter((point): point is PosePoint => !!point);
  const actionPoints = actionSamples
    .map((sample) => (side === "left" ? sample.leftAnkle : sample.rightAnkle))
    .filter((point): point is PosePoint => !!point);
  const torsoScale = getScale([baseline, ...actionSamples, ...returnSamples]);
  if (!baselinePoint || returnPoints.length < 2 || !torsoScale) return null;
  const referencePoints = actionPoints.length ? actionPoints : returnPoints;
  const actionDistances = referencePoints.map(
    (point) => pointDistance(point, baselinePoint) / torsoScale,
  );
  const returnDistances = returnPoints.map(
    (point) => pointDistance(point, baselinePoint) / torsoScale,
  );
  const startDistance = Math.max(...actionDistances);
  const finalDistance = Math.min(...returnDistances);
  const actionPoint = referencePoints[actionDistances.indexOf(startDistance)]!;
  const returnPoint = returnPoints[returnDistances.indexOf(finalDistance)]!;
  const actionStances = actionSamples
    .map((sample) => sample.stanceWidth)
    .filter((width): width is number => width !== null);
  const returnStances = returnSamples
    .map((sample) => sample.stanceWidth)
    .filter((width): width is number => width !== null);
  const actionStanceWidth = actionStances.length
    ? Math.max(...actionStances)
    : (returnStances[0] ?? null);
  const returnStanceWidth = returnStances.length
    ? Math.min(...returnStances)
    : null;
  return {
    movement: startDistance - finalDistance,
    returnDelta: startDistance - finalDistance,
    startDistance,
    finalDistance,
    actionFootX: actionPoint.x,
    returnFootX: returnPoint.x,
    actionStanceWidth,
    returnStanceWidth,
    stanceChange:
      actionStanceWidth !== null && returnStanceWidth !== null
        ? actionStanceWidth - returnStanceWidth
        : null,
  };
};

const getStanceChange = (
  samples: MigrationMovementRecognitionSample[],
  opens: boolean,
) => {
  const widths = samples
    .map((sample) => sample.stanceWidth)
    .filter((width): width is number => width !== null);
  if (widths.length < 2) return null;
  return opens
    ? Math.max(...widths.slice(1)) - widths[0]!
    : widths[0]! - Math.min(...widths.slice(1));
};

const getDirectionScore = (samples: MigrationMovementRecognitionSample[]) => {
  const first = samples[0];
  const last = samples.at(-1);
  const scale = getScale(samples);
  if (!first?.hipCenter || !last?.hipCenter || !scale) return null;
  return (last.hipCenter.x - first.hipCenter.x) / scale;
};

const hasWingState = (
  samples: MigrationMovementRecognitionSample[],
  state: "up" | "down",
) => samples.some((sample) => sample.wingState === state);

const getExpectedSide = (
  profile: MigrationMovementRecognitionProfile,
  beatIndex: MigrationMovementBeatIndex,
) => {
  if (profile === "summer_rest") return beatIndex <= 2 ? "right" : "left";
  if (profile === "winter_rest") {
    if (beatIndex === 1 || beatIndex === 4) return "right";
    return "left";
  }
  return null;
};

export const evaluateMigrationMovementBeat = ({
  profile,
  samples,
  beatIndex,
  barBaseline = samples[0] ?? null,
  expectedDirection = null,
  thresholdScale = 1,
  returnSide = null,
  actionSamples = [],
}: {
  profile: MigrationMovementRecognitionProfile;
  samples: MigrationMovementRecognitionSample[];
  beatIndex: MigrationMovementBeatIndex;
  barBaseline?: MigrationMovementRecognitionSample | null;
  expectedDirection?: MigrationMovementDirection | null;
  thresholdScale?: number;
  returnSide?: MigrationSummerStepSide | null;
  actionSamples?: MigrationMovementRecognitionSample[];
}): MigrationMovementBeatResult => {
  const validSamples = samples.filter(
    (sample) =>
      sample.torsoScale !== null &&
      sample.leftAnkle !== null &&
      sample.rightAnkle !== null &&
      sample.stanceWidth !== null,
  );
  if (
    validSamples.length < MIGRATION_RECOGNITION_THRESHOLDS.minimumBeatSamples ||
    !barBaseline
  ) {
    return {
      status: "not_evaluable",
      detectedSide: null,
      criteria: notEvaluableCriteria(),
      metrics: emptyMetrics(expectedDirection),
    };
  }

  const isActionBeat = beatIndex === 1 || beatIndex === 3;
  const expectedSide = getExpectedSide(profile, beatIndex);
  const leftDelta = getPointDelta(validSamples, "left");
  const rightDelta = getPointDelta(validSamples, "right");
  const strongest = [
    { side: "left" as const, value: leftDelta },
    { side: "right" as const, value: rightDelta },
  ].sort((first, second) => (second.value ?? -1) - (first.value ?? -1))[0]!;
  const activeSide =
    expectedSide ?? (!isActionBeat ? returnSide : null) ?? strongest.side;
  const activeFootDelta = activeSide === "left" ? leftDelta : rightDelta;
  const stanceChange = getStanceChange(validSamples, isActionBeat);
  const returnMetrics = isActionBeat
    ? null
    : getReturnMetrics(validSamples, actionSamples, barBaseline, activeSide);
  const directionScore = getDirectionScore(validSamples);
  const directionPassed =
    expectedDirection === null ||
    directionScore === null ||
    expectedDirection === "stationary" ||
    (expectedDirection === "outbound"
      ? directionScore <= 0
      : directionScore >= 0);
  const directionStatus = getStatus(directionScore !== null, directionPassed);
  const baseCriteria = notEvaluableCriteria();
  const metrics: MigrationBeatMetrics = {
    activeSide,
    activeFootDelta,
    baselineFootX:
      (activeSide === "left" ? barBaseline.leftAnkle : barBaseline.rightAnkle)
        ?.x ?? null,
    actionFootX: returnMetrics?.actionFootX ?? null,
    returnFootX: returnMetrics?.returnFootX ?? null,
    returnDelta: returnMetrics?.returnDelta ?? null,
    returnStartDistance: returnMetrics?.startDistance ?? null,
    returnFinalDistance: returnMetrics?.finalDistance ?? null,
    returnMovement: returnMetrics?.movement ?? null,
    sampleWindowStartMs: validSamples[0]?.barElapsedMs ?? null,
    sampleWindowEndMs: validSamples.at(-1)?.barElapsedMs ?? null,
    stanceChange: returnMetrics?.stanceChange ?? stanceChange,
    actionStanceWidth: returnMetrics?.actionStanceWidth ?? null,
    returnStanceWidth: returnMetrics?.returnStanceWidth ?? null,
    validSampleCount: validSamples.length,
    actionSampleCount: actionSamples.length,
    directionScore,
    expectedDirection,
  };

  if (profile === "summer_rest") {
    const footPassed =
      activeFootDelta !== null &&
      activeFootDelta >= MIGRATION_RECOGNITION_THRESHOLDS.summerStepDelta;
    const returnPassed =
      returnMetrics !== null &&
      returnMetrics.movement !== null &&
      returnMetrics.movement >=
        MIGRATION_RECOGNITION_THRESHOLDS.summerReturnDelta &&
      (returnMetrics.returnDelta >=
        MIGRATION_RECOGNITION_THRESHOLDS.summerReturnDelta ||
        returnMetrics.finalDistance <=
          MIGRATION_RECOGNITION_THRESHOLDS.summerMaximumReturnDistance);
    const returnStancePassed =
      returnMetrics !== null &&
      returnMetrics.stanceChange !== null &&
      returnMetrics.stanceChange >=
        MIGRATION_RECOGNITION_THRESHOLDS.summerSupportingStanceChange;
    const passed = isActionBeat ? footPassed : returnPassed;
    return {
      status: passed ? "success" : "failed",
      detectedSide: activeFootDelta !== null ? activeSide : null,
      criteria: {
        ...baseCriteria,
        footActivity: getStatus(activeFootDelta !== null, footPassed),
        returnToBaseline: isActionBeat
          ? "not_evaluable"
          : getStatus(returnMetrics !== null, returnPassed),
        stanceChange: getStatus(
          (returnMetrics?.stanceChange ?? stanceChange) !== null,
          returnStancePassed,
        ),
      },
      metrics,
    };
  }

  if (profile === "winter_rest") {
    const footAction = isActionBeat
      ? getAnatomicalFootAction(validSamples, activeSide)
      : getAnatomicalFootClose(validSamples, activeSide);
    const footPassed =
      footAction !== null &&
      footAction >=
        (isActionBeat
          ? MIGRATION_RECOGNITION_THRESHOLDS.winterStepOutDelta
          : MIGRATION_RECOGNITION_THRESHOLDS.winterCloseDelta);
    const stancePassed =
      stanceChange !== null &&
      stanceChange >= MIGRATION_RECOGNITION_THRESHOLDS.winterStanceChange;
    const passed = isActionBeat ? footPassed : footPassed || stancePassed;
    return {
      status: passed ? "success" : "failed",
      detectedSide: activeFootDelta !== null ? activeSide : null,
      criteria: {
        ...baseCriteria,
        footActivity: getStatus(footAction !== null, footPassed),
        returnToBaseline: isActionBeat
          ? "not_evaluable"
          : getStatus(
              footAction !== null || stanceChange !== null,
              footPassed || stancePassed,
            ),
        stanceChange: getStatus(stanceChange !== null, stancePassed),
      },
      metrics: {
        ...metrics,
        activeFootDelta: footAction,
      },
    };
  }

  const maximumFootDelta = isActionBeat
    ? Math.max(leftDelta ?? -1, rightDelta ?? -1)
    : (activeFootDelta ?? -1);
  const footPassed =
    maximumFootDelta >=
    (isActionBeat
      ? MIGRATION_RECOGNITION_THRESHOLDS.migrationFootActivity
      : MIGRATION_RECOGNITION_THRESHOLDS.migrationReturnDelta) *
      thresholdScale;
  const feetClosed = validSamples.some(
    (sample) =>
      sample.stanceWidth !== null &&
      sample.stanceWidth <=
        MIGRATION_RECOGNITION_THRESHOLDS.migrationGuidedClosedStanceWidth *
          thresholdScale,
  );
  const guidedActionPassed = validSamples.some(
    (sample) =>
      sample.wingState === "up" &&
      sample.stanceWidth !== null &&
      barBaseline.stanceWidth !== null &&
      sample.stanceWidth - barBaseline.stanceWidth >=
        MIGRATION_RECOGNITION_THRESHOLDS.migrationStanceChange * thresholdScale,
  );
  const guidedReturnPassed = validSamples.some(
    (sample) =>
      sample.wingState === "down" &&
      sample.stanceWidth !== null &&
      sample.stanceWidth <=
        MIGRATION_RECOGNITION_THRESHOLDS.migrationGuidedClosedStanceWidth *
          thresholdScale,
  );
  const returnPassed =
    isActionBeat ||
    (profile === "migration-guided"
      ? feetClosed
      : returnMetrics !== null &&
        returnMetrics.movement !== null &&
        returnMetrics.movement >=
          MIGRATION_RECOGNITION_THRESHOLDS.migrationReturnDelta *
            thresholdScale &&
        (returnMetrics.returnDelta >=
          MIGRATION_RECOGNITION_THRESHOLDS.migrationReturnDelta *
            thresholdScale ||
          returnMetrics.finalDistance <=
            MIGRATION_RECOGNITION_THRESHOLDS.migrationMaximumReturnDistance));
  const stancePassed =
    stanceChange !== null &&
    stanceChange >= MIGRATION_RECOGNITION_THRESHOLDS.migrationStanceChange;
  const armsUp = hasWingState(validSamples, "up");
  const armsDown = hasWingState(validSamples, "down");
  const passed = isActionBeat
    ? profile === "migration-guided"
      ? guidedActionPassed
      : footPassed && armsUp
    : profile === "migration-guided"
      ? guidedReturnPassed
      : returnPassed && armsDown;
  const directionRequired =
    MIGRATION_RECOGNITION_THRESHOLDS.migrationDirectionIsRequired;
  return {
    status:
      passed && (!directionRequired || directionPassed) ? "success" : "failed",
    detectedSide: maximumFootDelta >= 0 ? activeSide : null,
    criteria: {
      ...baseCriteria,
      footActivity: getStatus(maximumFootDelta >= 0, footPassed),
      returnToBaseline: isActionBeat
        ? "not_evaluable"
        : getStatus(
            profile === "migration-guided"
              ? validSamples.some((sample) => sample.stanceWidth !== null)
              : returnMetrics !== null,
            returnPassed,
          ),
      stanceChange: getStatus(stanceChange !== null, stancePassed),
      armsUp: getStatus(
        validSamples.some((sample) => sample.wingState !== "not_evaluable"),
        armsUp,
      ),
      armsDown: getStatus(
        validSamples.some((sample) => sample.wingState !== "not_evaluable"),
        armsDown,
      ),
      direction: directionStatus,
    },
    metrics: { ...metrics, activeFootDelta: maximumFootDelta },
  };
};

export const evaluateSummerRestBeat = (
  samples: MigrationMovementRecognitionSample[],
  beatIndex: MigrationMovementBeatIndex,
  expectedSide: MigrationSummerStepSide | null,
): MigrationSummerBeatEvaluation => {
  const result = evaluateMigrationMovementBeat({
    profile: "summer_rest",
    samples,
    beatIndex,
  });
  return {
    status:
      expectedSide && result.detectedSide !== expectedSide
        ? "failed"
        : result.status,
    detectedSide: result.detectedSide,
  };
};

export const evaluateStepActivity = (
  samples: MigrationMovementRecognitionSample[],
): MigrationMovementCriterionStatus => {
  const windows = [
    samples.filter(
      (sample) =>
        sample.barElapsedMs < MIGRATION_RECOGNITION_THRESHOLDS.twoBeatWindowMs,
    ),
    samples.filter(
      (sample) =>
        sample.barElapsedMs >= MIGRATION_RECOGNITION_THRESHOLDS.twoBeatWindowMs,
    ),
  ];
  const movements = windows.map((windowSamples) =>
    Math.max(
      getPointDelta(windowSamples, "left") ?? -1,
      getPointDelta(windowSamples, "right") ?? -1,
    ),
  );
  return getStatus(
    movements.every((movement) => movement >= 0),
    movements.every(
      (movement) => movement >= MIGRATION_RECOGNITION_THRESHOLDS.ankleMovement,
    ),
  );
};

export const evaluateStanceWidthChange = (
  samples: MigrationMovementRecognitionSample[],
): MigrationMovementCriterionStatus => {
  const widths = samples
    .map((sample) => sample.stanceWidth)
    .filter((width): width is number => width !== null);
  if (widths.length < 2) return "not_evaluable";
  const hasWiderThenNarrower = widths.some((width, index) =>
    widths
      .slice(index + 1)
      .some(
        (laterWidth) =>
          width - laterWidth >=
          MIGRATION_RECOGNITION_THRESHOLDS.stanceWidthChange,
      ),
  );
  return hasWiderThenNarrower ? "success" : "failed";
};

export const evaluateVerticalBounce = (
  samples: MigrationMovementRecognitionSample[],
): MigrationMovementCriterionStatus => {
  const hips = samples.filter(
    (sample) => sample.hipCenter && sample.torsoScale !== null,
  );
  if (hips.length < 2) return "not_evaluable";
  const hasDownThenUp = hips.some((sample, index) =>
    hips.slice(index + 1).some((laterSample) => {
      const scale = (sample.torsoScale! + laterSample.torsoScale!) / 2;
      return (
        sample.hipCenter!.y - laterSample.hipCenter!.y >=
        MIGRATION_RECOGNITION_THRESHOLDS.verticalBounce * scale
      );
    }),
  );
  return hasDownThenUp ? "success" : "failed";
};

export const calculateWingState = (
  landmarks: PoseLandmarkLike[] | null | undefined,
): MigrationMovementWingState => {
  const leftShoulder = getMigrationMovementVisiblePoint(
    landmarks,
    POSE_LANDMARK.LEFT_SHOULDER,
  );
  const rightShoulder = getMigrationMovementVisiblePoint(
    landmarks,
    POSE_LANDMARK.RIGHT_SHOULDER,
  );
  const leftElbow = getMigrationMovementVisiblePoint(
    landmarks,
    POSE_LANDMARK.LEFT_ELBOW,
  );
  const rightElbow = getMigrationMovementVisiblePoint(
    landmarks,
    POSE_LANDMARK.RIGHT_ELBOW,
  );
  const leftWrist = getMigrationMovementVisiblePoint(
    landmarks,
    POSE_LANDMARK.LEFT_WRIST,
  );
  const rightWrist = getMigrationMovementVisiblePoint(
    landmarks,
    POSE_LANDMARK.RIGHT_WRIST,
  );
  const leftHip = getMigrationMovementVisiblePoint(
    landmarks,
    POSE_LANDMARK.LEFT_HIP,
  );
  const rightHip = getMigrationMovementVisiblePoint(
    landmarks,
    POSE_LANDMARK.RIGHT_HIP,
  );
  const torsoScale = calculateTorsoScale(landmarks);
  const leftArmPoint = leftWrist ?? leftElbow;
  const rightArmPoint = rightWrist ?? rightElbow;
  const shoulderCenter = calculateShoulderCenter(landmarks);
  if (
    !leftShoulder ||
    !rightShoulder ||
    !leftArmPoint ||
    !rightArmPoint ||
    !leftHip ||
    !rightHip ||
    !shoulderCenter ||
    !torsoScale
  ) {
    return "not_evaluable";
  }
  const leftArmAboveHip = (leftHip.y - leftArmPoint.y) / torsoScale;
  const rightArmAboveHip = (rightHip.y - rightArmPoint.y) / torsoScale;
  const shoulderSpan = Math.abs(rightShoulder.x - leftShoulder.x) / torsoScale;
  const armSpan = Math.abs(rightArmPoint.x - leftArmPoint.x) / torsoScale;
  const armsOpenedLaterally =
    armSpan - shoulderSpan >=
    MIGRATION_RECOGNITION_THRESHOLDS.flightArmLateralOffset;
  const leftBelowShoulder = (leftArmPoint.y - leftShoulder.y) / torsoScale;
  const rightBelowShoulder = (rightArmPoint.y - rightShoulder.y) / torsoScale;
  const leftClearlyAboveHip =
    leftArmAboveHip >= MIGRATION_RECOGNITION_THRESHOLDS.flightArmAboveHip;
  const rightClearlyAboveHip =
    rightArmAboveHip >= MIGRATION_RECOGNITION_THRESHOLDS.flightArmAboveHip;
  if (leftClearlyAboveHip && rightClearlyAboveHip && armsOpenedLaterally) {
    return "up";
  }
  if (
    !leftClearlyAboveHip &&
    !rightClearlyAboveHip &&
    leftBelowShoulder >= MIGRATION_RECOGNITION_THRESHOLDS.wingsDownTolerance &&
    rightBelowShoulder >= MIGRATION_RECOGNITION_THRESHOLDS.wingsDownTolerance
  ) {
    return "down";
  }
  return "neutral";
};

export const evaluateWingBeat = (
  samples: MigrationMovementRecognitionSample[],
): MigrationMovementCriterionStatus => {
  const wingStates = samples
    .map((sample) => sample.wingState)
    .filter((state) => state !== "not_evaluable");
  if (!wingStates.length) return "not_evaluable";
  const firstUpIndex = wingStates.indexOf("up");
  return firstUpIndex >= 0 &&
    wingStates.slice(firstUpIndex + 1).includes("down")
    ? "success"
    : "failed";
};

export const evaluateMigrationMovementWindow = (
  profile: MigrationMovementRecognitionProfile,
  samples: MigrationMovementRecognitionSample[],
  expectedDirection: MigrationMovementDirection | null = null,
  thresholdScale = 1,
): MigrationMovementWindowEvaluation => {
  const baseline = samples[0] ?? null;
  const beatResults: Array<
    MigrationMovementBeatResult & { beatIndex: MigrationMovementBeatIndex }
  > = [];
  ([1, 2, 3, 4] as const).forEach((beatIndex) => {
    const previousStepSide =
      beatIndex === 2
        ? beatResults.find((result) => result.beatIndex === 1)?.detectedSide
        : beatIndex === 4
          ? beatResults.find((result) => result.beatIndex === 3)?.detectedSide
          : null;
    beatResults.push({
      beatIndex,
      ...evaluateMigrationMovementBeat({
        profile,
        samples: samples.filter(
          (sample) =>
            sample.barElapsedMs >=
              (beatIndex - 1) *
                MIGRATION_RECOGNITION_THRESHOLDS.beatDurationMs &&
            sample.barElapsedMs <
              beatIndex * MIGRATION_RECOGNITION_THRESHOLDS.beatDurationMs +
                (beatIndex === 2 || beatIndex === 4
                  ? MIGRATION_RECOGNITION_THRESHOLDS.migrationReturnWindowAfterMs
                  : 0),
        ),
        beatIndex,
        barBaseline: baseline,
        expectedDirection,
        thresholdScale,
        returnSide: previousStepSide ?? null,
        actionSamples: samples.filter(
          (sample) =>
            sample.barElapsedMs >=
              (beatIndex - 2) *
                MIGRATION_RECOGNITION_THRESHOLDS.beatDurationMs &&
            sample.barElapsedMs <
              (beatIndex - 1) * MIGRATION_RECOGNITION_THRESHOLDS.beatDurationMs,
        ),
      }),
    });
  });
  const beatStatuses = beatResults.map((result) => result.status);
  const status = beatStatuses.includes("not_evaluable")
    ? "not_evaluable"
    : beatStatuses.every((result) => result === "success")
      ? "success"
      : "failed";
  return {
    status,
    wingBeat: evaluateWingBeat(samples),
    stepActivity: evaluateStepActivity(samples),
    stanceWidthChange: evaluateStanceWidthChange(samples),
    verticalBounce: evaluateVerticalBounce(samples),
    beatResults,
  };
};
