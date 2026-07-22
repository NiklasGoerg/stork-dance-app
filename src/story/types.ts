import type { StorkStoryCycleDefinition } from "~/types/stork";

export type StoryActId =
  | "prologue"
  | "act-2"
  | "act-3"
  | "act-4"
  | "act-5"
  | "epilogue";

export type StoryLayoutType =
  | "migration-stage"
  | "movement-only"
  | "climate-stage"
  | "fullscreen";

export type StoryPlaybackState =
  | "idle"
  | "playing"
  | "paused"
  | "waiting-for-gate"
  | "completed";

export type PoseLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type RecordedPoseFrame = {
  time: number;
  landmarks: PoseLandmark[];
};

export type RecordedMovement = {
  name: string;
  fps: number;
  createdAt: string;
  source?: {
    width: number;
    height: number;
  };
  frames: RecordedPoseFrame[];
};

export type MovementMatchState = "idle" | "waiting" | "matched" | "failed";

export type MovementRequirement = {
  id: string;
  feature: string;
  operator: ">" | "<" | "between";
  value: number | [number, number];
  holdMs?: number;
};

export type StoryScene = {
  id: string;
  title: string;
  durationMs?: number;
  narration?: string;
  movementId?: string;
  audioCueId?: string;
  feedbackCueId?: string;
};

export type StoryMigrationCycle = {
  id: string;
  cycleId: string;
  cycleStartYear?: number;
  cycleDurationMs?: number;
  title?: string;
  storyCycleDefinitions?: StorkStoryCycleDefinition[];
};

export type StoryAct = {
  id: StoryActId;
  title: string;
  layout: StoryLayoutType;
  scenes: StoryScene[];
  nextActId?: StoryActId;
  cycleId?: string;
  cycleStartYear?: number;
  cycleDurationMs?: number;
  repeatCount?: number;
  instructorMovementId?: string;
  bpm?: number;
  migrationCycles?: StoryMigrationCycle[];
};

export type StoryEvent =
  | { type: "movement.matched"; movementId: string }
  | { type: "feedback.show"; feedbackId: string }
  | { type: "audio.metronome.start"; bpm: number }
  | { type: "act.completed"; actId: StoryActId }
  | { type: "gate.continue"; actId: StoryActId };
