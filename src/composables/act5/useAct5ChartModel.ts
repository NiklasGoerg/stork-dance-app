import { computed } from "vue";
import { useAct5Store } from "~/store/act5";
import type { Act5Recognition } from "~/composables/act5/useAct5Recognition";
import type { Act5ClimateChartMeasureEvaluation } from "~/types/act5";
import type {
  ClimateMovementFlowStep,
  ClimateSeasonDataRow,
} from "~/types/climate";

export const useAct5ChartModel = ({
  rows,
  recognition,
}: {
  rows: { value: ClimateSeasonDataRow[] };
  recognition: Act5Recognition;
}) => {
  const store = useAct5Store();

  const activeClimateStep = computed<ClimateMovementFlowStep | null>(
    () => store.currentTarget?.climateData ?? null,
  );
  const measureEvaluations = computed<Act5ClimateChartMeasureEvaluation[]>(
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
