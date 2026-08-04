import { computed } from "vue";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import { useStoryGestureStore } from "~/store/storyGestureStore";
import type { GestureSessionDiagnostics } from "~/store/storyGestureStore";
import {
  countEvaluableMigrationSamples,
  type MigrationCheckpointEvaluation,
  type MigrationReferencePoses,
  type MovementPoseBaseline,
  type TimedMigrationPoseSample,
} from "~/utils/migrationActs/migrationMovementEvaluation";
import {
  getMigrationCheckpointWindow,
  type MigrationMovementCheckpointDefinition,
} from "~/utils/migrationActs/migrationMovementDefinitions";

const formatNumber = (value: number | null | undefined, digits = 3) =>
  value === null || value === undefined ? "none" : value.toFixed(digits);

export const buildMigrationGestureDiagnostics = ({
  transportTimeMs,
  scheduledStartMs,
  sourceTimeMs,
  poseSampleTimestampMs,
  checkpoint,
  samples,
  baseline,
  references,
  evaluations,
}: {
  transportTimeMs: number;
  scheduledStartMs: number | null;
  sourceTimeMs: number;
  poseSampleTimestampMs: number | null;
  checkpoint: MigrationMovementCheckpointDefinition | null;
  samples: TimedMigrationPoseSample[];
  baseline: MovementPoseBaseline | null;
  references: MigrationReferencePoses;
  evaluations: MigrationCheckpointEvaluation[];
}): GestureSessionDiagnostics => {
  const window = checkpoint ? getMigrationCheckpointWindow(checkpoint) : null;
  const windowSamples = checkpoint
    ? samples.filter(
        (sample) =>
          sample.sourceTimeMs >= window!.startMs &&
          sample.sourceTimeMs <= window!.endMs,
      )
    : [];
  return {
    audioTransportTimeMs: transportTimeMs,
    movementScheduledStartMs: scheduledStartMs,
    movementSourceTimeMs: sourceTimeMs,
    recognitionSourceTimeMs: sourceTimeMs,
    currentCheckpointId: checkpoint?.id ?? null,
    checkpointTargetSourceTimeMs: checkpoint?.targetSourceTimeMs ?? null,
    checkpointWindowStartMs: window?.startMs ?? null,
    checkpointWindowEndMs: window?.endMs ?? null,
    poseSampleTimestampMs,
    samplesInWindow: windowSamples.length,
    validSamplesInWindow: checkpoint
      ? countEvaluableMigrationSamples({
          checkpoint,
          samples,
          baseline,
          references,
        })
      : 0,
    selectedBestSampleTimestampMs:
      evaluations.at(-1)?.criteria[0]?.selectedSampleTimestampMs ?? null,
    baselineShoulderCenterY: baseline?.shoulderCenterY ?? null,
    baselineHipCenterY: baseline?.hipCenterY ?? null,
    baselineTorsoLength: baseline?.torsoLength ?? null,
  };
};

export const useMigrationGestureDiagnostics = () => {
  const store = useStoryGestureStore();
  const migrationStore = useMigrationActStore();

  return computed(() => {
    const diagnostics = store.diagnostics;

    return [
      { label: "gestureType", value: store.activeGestureId ?? "none" },
      { label: "gesturePhase", value: store.gesturePhase },
      { label: "storyElapsedMs", value: migrationStore.currentElapsedMs },
      {
        label: "audioTransportTimeMs",
        value: diagnostics.audioTransportTimeMs,
      },
      {
        label: "movementScheduledStartMs",
        value: diagnostics.movementScheduledStartMs ?? "none",
      },
      { label: "gestureSourceTimeMs", value: store.currentSourceTimeMs },
      {
        label: "currentCheckpoint",
        value: diagnostics.currentCheckpointId ?? "none",
      },
      {
        label: "checkpointWindowStartMs",
        value: diagnostics.checkpointWindowStartMs ?? "none",
      },
      {
        label: "checkpointWindowEndMs",
        value: diagnostics.checkpointWindowEndMs ?? "none",
      },
      { label: "samplesInWindow", value: diagnostics.samplesInWindow },
      {
        label: "validSamplesInWindow",
        value: diagnostics.validSamplesInWindow,
      },
      {
        label: "selectedBestSampleTimestampMs",
        value: diagnostics.selectedBestSampleTimestampMs ?? "none",
      },
      {
        label: "baselineShoulderCenterY",
        value: formatNumber(diagnostics.baselineShoulderCenterY),
      },
      {
        label: "baselineHipCenterY",
        value: formatNumber(diagnostics.baselineHipCenterY),
      },
      {
        label: "baselineTorsoLength",
        value: formatNumber(diagnostics.baselineTorsoLength),
      },
      {
        label: "evaluationStatus",
        value: store.latestEvaluationResult?.status ?? "pending",
      },
      {
        label: "primaryFeedbackCode",
        value: store.latestEvaluationResult?.primaryFeedbackCode ?? "none",
      },
    ];
  });
};
