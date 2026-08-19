import { computed } from "vue";
import { useAct4Store } from "~/store/act4";
import type { Act4Recognition } from "~/composables/act4/useAct4Recognition";
import type { Act4ClimateChartMeasureEvaluation } from "~/types/act4";
import type {
  ClimateMovementFlowStep,
  ClimateSeasonDataRow,
} from "~/types/climate";

export const useAct4ChartModel = ({
  rows,
  recognition,
}: {
  rows: { value: ClimateSeasonDataRow[] };
  recognition: Act4Recognition;
}) => {
  const store = useAct4Store();

  const activeClimateStep = computed<ClimateMovementFlowStep | null>(
    () => store.currentTarget?.climateData ?? null,
  );
  const measureEvaluations = computed<Act4ClimateChartMeasureEvaluation[]>(
    () =>
      store.currentTarget?.context === "climateStory"
        ? recognition.cycleEvaluations.value.map((evaluation) => ({
            measureIndex: evaluation.measureIndex,
            result: evaluation.result,
          }))
        : [],
  );
  const requiredSuccessfulRepetitions = computed(
    () => store.currentRequiredSuccessfulMeasures,
  );

  return {
    rows,
    phase: computed(() => store.phase),
    flowId: computed(() => store.flowId),
    sequenceStatus: computed(() => store.sequenceStatus),
    activeStep: activeClimateStep,
    activeTargetIndex: computed(() => store.currentTargetIndex),
    attemptNumber: computed(() => store.attempt.attemptNumber),
    completedStepIds: computed(() => store.climateCompletedStepIds),
    periodTransition: computed(() => store.periodTransition),
    measureEvaluations,
    requiredSuccessfulRepetitions,
  };
};
