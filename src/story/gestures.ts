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
  textKey?: string;
};

export type GestureCheckpoint = {
  id: string;
  poseId: StoryPoseId;
  label: string;
  labelKey?: string;
  hint: string;
  hintKey?: string;
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
  labelKey?: string;
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
  labelKey: "gestures.departure.label",
  bpm: 60,
  durationBeats: 6,
  movementId: "departure-gesture",
  timing: migrationGestureTiming,
  beatCues: [
    {
      sourceStartMs: 0,
      sourceEndMs: 1000,
      text: "Crouch down",
      textKey: "gestures.departure.beatCues.crouchDown",
    },
    {
      sourceStartMs: 1000,
      sourceEndMs: 2000,
      text: "Reach up",
      textKey: "gestures.departure.beatCues.reachUp",
    },
    {
      sourceStartMs: 2000,
      sourceEndMs: 3000,
      text: "Guide your arms",
      textKey: "gestures.departure.beatCues.guideYourArms",
    },
    {
      sourceStartMs: 3000,
      sourceEndMs: 4000,
      text: "Return",
      textKey: "gestures.departure.beatCues.return",
    },
  ],
  checkpoints: [
    {
      id: "departure-crouch",
      poseId: "crouch",
      label: "Crouch",
      labelKey: "gestures.departure.checkpoints.crouch.label",
      hint: "Sink low on the first beat.",
      hintKey: "gestures.departure.checkpoints.crouch.hint",
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
      labelKey: "gestures.departure.checkpoints.extend.label",
      hint: "Open into the departure shape.",
      hintKey: "gestures.departure.checkpoints.extend.hint",
      targetMovementTimeMs: 2000,
      targetBeat: 2,
      windowBeforeMs: 650,
      windowAfterMs: 950,
      requiredStableMs: 120,
      required: true,
    },
  ],
};

export const arrivalGesture: StoryGestureDefinition = {
  id: "arrival",
  label: "Arrival",
  labelKey: "gestures.arrival.label",
  bpm: 60,
  durationBeats: 6,
  movementId: "arrival-gesture",
  timing: migrationGestureTiming,
  beatCues: [
    {
      sourceStartMs: 0,
      sourceEndMs: 1000,
      text: "Open your arms",
      textKey: "gestures.arrival.beatCues.openArms",
    },
    {
      sourceStartMs: 1000,
      sourceEndMs: 2000,
      text: "Hold open",
      textKey: "gestures.arrival.beatCues.holdOpen",
    },
    {
      sourceStartMs: 2000,
      sourceEndMs: 3000,
      text: "Crouch down",
      textKey: "gestures.arrival.beatCues.crouchDown",
    },
    {
      sourceStartMs: 3000,
      sourceEndMs: 4000,
      text: "Hold the crouch",
      textKey: "gestures.arrival.beatCues.holdCrouch",
    },
  ],
  checkpoints: [
    {
      id: "arrival-open",
      poseId: "arrival-open",
      label: "Open",
      labelKey: "gestures.arrival.checkpoints.open.label",
      hint: "Open your arms for arrival.",
      hintKey: "gestures.arrival.checkpoints.open.hint",
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
      labelKey: "gestures.arrival.checkpoints.crouch.label",
      hint: "Sink into the landing shape.",
      hintKey: "gestures.arrival.checkpoints.crouch.hint",
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
