import type { BodyFrameMetrics } from "~/utils/movement/core/bodyMetrics";
import type { PosePredicateResult } from "~/utils/movement/core/predicates/types";

export interface HandsGatheredAtCenterOptions {
  maxNormalizedHandDistance: number;
  maxAbsoluteCenterOffset: number;
}

export interface HandsGatheredAtCenterMetrics {
  normalizedHandDistance: number | null;
  handCenterXOffset: number | null;
}

export const evaluateHandsGatheredAtCenter = (
  metrics: Pick<
    BodyFrameMetrics,
    "normalizedHandDistance" | "handCenterXOffset"
  >,
  options: HandsGatheredAtCenterOptions,
): PosePredicateResult<HandsGatheredAtCenterMetrics> => {
  const predicateMetrics = {
    normalizedHandDistance: metrics.normalizedHandDistance,
    handCenterXOffset: metrics.handCenterXOffset,
  };
  const evaluable =
    predicateMetrics.normalizedHandDistance !== null &&
    predicateMetrics.handCenterXOffset !== null;
  const handDistancePassed =
    predicateMetrics.normalizedHandDistance !== null &&
    predicateMetrics.normalizedHandDistance <=
      options.maxNormalizedHandDistance;
  const centerOffsetPassed =
    predicateMetrics.handCenterXOffset !== null &&
    Math.abs(predicateMetrics.handCenterXOffset) <=
      options.maxAbsoluteCenterOffset;
  const failedConditions = [
    ...(handDistancePassed ? [] : ["hand-distance"]),
    ...(centerOffsetPassed ? [] : ["center-offset"]),
  ];
  const passed = evaluable && handDistancePassed && centerOffsetPassed;

  return {
    passed,
    score: passed ? 1 : 0,
    evaluable,
    metrics: predicateMetrics,
    failedConditions,
  };
};
