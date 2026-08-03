import {
  getSharedAudioBuffer,
  getSharedAudioContext,
  loadSharedAudioBuffer,
  type SharedAudioCue,
} from "~/composables/audio/useAudioBufferRuntime";
import {
  SEASON_THEME_AUDIO_CONFIG,
  SEASON_THEME_CUES,
  SEASON_THEME_LOOP_DURATION_SECONDS,
} from "~/utils/seasonAudio/config";
import {
  getNextBeatSchedule,
  getSeasonThemeLoopOffsetSeconds,
} from "~/utils/seasonAudio/transport";
import { STORY_AUDIO_CONFIG } from "~/utils/storyAudioConfig";
import type { StorySeasonId } from "~/utils/storyCycle";

type ThemeNode = {
  season: StorySeasonId;
  source: AudioBufferSourceNode;
  gain: GainNode;
};

type PendingChange = {
  season: StorySeasonId;
  transportSeconds: number;
};

export type SeasonalThemeAudioRuntime = {
  getContext: () => AudioContext | null;
  loadBuffer: (cue: SharedAudioCue) => Promise<AudioBuffer>;
  getBuffer: (cueId: string) => AudioBuffer | null;
};

export type SeasonalThemePreloadResult = {
  isReady: boolean;
  error: string;
};

type SeasonalThemeTransportOptions = {
  runtime?: SeasonalThemeAudioRuntime;
};

const defaultRuntime: SeasonalThemeAudioRuntime = {
  getContext: getSharedAudioContext,
  loadBuffer: loadSharedAudioBuffer,
  getBuffer: getSharedAudioBuffer,
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown season audio error.";

const stopNode = (node: ThemeNode | null) => {
  if (!node) return;

  node.source.onended = null;
  try {
    node.source.stop();
  } catch {
    // AudioBufferSourceNodes are single-use and may already be stopped.
  }
  node.source.disconnect();
  node.gain.disconnect();
};

export const useSeasonalThemeTransport = ({
  runtime = defaultRuntime,
}: SeasonalThemeTransportOptions = {}) => {
  const loadedSeasons = new Set<StorySeasonId>();

  let active: ThemeNode | null = null;
  let fading: ThemeNode | null = null;
  let desiredSeason: StorySeasonId | null = null;
  let pendingChange: PendingChange | null = null;
  let paused = false;
  let operationId = 0;
  let loadError = "";

  const clearSources = () => {
    operationId++;
    stopNode(active);
    stopNode(fading);
    active = null;
    fading = null;
  };

  const preload = async (): Promise<SeasonalThemePreloadResult> => {
    const errors: string[] = [];

    await Promise.all(
      SEASON_THEME_CUES.map(async (cue) => {
        if (loadedSeasons.has(cue.id)) return;

        try {
          const buffer = await runtime.loadBuffer(cue);
          const differenceSeconds =
            buffer.duration - SEASON_THEME_LOOP_DURATION_SECONDS;

          loadedSeasons.add(cue.id);
          if (
            import.meta.dev &&
            Math.abs(differenceSeconds) >
              SEASON_THEME_AUDIO_CONFIG.durationWarningToleranceSeconds
          ) {
            console.warn("[SeasonTheme] Unexpected decoded duration.", {
              season: cue.id,
              asset: cue.asset,
              decodedDuration: buffer.duration,
              expectedDuration: SEASON_THEME_LOOP_DURATION_SECONDS,
              difference: differenceSeconds,
            });
          }
        } catch (error) {
          const message = `${cue.id}: ${getErrorMessage(error)}`;
          errors.push(message);
          if (import.meta.dev) {
            console.warn("[SeasonTheme] Theme unavailable; beat continues.", {
              season: cue.id,
              asset: cue.asset,
              error: message,
            });
          }
        }
      }),
    );

    loadError = errors.join("; ");
    return {
      isReady: loadedSeasons.size === SEASON_THEME_CUES.length,
      error: loadError,
    };
  };

  const createNode = (
    season: StorySeasonId,
    startTime: number,
    transportSeconds: number,
  ) => {
    const context = runtime.getContext();
    const buffer = runtime.getBuffer(season);
    if (!context || !buffer || !loadedSeasons.has(season)) return null;

    const source = context.createBufferSource();
    const gain = context.createGain();
    const loopEnd = Math.min(
      SEASON_THEME_LOOP_DURATION_SECONDS,
      buffer.duration,
    );

    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = loopEnd;
    gain.gain.setValueAtTime(0, startTime);
    source.connect(gain);
    gain.connect(context.destination);
    source.start(
      startTime,
      getSeasonThemeLoopOffsetSeconds(transportSeconds, loopEnd),
    );

    return { season, source, gain } satisfies ThemeNode;
  };

  const start = async (season: StorySeasonId, transportSeconds: number) => {
    desiredSeason = season;
    pendingChange = null;
    paused = false;

    const context = runtime.getContext();
    if (!context || !loadedSeasons.has(season)) return false;

    try {
      await context.resume();
    } catch (error) {
      loadError = getErrorMessage(error);
      return false;
    }

    clearSources();
    const startTime = context.currentTime;
    const node = createNode(season, startTime, transportSeconds);
    if (!node) return false;

    node.gain.gain.linearRampToValueAtTime(
      1,
      startTime + SEASON_THEME_AUDIO_CONFIG.initialFadeInSeconds,
    );
    active = node;
    return true;
  };

  const changeSeason = async (
    season: StorySeasonId,
    transportSeconds: number,
  ) => {
    desiredSeason = season;
    if (paused) return false;
    if (active?.season === season) {
      pendingChange = null;
      return true;
    }
    if (fading) {
      pendingChange = { season, transportSeconds };
      return true;
    }
    if (!active) return start(season, transportSeconds);

    const context = runtime.getContext();
    if (!context || !loadedSeasons.has(season)) return false;

    try {
      await context.resume();
    } catch (error) {
      loadError = getErrorMessage(error);
      return false;
    }

    const schedule = getNextBeatSchedule(
      transportSeconds,
      STORY_AUDIO_CONFIG.bpm,
    );
    const startTime = context.currentTime + schedule.delaySeconds;
    const endTime =
      startTime + SEASON_THEME_AUDIO_CONFIG.crossfadeDurationSeconds;
    const incoming = createNode(
      season,
      startTime,
      schedule.scheduledTransportSeconds,
    );
    if (!incoming) return false;

    const outgoing = active;
    const currentOperation = ++operationId;
    fading = outgoing;
    active = incoming;
    pendingChange = null;

    outgoing.gain.gain.cancelScheduledValues(startTime);
    outgoing.gain.gain.setValueAtTime(outgoing.gain.gain.value, startTime);
    outgoing.gain.gain.linearRampToValueAtTime(0, endTime);
    incoming.gain.gain.linearRampToValueAtTime(1, endTime);
    outgoing.source.onended = () => {
      outgoing.source.disconnect();
      outgoing.gain.disconnect();
      if (currentOperation !== operationId) return;

      fading = null;
      const queued = pendingChange;
      pendingChange = null;
      if (queued && queued.season !== active?.season) {
        void changeSeason(queued.season, queued.transportSeconds);
      }
    };
    outgoing.source.stop(endTime);
    return true;
  };

  const pause = () => {
    desiredSeason = pendingChange?.season ?? active?.season ?? desiredSeason;
    pendingChange = null;
    clearSources();
    paused = true;
  };

  const resume = async (transportSeconds: number) => {
    if (!paused || !desiredSeason) return;
    await start(desiredSeason, transportSeconds);
  };

  const stop = (fadeSeconds = 0) => {
    desiredSeason = null;
    pendingChange = null;
    paused = false;
    operationId++;

    stopNode(fading);
    fading = null;
    if (!active || fadeSeconds <= 0) {
      stopNode(active);
      active = null;
      return;
    }

    const context = runtime.getContext();
    if (!context) {
      stopNode(active);
      active = null;
      return;
    }

    const node = active;
    const endTime = context.currentTime + fadeSeconds;
    active = null;
    fading = node;
    node.gain.gain.cancelScheduledValues(context.currentTime);
    node.gain.gain.setValueAtTime(node.gain.gain.value, context.currentTime);
    node.gain.gain.linearRampToValueAtTime(0, endTime);
    node.source.onended = () => {
      node.source.disconnect();
      node.gain.disconnect();
      if (fading === node) fading = null;
    };
    node.source.stop(endTime);
  };

  const dispose = () => {
    stop();
    loadedSeasons.clear();
  };

  return {
    preload,
    start,
    changeSeason,
    pause,
    resume,
    stop,
    dispose,
  };
};

export type SeasonalThemeTransport = ReturnType<
  typeof useSeasonalThemeTransport
>;
