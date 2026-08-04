import type { MigrationMovementRootMotion } from "~/types/migrationAct";
import type { LandmarkFrame } from "~/types/movement";
import { extractNormalizedBodyMetrics } from "~/utils/movement/core/bodyMetrics";

const getStableHipCenter = (frame: LandmarkFrame) => {
  const metrics = extractNormalizedBodyMetrics(frame.landmarks);

  return metrics.landmarkConfidence === "ok" ? metrics.hipCenter : null;
};

export const calculateMovementRootDisplacement = (
  frames: LandmarkFrame[],
): MigrationMovementRootMotion | null => {
  const startHip = frames.map(getStableHipCenter).find(Boolean) ?? null;
  const endHip =
    [...frames].reverse().map(getStableHipCenter).find(Boolean) ?? null;

  if (!startHip || !endHip) return null;

  return {
    startHipX: startHip.x,
    startHipY: startHip.y,
    endHipX: endHip.x,
    endHipY: endHip.y,
    displacementX: endHip.x - startHip.x,
    displacementY: endHip.y - startHip.y,
  };
};
