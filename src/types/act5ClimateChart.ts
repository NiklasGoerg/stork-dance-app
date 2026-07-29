import type { MovementMeasureResult } from "~/composables/useBeatWindowMovementRecognition";
import type {
  ClimateMovementFlowStep,
  ClimateSeasonDataRow,
} from "~/utils/movement/acts/climate/climateSeasonData";
import type {
  Act5FlowId,
  Act5Phase,
} from "~/utils/movement/acts/climate/act5Flow";

export type Act5ClimateChartSequenceStatus =
  | "idle"
  | "performing"
  | "feedbackInterlude"
  | "previewingNext"
  | "storyIntro"
  | "periodTransition"
  | "completed";

export type Act5ClimateChartPeriodTransition = {
  previousPeriod: string;
  nextPeriod: string;
};

export type Act5ClimateChartMeasureEvaluation = {
  measureIndex: number;
  result: MovementMeasureResult;
};

export type Act5ClimateProgressChartProps = {
  rows: ClimateSeasonDataRow[];
  phase: Act5Phase | "idle";
  flowId: Act5FlowId | null;
  sequenceStatus: Act5ClimateChartSequenceStatus;
  activeStep: ClimateMovementFlowStep | null;
  activeTargetIndex: number;
  attemptNumber: number;
  periodTransition: Act5ClimateChartPeriodTransition | null;
  measureEvaluations: Act5ClimateChartMeasureEvaluation[];
  requiredSuccessfulRepetitions: number;
};
