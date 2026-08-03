import type { StorkDataPoint } from "~/types/stork";
import type { StoryTimelineDay } from "~/utils/storyCycle";
import {
  createStoryMarkerUpdateGate,
  resolveStoryMarkerPosition,
  STORY_MARKER_UPDATE_INTERVAL_MS,
  type StoryMarkerInterpolationIssue,
} from "~/utils/storyMarkerInterpolation";

type StoryMarkerFrame = {
  cycleId: string;
  currentDay: StoryTimelineDay;
  currentPoint: StorkDataPoint | null | undefined;
  nextPoint: StorkDataPoint | null | undefined;
  elapsedMs: number;
};

type StoryMarkerInterpolationOptions = {
  getFrame: () => StoryMarkerFrame | null;
  isPlaybackActive: () => boolean;
  setMarkerPosition: (cycleId: string, lat: number, lng: number) => boolean;
};

export const useStoryMarkerInterpolation = ({
  getFrame,
  isPlaybackActive,
  setMarkerPosition,
}: StoryMarkerInterpolationOptions) => {
  const updateGate = createStoryMarkerUpdateGate(
    STORY_MARKER_UPDATE_INTERVAL_MS,
  );
  const warnedIssues = new Set<string>();

  const stop = () => updateGate.reset();

  const warnOnce = (
    frame: StoryMarkerFrame,
    issue: StoryMarkerInterpolationIssue,
  ) => {
    if (!import.meta.dev) return;

    const warningKey = `${frame.cycleId}:${frame.currentDay.date}:${issue}`;
    if (warnedIssues.has(warningKey)) return;

    warnedIssues.add(warningKey);
    console.warn(
      `[story-marker] ${issue} for ${frame.cycleId} on ${frame.currentDay.date}; preserving the last valid marker position.`,
    );
  };

  const renderCurrentPosition = (frame: StoryMarkerFrame) => {
    const result = resolveStoryMarkerPosition({
      cycleId: frame.cycleId,
      elapsedMs: frame.elapsedMs,
      currentDay: frame.currentDay,
      currentPoint: frame.currentPoint,
      nextPoint: frame.nextPoint,
    });

    if (result.issue) {
      warnOnce(frame, result.issue);
    }
    if (!result.position) return result;

    setMarkerPosition(frame.cycleId, result.position.lat, result.position.lng);
    return result;
  };

  const update = (nowMs = performance.now()) => {
    if (!isPlaybackActive()) return;
    const frame = getFrame();
    if (!frame) return;

    if (!frame.currentDay.isMigrationDay) {
      renderCurrentPosition(frame);
      return renderCurrentPosition(frame);
    }

    if (updateGate.shouldUpdate(nowMs)) {
      return renderCurrentPosition(frame);
    }
  };

  const start = () => update();

  const updateImmediately = () => {
    updateGate.markImmediateUpdate(performance.now());

    const frame = getFrame();
    if (frame) {
      renderCurrentPosition(frame);
    }
  };

  return {
    start,
    stop,
    update,
    updateImmediately,
  };
};
