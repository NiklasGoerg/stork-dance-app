import type {
  LandmarkFrame,
  MovementRecording,
  MovementStageLandmark,
} from "~/types/movement";

const relevantBodyLandmarkIndices = [
  0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
];

const minVisibility = 0.25;

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type NormalizeOptions = {
  targetAspect?: number;
  paddingRatio?: number;
};

const isUsableLandmark = (landmark: MovementStageLandmark | undefined) =>
  !!landmark &&
  Number.isFinite(landmark.x) &&
  Number.isFinite(landmark.y) &&
  (landmark.visibility === undefined || landmark.visibility >= minVisibility);

const interpolateNumber = (from = 0, to = from, progress: number) =>
  from + (to - from) * progress;

const interpolateLandmark = (
  from: MovementStageLandmark | undefined,
  to: MovementStageLandmark | undefined,
  progress: number,
): MovementStageLandmark => {
  const start = from ?? to;
  const end = to ?? from;

  return {
    x: interpolateNumber(start?.x, end?.x, progress),
    y: interpolateNumber(start?.y, end?.y, progress),
    z: interpolateNumber(start?.z, end?.z, progress),
    visibility:
      start?.visibility !== undefined || end?.visibility !== undefined
        ? interpolateNumber(start?.visibility, end?.visibility, progress)
        : undefined,
  };
};

// Finds the visible body bounds across the whole recording before viewport fitting.
const calculateMovementBounds = (recording: MovementRecording) => {
  const bounds = recording.frames.reduce<Bounds | null>(
    (currentBounds, frame) => {
      const nextBounds = currentBounds ?? {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      };

      for (const index of relevantBodyLandmarkIndices) {
        const landmark = frame.landmarks[index];

        if (!isUsableLandmark(landmark)) continue;

        nextBounds.minX = Math.min(nextBounds.minX, landmark.x);
        nextBounds.minY = Math.min(nextBounds.minY, landmark.y);
        nextBounds.maxX = Math.max(nextBounds.maxX, landmark.x);
        nextBounds.maxY = Math.max(nextBounds.maxY, landmark.y);
      }

      return nextBounds;
    },
    null,
  );

  if (
    !bounds ||
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.minY) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.maxY)
  ) {
    return null;
  }

  return bounds;
};

// Expands the source bounds to the target aspect ratio without cropping the motion.
const expandBoundsToAspect = (
  bounds: Bounds,
  targetAspect: number,
  paddingRatio: number,
) => {
  const width = Math.max(bounds.maxX - bounds.minX, 0.001);
  const height = Math.max(bounds.maxY - bounds.minY, 0.001);
  const paddingX = width * paddingRatio;
  const paddingY = height * paddingRatio;
  const paddedBounds = {
    minX: bounds.minX - paddingX,
    maxX: bounds.maxX + paddingX,
    minY: bounds.minY - paddingY,
    maxY: bounds.maxY + paddingY,
  };
  const paddedWidth = paddedBounds.maxX - paddedBounds.minX;
  const paddedHeight = paddedBounds.maxY - paddedBounds.minY;
  const paddedAspect = paddedWidth / paddedHeight;

  if (paddedAspect > targetAspect) {
    const targetHeight = paddedWidth / targetAspect;
    const extraHeight = targetHeight - paddedHeight;

    return {
      ...paddedBounds,
      minY: paddedBounds.minY - extraHeight / 2,
      maxY: paddedBounds.maxY + extraHeight / 2,
    };
  }

  const targetWidth = paddedHeight * targetAspect;
  const extraWidth = targetWidth - paddedWidth;

  return {
    ...paddedBounds,
    minX: paddedBounds.minX - extraWidth / 2,
    maxX: paddedBounds.maxX + extraWidth / 2,
  };
};

// Maps recorded landmarks into a stable viewport so avatar size does not jump per frame.
export const normalizeMovementRecordingToViewport = (
  recording: MovementRecording,
  { targetAspect = 16 / 9, paddingRatio = 0.08 }: NormalizeOptions = {},
): MovementRecording => {
  const sourceBounds = calculateMovementBounds(recording);

  if (!sourceBounds) return recording;

  const bounds = expandBoundsToAspect(sourceBounds, targetAspect, paddingRatio);
  const width = Math.max(bounds.maxX - bounds.minX, 0.001);
  const height = Math.max(bounds.maxY - bounds.minY, 0.001);

  return {
    ...recording,
    source: {
      width: Math.round(targetAspect * 1000),
      height: 1000,
    },
    frames: recording.frames.map((frame) => ({
      ...frame,
      landmarks: frame.landmarks.map((landmark) => ({
        ...landmark,
        x: (landmark.x - bounds.minX) / width,
        y: (landmark.y - bounds.minY) / height,
      })),
    })),
  };
};

// Samples a recording at arbitrary source time for beat-synchronized gesture playback.
export const getInterpolatedMovementFrame = (
  recording: MovementRecording,
  sourceTimeMs: number,
): LandmarkFrame | null => {
  const frames = recording.frames;

  if (!frames.length) return null;

  const firstFrame = frames[0];
  const lastFrame = frames[frames.length - 1];
  const sourceFrameTime = (firstFrame.time ?? 0) + Math.max(0, sourceTimeMs);

  if (sourceFrameTime <= firstFrame.time) {
    return {
      time: sourceTimeMs,
      landmarks: firstFrame.landmarks,
    };
  }

  if (sourceFrameTime >= lastFrame.time) {
    return {
      time: sourceTimeMs,
      landmarks: lastFrame.landmarks,
    };
  }

  const nextFrameIndex = frames.findIndex(
    (frame) => frame.time >= sourceFrameTime,
  );

  if (nextFrameIndex <= 0) return firstFrame;

  const previousFrame = frames[nextFrameIndex - 1];
  const nextFrame = frames[nextFrameIndex];
  const frameDuration = Math.max(nextFrame.time - previousFrame.time, 1);
  const progress = (sourceFrameTime - previousFrame.time) / frameDuration;
  const landmarkCount = Math.max(
    previousFrame.landmarks.length,
    nextFrame.landmarks.length,
  );

  return {
    time: sourceTimeMs,
    landmarks: Array.from({ length: landmarkCount }, (_, index) =>
      interpolateLandmark(
        previousFrame.landmarks[index],
        nextFrame.landmarks[index],
        progress,
      ),
    ),
  };
};
