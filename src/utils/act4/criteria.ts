import type {
  MovementCriterionResult,
  MovementRecognitionResult,
} from "~/types/act4";

export const createMovementCriterionResult = <
  TFeedbackCode extends string = string,
  TExtra extends Record<string, unknown> = Record<string, never>,
>({
  id,
  label,
  passed,
  score,
  importance,
  evaluable = true,
  feedbackCode,
  extra,
}: {
  id: string;
  label: string;
  passed: boolean;
  score?: number;
  importance: "essential" | "supporting";
  evaluable?: boolean;
  feedbackCode?: TFeedbackCode;
  extra?: TExtra;
}): MovementCriterionResult<TFeedbackCode> & TExtra => ({
  id,
  label,
  status: evaluable ? (passed ? "passed" : "failed") : "notEvaluable",
  passed: evaluable && passed,
  score: score ?? (evaluable && passed ? 1 : 0),
  importance,
  feedbackCode: evaluable && !passed ? feedbackCode : undefined,
  ...(extra ?? ({} as TExtra)),
});

type Act4CriterionDebugValue = number | string | undefined;
type Act4CriterionImportance = "essential" | "supporting";
type NullishDebugValueMode = "stringify" | "omit";

export type Act4SeasonCriterionInput<
  TImportance extends Act4CriterionImportance = Act4CriterionImportance,
  TFeedbackCode extends string = string,
  TValue extends number | string | boolean | null | undefined =
    number | string | boolean | null | undefined,
> = {
  id: string;
  label: string;
  importance: TImportance;
  value: TValue;
  passed: boolean;
  expectedRange?: string;
  feedbackCode?: TFeedbackCode;
};

export const roundCriterionDebugValue = (value: number) =>
  !Number.isFinite(value) ? "n/a" : Number(value.toFixed(2));

const getCriterionDebugValue = ({
  value,
  nullishDebugValue,
  stringifyNonNumericDebugValue,
}: {
  value: number | string | boolean | null | undefined;
  nullishDebugValue: NullishDebugValueMode;
  stringifyNonNumericDebugValue: boolean;
}): Act4CriterionDebugValue => {
  if (typeof value === "number") return roundCriterionDebugValue(value);

  if (value === null || value === undefined) {
    return nullishDebugValue === "omit" ? undefined : String(value);
  }

  if (typeof value === "boolean") return String(value);

  return stringifyNonNumericDebugValue ? String(value) : value;
};

export const createAct4SeasonCriterionResult = <
  TFeedbackCode extends string,
  TExtra extends Record<string, unknown> = Record<string, never>,
>({
  id,
  label,
  importance,
  value,
  passed,
  expectedRange,
  feedbackCode,
  extra,
  nullishDebugValue = "stringify",
  stringifyNonNumericDebugValue = true,
}: {
  id: string;
  label: string;
  importance: "essential" | "supporting";
  value: number | string | boolean | null | undefined;
  passed: boolean;
  expectedRange?: string;
  feedbackCode?: TFeedbackCode;
  extra?: TExtra;
  nullishDebugValue?: NullishDebugValueMode;
  stringifyNonNumericDebugValue?: boolean;
}): MovementCriterionResult<TFeedbackCode> & {
  debugValue?: number | string;
  expectedRange?: string;
} & TExtra => {
  const evaluable =
    value !== null && value !== undefined && value !== "unknown";

  return createMovementCriterionResult({
    id,
    label,
    passed,
    score: evaluable && passed ? 1 : 0,
    importance,
    evaluable,
    feedbackCode,
    extra: {
      debugValue: getCriterionDebugValue({
        value,
        nullishDebugValue,
        stringifyNonNumericDebugValue,
      }),
      expectedRange,
      ...(extra ?? ({} as TExtra)),
    } as {
      debugValue?: number | string;
      expectedRange?: string;
    } & TExtra,
  });
};

export const createAct4SeasonCriterionFactory =
  <
    TImportance extends Act4CriterionImportance,
    TFeedbackCode extends string,
    TResult extends MovementCriterionResult<TFeedbackCode> & {
      debugValue?: number | string;
      expectedRange?: string;
    },
    TInput extends Act4SeasonCriterionInput<TImportance, TFeedbackCode> =
      Act4SeasonCriterionInput<TImportance, TFeedbackCode>,
    TExtra extends Record<string, unknown> = Record<string, never>,
  >({
    nullishDebugValue = "stringify",
    stringifyNonNumericDebugValue = true,
    getExtra,
  }: {
    nullishDebugValue?: NullishDebugValueMode;
    stringifyNonNumericDebugValue?: boolean;
    getExtra?: (input: TInput) => TExtra;
  } = {}) =>
  (input: TInput): TResult =>
    createAct4SeasonCriterionResult({
      ...input,
      extra: getExtra?.(input),
      nullishDebugValue,
      stringifyNonNumericDebugValue,
    }) as unknown as TResult;

export const getHighestPriorityFailedCriterion = <
  TCriterion extends {
    id: string;
    status: "passed" | "failed" | "notEvaluable";
    feedbackCode?: TFeedbackCode;
  },
  TFeedbackCode extends string = string,
>(
  criteria: TCriterion[],
  priorityOrder: readonly string[],
) => {
  const failedCriteria = criteria.filter(
    (criterion) => criterion.status === "failed" && criterion.feedbackCode,
  );

  return (
    priorityOrder
      .map((id) => failedCriteria.find((criterion) => criterion.id === id))
      .find(Boolean) ??
    failedCriteria[0] ??
    null
  );
};

export const createMovementRecognitionResult = <
  TFeedbackCode extends string = string,
>({
  passed,
  score,
  status,
  feedbackCode,
  criteria,
}: MovementRecognitionResult<TFeedbackCode>): MovementRecognitionResult<TFeedbackCode> => ({
  passed,
  score,
  status,
  feedbackCode,
  criteria,
});
