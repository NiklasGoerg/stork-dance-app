import type { BodyFrameMetrics } from "~/utils/movement/core/bodyMetrics";
import type { PosePredicateResult } from "~/utils/movement/core/predicates/types";

export interface WristsAboveHeadOptions {
  marginInShoulderWidths: number;
  requiredCount: 1 | 2;
}

export interface WristsAboveHeadMetrics {
  wristsAboveHeadCount: number | null;
  evaluableWristCount: number;
}

export const evaluateWristsAboveHead = (
  metrics: Pick<
    BodyFrameMetrics,
    "headPoint" | "shoulderWidth" | "leftWrist" | "rightWrist"
  >,
  options: WristsAboveHeadOptions,
): PosePredicateResult<WristsAboveHeadMetrics> => {
  if (!metrics.headPoint || !metrics.shoulderWidth) {
    return {
      passed: false,
      score: 0,
      evaluable: false,
      metrics: {
        wristsAboveHeadCount: null,
        evaluableWristCount: 0,
      },
      failedConditions: ["head-or-shoulder-reference"],
    };
  }

  const thresholdY =
    metrics.headPoint.y -
    metrics.shoulderWidth * options.marginInShoulderWidths;
  const wrists = [metrics.leftWrist, metrics.rightWrist];
  const evaluableWrists = wrists.filter((wrist) => wrist !== null);
  const wristsAboveHeadCount = evaluableWrists.filter(
    (wrist) => wrist.y <= thresholdY,
  ).length;
  const evaluable = evaluableWrists.length >= options.requiredCount;
  const passed = evaluable && wristsAboveHeadCount >= options.requiredCount;

  return {
    passed,
    score: passed ? 1 : 0,
    evaluable,
    metrics: {
      wristsAboveHeadCount,
      evaluableWristCount: evaluableWrists.length,
    },
    failedConditions: passed ? [] : ["wrist-height"],
  };
};
