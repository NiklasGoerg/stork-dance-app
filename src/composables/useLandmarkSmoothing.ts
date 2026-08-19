import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

type SmoothingLandmark = NormalizedLandmark & {
  presence?: number;
};

type LandmarkSmoothingOptions = {
  alpha: number;
  zAlpha: number;
  lowConfidenceAlpha: number;
  minVisibility: number;
  minPresence: number;
  maxMissingFrames: number;
};

const DEFAULT_OPTIONS: LandmarkSmoothingOptions = {
  alpha: 0.38,
  zAlpha: 0.28,
  lowConfidenceAlpha: 0.1,
  minVisibility: 0.55,
  minPresence: 0.55,
  maxMissingFrames: 4,
};

const lerp = (from: number, to: number, alpha: number) =>
  from + (to - from) * alpha;

const cloneLandmark = (landmark: SmoothingLandmark): SmoothingLandmark => ({
  x: landmark.x,
  y: landmark.y,
  z: landmark.z,
  visibility: landmark.visibility,
  presence: landmark.presence,
});

const isReliableLandmark = (
  landmark: SmoothingLandmark,
  options: LandmarkSmoothingOptions,
) => {
  const visibilityOk =
    landmark.visibility === undefined ||
    landmark.visibility >= options.minVisibility;

  const presenceOk =
    landmark.presence === undefined || landmark.presence >= options.minPresence;

  return visibilityOk && presenceOk;
};

export const useLandmarkSmoothing = (
  customOptions: Partial<LandmarkSmoothingOptions> = {},
) => {
  const options: LandmarkSmoothingOptions = {
    ...DEFAULT_OPTIONS,
    ...customOptions,
  };

  let previous: SmoothingLandmark[] | null = null;
  let missingFrames = 0;

  const reset = () => {
    previous = null;
    missingFrames = 0;
  };

  const smoothLandmarks = (
    landmarks?: SmoothingLandmark[],
  ): SmoothingLandmark[] | null => {
    if (!landmarks?.length) {
      missingFrames += 1;

      if (missingFrames > options.maxMissingFrames) {
        previous = null;
        return null;
      }

      return previous ? previous.map(cloneLandmark) : null;
    }

    missingFrames = 0;

    if (!previous || previous.length !== landmarks.length) {
      previous = landmarks.map(cloneLandmark);
      return previous.map(cloneLandmark);
    }

    const smoothed = landmarks.map((current, index) => {
      const prev = previous?.[index] ?? current;
      const isReliable = isReliableLandmark(current, options);

      const xyAlpha = isReliable ? options.alpha : options.lowConfidenceAlpha;
      const depthAlpha = isReliable
        ? options.zAlpha
        : options.lowConfidenceAlpha;

      return {
        x: lerp(prev.x, current.x, xyAlpha),
        y: lerp(prev.y, current.y, xyAlpha),
        z: lerp(prev.z, current.z, depthAlpha),
        visibility: current.visibility,
        presence: current.presence,
      } satisfies SmoothingLandmark;
    });

    previous = smoothed;

    return smoothed.map(cloneLandmark);
  };

  return {
    smoothLandmarks,
    reset,
    options,
  };
};
