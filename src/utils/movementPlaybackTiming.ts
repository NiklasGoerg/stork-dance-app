import type {
  MovementLoopRegion,
  MovementPlaybackTiming,
  MovementRecording,
} from "~/types/movement";

export type MovementPlaybackPosition = {
  sourceTimeMs: number;
  loopCount: number;
  isPreroll: boolean;
  loopRegion: MovementLoopRegion;
};

export const getMovementRecordingDurationMs = (
  recording: MovementRecording,
) => {
  const firstFrameTime = recording.frames[0]?.time;
  const lastFrameTime = recording.frames.at(-1)?.time;

  if (Number.isFinite(firstFrameTime) && Number.isFinite(lastFrameTime)) {
    return Math.max((lastFrameTime ?? 0) - (firstFrameTime ?? 0), 1);
  }

  return Math.max(
    ((recording.frames.length - 1) * 1_000) / Math.max(recording.fps || 30, 1),
    1,
  );
};

export const normalizeMovementRecordingFrameTimes = (
  recording: MovementRecording,
): MovementRecording => {
  const hasCompleteTimestamps = recording.frames.every((frame) =>
    Number.isFinite(frame.time),
  );

  if (hasCompleteTimestamps) return recording;

  const frameDurationMs = 1_000 / Math.max(recording.fps || 30, 1);

  return {
    ...recording,
    frames: recording.frames.map((frame, frameIndex) => ({
      ...frame,
      time: frameIndex * frameDurationMs,
    })),
  };
};

export const resolveMovementPlaybackPosition = ({
  elapsedMs,
  sourceDurationMs,
  timing,
}: {
  elapsedMs: number;
  sourceDurationMs: number;
  timing: MovementPlaybackTiming;
}): MovementPlaybackPosition => {
  const durationMs = Math.max(sourceDurationMs, 1);
  const prerollMs = Math.min(Math.max(timing.prerollMs, 0), durationMs);
  const loopStartMs = Math.min(
    Math.max(timing.loopStartMs, prerollMs),
    durationMs,
  );
  const loopEndMs = Math.min(
    Math.max(timing.loopEndMs, loopStartMs + 1),
    durationMs,
  );
  const loopDurationMs = Math.max(loopEndMs - loopStartMs, 1);
  const normalizedElapsedMs = Math.max(elapsedMs, 0);

  if (normalizedElapsedMs < prerollMs) {
    return {
      sourceTimeMs: normalizedElapsedMs,
      loopCount: 0,
      isPreroll: true,
      loopRegion: { startMs: loopStartMs, endMs: loopEndMs },
    };
  }

  const movementElapsedMs = normalizedElapsedMs - prerollMs;

  return {
    sourceTimeMs: loopStartMs + (movementElapsedMs % loopDurationMs),
    loopCount: Math.floor(movementElapsedMs / loopDurationMs),
    isPreroll: false,
    loopRegion: { startMs: loopStartMs, endMs: loopEndMs },
  };
};
