export interface PosePredicateResult<TMetrics> {
  passed: boolean;
  score: number;
  evaluable: boolean;
  metrics: TMetrics;
  failedConditions: readonly string[];
}
