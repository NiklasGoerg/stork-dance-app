import type { StoryPoseId } from "~/types/pose";

export type { PoseEvaluationResult, StoryPoseId } from "~/types/pose";

export type StoryGestureId = "departure" | "arrival";

export type GestureInteractionState =
  | "inactive"
  | "loading-movement"
  | "waiting-for-lead-in"
  | "attempt-playing"
  | "retry-scheduled"
  | "success-exit"
  | "completed"
  | "cancelled";

export type GestureAttemptDecision = "pending" | "retry" | "success";

export type GesturePlaybackTiming = {
  leadInStartMs: number;
  beatOneMs: number;
  decisionDeadlineMs: number;
  branchPointMs: number;
  successEndMs: number;
  sourceDurationMs: number;
};

export type GestureBeatCue = {
  sourceStartMs: number;
  sourceEndMs: number;
  text: string;
};

export type GestureCheckpoint = {
  id: string;
  poseId: StoryPoseId;
  label: string;
  hint: string;
  targetMovementTimeMs: number;
  targetBeat: number;
  windowBeforeMs: number;
  windowAfterMs: number;
  requiredStableMs?: number;
  required: boolean;
};

export type StoryGestureDefinition = {
  id: StoryGestureId;
  label: string;
  bpm: number;
  durationBeats: number;
  movementId: string;
  timing: GesturePlaybackTiming;
  beatCues: GestureBeatCue[];
  checkpoints: GestureCheckpoint[];
};

export const migrationGestureTiming: GesturePlaybackTiming = {
  leadInStartMs: 0,
  beatOneMs: 1000,
  decisionDeadlineMs: 3800,
  branchPointMs: 4000,
  successEndMs: 5000,
  sourceDurationMs: 6000,
};

export const departureGesture: StoryGestureDefinition = {
  id: "departure",
  label: "Departure",
  bpm: 60,
  durationBeats: 6,
  movementId: "departure-gesture",
  timing: migrationGestureTiming,
  beatCues: [
    { sourceStartMs: 0, sourceEndMs: 1000, text: "Tief gehen" },
    { sourceStartMs: 1000, sourceEndMs: 2000, text: "Hoch strecken" },
    { sourceStartMs: 2000, sourceEndMs: 3000, text: "Arme führen" },
    { sourceStartMs: 3000, sourceEndMs: 4000, text: "Zurückführen" },
  ],
  checkpoints: [
    {
      id: "departure-crouch",
      poseId: "crouch",
      label: "Crouch",
      hint: "Sink low on the first beat.",
      targetMovementTimeMs: 1000,
      targetBeat: 1,
      windowBeforeMs: 450,
      windowAfterMs: 550,
      required: true,
    },
    {
      id: "departure-extended",
      poseId: "departure-extended",
      label: "Extend",
      hint: "Open into the departure shape.",
      targetMovementTimeMs: 2000,
      targetBeat: 2,
      windowBeforeMs: 450,
      windowAfterMs: 550,
      required: true,
    },
  ],
};

export const arrivalGesture: StoryGestureDefinition = {
  id: "arrival",
  label: "Arrival",
  bpm: 60,
  durationBeats: 6,
  movementId: "arrival-gesture",
  timing: migrationGestureTiming,
  beatCues: [
    { sourceStartMs: 0, sourceEndMs: 1000, text: "Arme öffnen" },
    { sourceStartMs: 1000, sourceEndMs: 2000, text: "Arme halten" },
    { sourceStartMs: 2000, sourceEndMs: 3000, text: "Tief gehen" },
    { sourceStartMs: 3000, sourceEndMs: 4000, text: "Hocke halten" },
  ],
  checkpoints: [
    {
      id: "arrival-open",
      poseId: "arrival-open",
      label: "Open",
      hint: "Open your arms for arrival.",
      targetMovementTimeMs: 1000,
      targetBeat: 1,
      windowBeforeMs: 450,
      windowAfterMs: 550,
      required: true,
    },
    {
      id: "arrival-crouch",
      poseId: "crouch",
      label: "Crouch",
      hint: "Sink into the landing shape.",
      targetMovementTimeMs: 3000,
      targetBeat: 3,
      windowBeforeMs: 450,
      windowAfterMs: 550,
      required: true,
    },
  ],
};

export const storyGestureDefinitions: Record<
  StoryGestureId,
  StoryGestureDefinition
> = {
  departure: departureGesture,
  arrival: arrivalGesture,
};

export const getStoryGestureDefinition = (id: StoryGestureId) =>
  storyGestureDefinitions[id];
