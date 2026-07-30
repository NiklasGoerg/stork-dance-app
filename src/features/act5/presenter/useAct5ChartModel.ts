import { computed } from "vue";
import { useAct5Store } from "~/store/act5Store";
import type { Act5RecognitionAdapter } from "~/features/act5/recognition/useAct5RecognitionAdapter";
import type { Act5ClimateChartMeasureEvaluation } from "~/types/act5ClimateChart";
import type {
  ClimateMovementFlowStep,
  ClimateSeasonDataRow,
} from "~/utils/movement/acts/climate/climateSeasonData";

export const useAct5ChartModel = ({
  rows,
  recognition,
}: {
  rows: { value: ClimateSeasonDataRow[] };
  recognition: Act5RecognitionAdapter;
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
