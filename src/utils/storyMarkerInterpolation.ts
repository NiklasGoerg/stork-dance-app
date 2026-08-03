import type { StorkDataPoint } from "~/types/stork";
import type { StoryTimelineDay } from "~/utils/storyCycle";

export const STORY_MARKER_UPDATE_FPS = 15;
export const STORY_MARKER_UPDATE_INTERVAL_MS = 1000 / STORY_MARKER_UPDATE_FPS;

export type StoryMarkerPosition = {
  lat: number;
  lng: number;
};

export type StoryMarkerInterpolationIssue =
  | "missing-current-point"
  | "invalid-current-coordinates"
  | "invalid-next-coordinates"
  | "cycle-mismatch";

export type StoryMarkerPositionResult = {
  position: StoryMarkerPosition | null;
  progress: number;
  shouldAnimate: boolean;
  issue: StoryMarkerInterpolationIssue | null;
};

const hasValidCoordinates = (
  point: StorkDataPoint | null | undefined,
): point is StorkDataPoint =>
  Boolean(
    point &&
    Number.isFinite(point.lat) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    Number.isFinite(point.lng) &&
    point.lng >= -180 &&
    point.lng <= 180,
  );

export const clampStoryMarkerProgress = (progress: number) =>
  Math.min(Math.max(Number.isFinite(progress) ? progress : 0, 0), 1);

export const linearInterpolateStoryMarkerPosition = (
  currentPoint: StoryMarkerPosition,
  nextPoint: StoryMarkerPosition,
  progress: number,
): StoryMarkerPosition => {
  const clampedProgress = clampStoryMarkerProgress(progress);

  return {
    lat:
      currentPoint.lat + (nextPoint.lat - currentPoint.lat) * clampedProgress,
    lng:
      currentPoint.lng + (nextPoint.lng - currentPoint.lng) * clampedProgress,
  };
};

export const resolveStoryMarkerPosition = ({
  cycleId,
  elapsedMs,
  currentDay,
  currentPoint,
  nextPoint,
}: {
  cycleId: string;
  elapsedMs: number;
  currentDay: StoryTimelineDay;
  currentPoint: StorkDataPoint | null | undefined;
  nextPoint: StorkDataPoint | null | undefined;
}): StoryMarkerPositionResult => {
  if (!currentPoint) {
    return {
      position: null,
      progress: 0,
      shouldAnimate: false,
      issue: "missing-current-point",
    };
  }

  if (!hasValidCoordinates(currentPoint)) {
    return {
      position: null,
      progress: 0,
      shouldAnimate: false,
      issue: "invalid-current-coordinates",
    };
  }

  if (currentPoint.story?.cycleId !== cycleId) {
    return {
      position: null,
      progress: 0,
      shouldAnimate: false,
      issue: "cycle-mismatch",
    };
  }

  const currentPosition = { lat: currentPoint.lat, lng: currentPoint.lng };

  if (!currentDay.isMigrationDay || !nextPoint) {
    return {
      position: currentPosition,
      progress: 0,
      shouldAnimate: false,
      issue: null,
    };
  }

  if (nextPoint.story?.cycleId !== cycleId) {
    return {
      position: currentPosition,
      progress: 0,
      shouldAnimate: false,
      issue: "cycle-mismatch",
    };
  }

  if (!hasValidCoordinates(nextPoint)) {
    return {
      position: currentPosition,
      progress: 0,
      shouldAnimate: false,
      issue: "invalid-next-coordinates",
    };
  }

  const progress = clampStoryMarkerProgress(
    currentDay.dayDurationMs > 0
      ? (elapsedMs - currentDay.startMs) / currentDay.dayDurationMs
      : 0,
  );

  return {
    position: linearInterpolateStoryMarkerPosition(
      currentPosition,
      { lat: nextPoint.lat, lng: nextPoint.lng },
      progress,
    ),
    progress,
    shouldAnimate: true,
    issue: null,
  };
};

export const createStoryMarkerUpdateGate = (
  intervalMs = STORY_MARKER_UPDATE_INTERVAL_MS,
) => {
  let lastUpdateMs: number | null = null;

  return {
    markImmediateUpdate(nowMs: number) {
      lastUpdateMs = nowMs;
    },
    reset() {
      lastUpdateMs = null;
    },
    shouldUpdate(nowMs: number) {
      if (
        lastUpdateMs !== null &&
        nowMs - lastUpdateMs < Math.max(intervalMs, 0)
      ) {
        return false;
      }

      lastUpdateMs = nowMs;
      return true;
    },
  };
};
