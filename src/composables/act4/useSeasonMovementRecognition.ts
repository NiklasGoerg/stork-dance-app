import type {
  MovementBeatEvaluationLike,
  UseBeatWindowMovementRecognitionOptions,
} from "~/types/movement";
import { useBeatWindowMovementRecognition } from "~/composables/act4/useBeatWindowMovementRecognition";
import {
  ACT4_BEATS,
  ACT4_BEAT_TARGETS_MS,
  ACT4_EVALUATED_MEASURES,
  ACT4_EVALUATION_WINDOW_MS,
  ACT4_REQUIRED_SUCCESSFUL_MEASURES,
  ACT4_VARIATION_DURATION_MS,
  type Act4Beat,
} from "~/utils/act4/recognitionConfig";

type SequenceEvaluationLike<
  TBeatEvaluation extends MovementBeatEvaluationLike,
  TFeedback extends string,
> = {
  passed: boolean;
  resultState: string;
  totalScore: number;
  beatEvaluations: TBeatEvaluation[];
  feedbackCode?: TFeedback;
  primaryFeedbackCode?: TFeedback;
};

type SharedSeasonRecognitionKeys =
  | "beatTargetsMs"
  | "beats"
  | "evaluationWindowMs"
  | "variationDurationMs"
  | "measuresPerValue"
  | "requiredSuccessfulMeasures";

export type SeasonMovementRecognitionOptions<
  TBeat extends Act4Beat,
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
  TBeat extends Act4Beat,
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
    beatTargetsMs: options.beatTargetsMs ?? ACT4_BEAT_TARGETS_MS,
    beats: options.beats ?? (ACT4_BEATS as TBeat[]),
    evaluationWindowMs: options.evaluationWindowMs ?? ACT4_EVALUATION_WINDOW_MS,
    variationDurationMs:
      options.variationDurationMs ?? ACT4_VARIATION_DURATION_MS,
    measuresPerValue: options.measuresPerValue ?? ACT4_EVALUATED_MEASURES,
    requiredSuccessfulMeasures:
      options.requiredSuccessfulMeasures ?? ACT4_REQUIRED_SUCCESSFUL_MEASURES,
  });
