import {
  useBeatWindowMovementRecognition,
  type MovementBeatEvaluationLike,
  type UseBeatWindowMovementRecognitionOptions,
} from "~/composables/useBeatWindowMovementRecognition";
import {
  ACT5_BEATS,
  ACT5_BEAT_TARGETS_MS,
  ACT5_EVALUATED_MEASURES,
  ACT5_EVALUATION_WINDOW_MS,
  ACT5_REQUIRED_SUCCESSFUL_MEASURES,
  ACT5_VARIATION_DURATION_MS,
  type Act5Beat,
} from "~/features/act5/movements/recognitionConfig";

type SequenceEvaluationLike<
  TBeatEvaluation extends MovementBeatEvaluationLike,
  TFeedback extends string,
> = {
  passed: boolean;
  resultState: string;
  totalScore: number;
  beatEvaluations: TBeatEvaluation[];
  feedbackCode?: TFeedback;
};

type SharedSeasonRecognitionKeys =
  | "beatTargetsMs"
  | "beats"
  | "evaluationWindowMs"
  | "variationDurationMs"
  | "measuresPerValue"
  | "requiredSuccessfulMeasures";

export type SeasonMovementRecognitionOptions<
  TBeat extends Act5Beat,
  TValue extends string,
  TMetrics,
  TFeedback extends string,
  TBeatEvaluation extends MovementBeatEvaluationLike<
    TBeat,
    TMetrics,
    TFeedback
  >,
  TSequenceEvaluation extends SequenceEvaluationLike<
    TBeatEvaluation,
    TFeedback
  >,
> = Omit<
  UseBeatWindowMovementRecognitionOptions<
    TBeat,
    TValue,
    TMetrics,
    TFeedback,
    TBeatEvaluation,
    TSequenceEvaluation
  >,
  SharedSeasonRecognitionKeys
> &
  Partial<
    Pick<
      UseBeatWindowMovementRecognitionOptions<
        TBeat,
        TValue,
        TMetrics,
        TFeedback,
        TBeatEvaluation,
        TSequenceEvaluation
      >,
      SharedSeasonRecognitionKeys
    >
  >;

export const useSeasonMovementRecognition = <
  TBeat extends Act5Beat,
  TValue extends string,
  TMetrics,
  TFeedback extends string,
  TBeatEvaluation extends MovementBeatEvaluationLike<
    TBeat,
    TMetrics,
    TFeedback
  >,
  TSequenceEvaluation extends SequenceEvaluationLike<
    TBeatEvaluation,
    TFeedback
  >,
>(
  options: SeasonMovementRecognitionOptions<
    TBeat,
    TValue,
    TMetrics,
    TFeedback,
    TBeatEvaluation,
    TSequenceEvaluation
  >,
) =>
  useBeatWindowMovementRecognition<
    TBeat,
    TValue,
    TMetrics,
    TFeedback,
    TBeatEvaluation,
    TSequenceEvaluation
  >({
    ...options,
    beatTargetsMs: options.beatTargetsMs ?? ACT5_BEAT_TARGETS_MS,
    beats: options.beats ?? (ACT5_BEATS as TBeat[]),
    evaluationWindowMs: options.evaluationWindowMs ?? ACT5_EVALUATION_WINDOW_MS,
    variationDurationMs:
      options.variationDurationMs ?? ACT5_VARIATION_DURATION_MS,
    measuresPerValue: options.measuresPerValue ?? ACT5_EVALUATED_MEASURES,
    requiredSuccessfulMeasures:
      options.requiredSuccessfulMeasures ?? ACT5_REQUIRED_SUCCESSFUL_MEASURES,
  });
