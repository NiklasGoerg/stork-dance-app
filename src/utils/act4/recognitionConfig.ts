export type Act4Beat = 1 | 2 | 3 | 4;

export const ACT4_BEATS: Act4Beat[] = [1, 2, 3, 4];

export const ACT4_BEAT_TARGETS_MS: Record<Act4Beat, number> = {
  1: 0,
  2: 1000,
  3: 2000,
  4: 3000,
};

export const ACT4_EVALUATION_WINDOW_MS = 350;
export const ACT4_VARIATION_DURATION_MS = 4000;
export const ACT4_EVALUATED_MEASURES = 3;
export const ACT4_REQUIRED_SUCCESSFUL_MEASURES = 2;

export const isAct4SuccessfulMeasureResult = (result: string) =>
  result === "success" ||
  result === "almostCorrect" ||
  result === "autoProgress";
