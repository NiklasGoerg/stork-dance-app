export type Act5Beat = 1 | 2 | 3 | 4;

export const ACT5_BEATS: Act5Beat[] = [1, 2, 3, 4];

export const ACT5_BEAT_TARGETS_MS: Record<Act5Beat, number> = {
  1: 0,
  2: 1000,
  3: 2000,
  4: 3000,
};

export const ACT5_EVALUATION_WINDOW_MS = 350;
export const ACT5_VARIATION_DURATION_MS = 4000;
export const ACT5_EVALUATED_MEASURES = 3;
export const ACT5_REQUIRED_SUCCESSFUL_MEASURES = 2;

export const isAct5SuccessfulMeasureResult = (result: string) =>
  result === "success" ||
  result === "almostCorrect" ||
  result === "autoProgress";
