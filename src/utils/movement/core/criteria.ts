export type MovementCriterionStatus = "passed" | "failed" | "notEvaluable";
export type MovementCriterionImportance = "essential" | "supporting";

export type MovementCriterionScoringInput = {
  status: MovementCriterionStatus;
  passed: boolean;
  importance: MovementCriterionImportance;
};

export const getMovementCriterionWeight = (
  importance: MovementCriterionImportance,
) => (importance === "essential" ? 2 : 1);

export const getWeightedCriteriaScore = <
  TCriterion extends MovementCriterionScoringInput,
>(
  criteria: TCriterion[],
) => {
  const evaluableCriteria = criteria.filter(
    (criterion) => criterion.status !== "notEvaluable",
  );
  const totalWeight = evaluableCriteria.reduce(
    (sum, criterion) => sum + getMovementCriterionWeight(criterion.importance),
    0,
  );
  const passedWeight = evaluableCriteria.reduce(
    (sum, criterion) =>
      sum +
      (criterion.passed ? getMovementCriterionWeight(criterion.importance) : 0),
    0,
  );

  return totalWeight > 0 ? (passedWeight / totalWeight) * 100 : 0;
};

export const getEssentialCriteriaStats = <
  TCriterion extends MovementCriterionScoringInput,
>(
  criteria: TCriterion[],
) => {
  const essentialCriteria = criteria.filter(
    (criterion) => criterion.importance === "essential",
  );
  const evaluableEssentialCriteria = essentialCriteria.filter(
    (criterion) => criterion.status !== "notEvaluable",
  );
  const passedEssentialCriteria = essentialCriteria.filter(
    (criterion) => criterion.passed,
  );

  return {
    totalCount: essentialCriteria.length,
    evaluableCount: evaluableEssentialCriteria.length,
    passedCount: passedEssentialCriteria.length,
  };
};

export const getBeatPassState = <
  TCriterion extends MovementCriterionScoringInput,
>({
  criteria,
  score,
  passScore,
}: {
  criteria: TCriterion[];
  score: number;
  passScore: number;
}) => {
  const essentialStats = getEssentialCriteriaStats(criteria);
  const trackingUnavailable =
    essentialStats.evaluableCount < Math.ceil(essentialStats.totalCount / 2);
  const passed =
    !trackingUnavailable &&
    essentialStats.passedCount === essentialStats.totalCount &&
    score >= passScore;

  return {
    trackingUnavailable,
    passed,
  };
};

export const getWeightedBeatEvaluationScore = <
  TBeat extends number | string,
  TEvaluation extends { beat: TBeat; score: number },
>(
  beatEvaluations: TEvaluation[],
  beatWeights: Record<TBeat, number>,
) => {
  const totalWeight = beatEvaluations.reduce(
    (sum, evaluation) => sum + beatWeights[evaluation.beat],
    0,
  );
  const weightedScore = beatEvaluations.reduce(
    (sum, evaluation) => sum + evaluation.score * beatWeights[evaluation.beat],
    0,
  );

  return totalWeight > 0 ? weightedScore / totalWeight : 0;
};
