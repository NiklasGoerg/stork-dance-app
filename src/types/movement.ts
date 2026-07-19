import type {
  PoseLandmark,
  RecordedMovement,
  RecordedPoseFrame,
} from "~/story/types";

export type AvatarSourceMode = "live-camera" | "recorded-motion";

export type MovementStageLandmark = PoseLandmark;

export type LandmarkFrame = RecordedPoseFrame;

export type MovementRecording = RecordedMovement;
