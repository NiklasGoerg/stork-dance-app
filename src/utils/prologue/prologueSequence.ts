export type PrologueVisualState = "stork" | "map";

export type PrologueNarrationSegment = {
  id: string;
  textKey: string;
  visualState: PrologueVisualState;
};

export const PROLOGUE_MIGRATION_CYCLE_ID = "individual_3339_2016_2017";

export const PROLOGUE_SEGMENT_PAUSE_MS = 450;

export const prologueNarrationSegments = [
  {
    id: "white-stork",
    textKey: "story.acts.prologue.narration.whiteStork",
    visualState: "stork",
  },
  {
    id: "migration-distance",
    textKey: "story.acts.prologue.narration.migrationDistance",
    visualState: "stork",
  },
  {
    id: "journeys-change",
    textKey: "story.acts.prologue.narration.journeysChange",
    visualState: "map",
  },
  {
    id: "environmental-question",
    textKey: "story.acts.prologue.narration.environmentalQuestion",
    visualState: "map",
  },
  {
    id: "real-data",
    textKey: "story.acts.prologue.narration.realData",
    visualState: "map",
  },
  {
    id: "embodied-story",
    textKey: "story.acts.prologue.narration.embodiedStory",
    visualState: "map",
  },
] as const satisfies readonly PrologueNarrationSegment[];

export const getPrologueVisualStateForSegmentIndex = (
  segmentIndex: number,
): PrologueVisualState =>
  prologueNarrationSegments[segmentIndex]?.visualState ?? "map";
