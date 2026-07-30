import type { BodyFrameMetrics } from "~/utils/movement/core/bodyMetrics";
import type { PosePredicateResult } from "~/utils/movement/core/predicates/types";

export interface FeetCloseOptions {
  maxNormalizedAnkleDistance: number;
}

export interface FeetCloseMetrics {
  normalizedAnkleDistance: number | null;
}

export const evaluateFeetClose = (
  metrics: Pick<BodyFrameMetrics, "normalizedAnkleDistance">,
  options: FeetCloseOptions,
): PosePredicateResult<FeetCloseMetrics> => {
  const predicateMetrics = {
    normalizedAnkleDistance: metrics.normalizedAnkleDistance,
  };
  const evaluable = predicateMetrics.normalizedAnkleDistance !== null;
  const passed =
    evaluable &&
    predicateMetrics.normalizedAnkleDistance! <=
      options.maxNormalizedAnkleDistance;

  return {
    passed,
    score: passed ? 1 : 0,
    evaluable,
    metrics: predicateMetrics,
    failedConditions: passed ? [] : ["ankle-distance"],
  };
};
