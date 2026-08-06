export interface GuidedAct2TimingConfig {
  gestureHandoverStartBarOffsetMs: number;
  storyTransitionMs: {
    summerToDeparture: number;
    autumnMigration: number;
    winterToDeparture: number;
    springMigration: number;
  };
}

export const guidedAct2Timing: GuidedAct2TimingConfig = {
  gestureHandoverStartBarOffsetMs: 0,
  storyTransitionMs: {
    summerToDeparture: 12_000,
    autumnMigration: 12_000,
    winterToDeparture: 12_000,
    springMigration: 12_000,
  },
};

export const GUIDED_MOVEMENT_DEMONSTRATIONS = 3;
export const GUIDED_SUMMER_DEMONSTRATIONS = 4;
export const GUIDED_GESTURE_DEMONSTRATIONS = 2;
export const GUIDED_REQUIRED_SUCCESSFUL_BARS = 3;
