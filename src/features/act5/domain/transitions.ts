import type {
  Act5PeriodTransition,
  Act5SequenceTarget,
} from "~/features/act5/types/act5";

export type Act5EvaluationTransition =
  | { type: "retry"; targetIndex: number }
  | { type: "advance"; nextTargetIndex: number }
  | {
      type: "periodTransition";
      currentTargetIndex: number;
      nextTargetIndex: number;
      transition: Act5PeriodTransition;
    }
  | { type: "complete" };

export const isAct5PeriodTransitionBoundary = (
  target: Act5SequenceTarget | null,
  nextTarget: Act5SequenceTarget | null,
) =>
  target?.context === "climateStory" &&
  nextTarget?.context === "climateStory" &&
  target.season === "autumn" &&
  target.interval !== nextTarget.interval;

export const getAct5EvaluationTransition = ({
  targets,
  currentTargetIndex,
  passed,
}: {
  targets: Act5SequenceTarget[];
  currentTargetIndex: number;
  passed: boolean;
}): Act5EvaluationTransition => {
  if (!passed) {
    return { type: "retry", targetIndex: currentTargetIndex };
  }

  const target = targets[currentTargetIndex] ?? null;
  const nextTargetIndex = currentTargetIndex + 1;
  const nextTarget = targets[nextTargetIndex] ?? null;

  if (!nextTarget) return { type: "complete" };

  if (isAct5PeriodTransitionBoundary(target, nextTarget)) {
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
