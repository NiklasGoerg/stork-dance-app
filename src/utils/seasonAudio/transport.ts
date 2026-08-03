import type { StorySeasonId } from "~/utils/storyCycle";
import { getSeasonForDate } from "~/utils/storyCycle";

const AUDIO_EPSILON_SECONDS = 0.000_001;

export const getCalendarSeasonId = (date: string): StorySeasonId =>
  getSeasonForDate(date).id;

export const getSeasonThemeLoopOffsetSeconds = (
  transportSeconds: number,
  loopDurationSeconds: number,
) => {
  if (!Number.isFinite(transportSeconds) || loopDurationSeconds <= 0) return 0;

  return (
    ((transportSeconds % loopDurationSeconds) + loopDurationSeconds) %
    loopDurationSeconds
  );
};

export const getNextBeatSchedule = (transportSeconds: number, bpm: number) => {
  const safeTransportSeconds = Math.max(0, transportSeconds);
  const beatDurationSeconds = 60 / bpm;
  const beatPosition = safeTransportSeconds / beatDurationSeconds;
  const roundedBeat = Math.round(beatPosition);
  const isOnBeat =
    Math.abs(beatPosition - roundedBeat) <= AUDIO_EPSILON_SECONDS;
  const scheduledBeat = isOnBeat ? roundedBeat : Math.ceil(beatPosition);
  const scheduledTransportSeconds = scheduledBeat * beatDurationSeconds;

  return {
    beatDurationSeconds,
    scheduledBeat,
    scheduledTransportSeconds,
    delaySeconds: Math.max(0, scheduledTransportSeconds - safeTransportSeconds),
  };
};
