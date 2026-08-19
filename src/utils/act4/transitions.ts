import type { Act4PeriodTransition, Act4SequenceTarget } from "~/types/act4";

export type Act4EvaluationTransition =
  | { type: "retry"; targetIndex: number }
  | { type: "advance"; nextTargetIndex: number }
  | {
      type: "periodTransition";
      currentTargetIndex: number;
      nextTargetIndex: number;
      transition: Act4PeriodTransition;
    }
  | { type: "complete" };

export const isAct4PeriodTransitionBoundary = (
  target: Act4SequenceTarget | null,
  nextTarget: Act4SequenceTarget | null,
) =>
  target?.context === "climateStory" &&
  nextTarget?.context === "climateStory" &&
  target.season === "autumn" &&
  target.interval !== nextTarget.interval;

export const getAct4EvaluationTransition = ({
  targets,
  currentTargetIndex,
  passed,
}: {
  targets: Act4SequenceTarget[];
  currentTargetIndex: number;
  passed: boolean;
}): Act4EvaluationTransition => {
  if (!passed) {
    return { type: "retry", targetIndex: currentTargetIndex };
  }

  const target = targets[currentTargetIndex] ?? null;
  const nextTargetIndex = currentTargetIndex + 1;
  const nextTarget = targets[nextTargetIndex] ?? null;

  if (!nextTarget) return { type: "complete" };

  if (isAct4PeriodTransitionBoundary(target, nextTarget)) {
    return {
      type: "periodTransition",
      currentTargetIndex,
      nextTargetIndex,
      transition: {
        previousPeriod: target?.interval ?? "",
        nextPeriod: nextTarget.interval ?? "",
      },
    };
  }

  return {
    type: "advance",
    nextTargetIndex,
  };
};
