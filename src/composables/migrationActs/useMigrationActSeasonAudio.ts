import {
  useSeasonalThemeTransport,
  type SeasonalThemeTransport,
} from "~/composables/audio/useSeasonalThemeTransport";
import { useAudioStore } from "~/store/audioStore";
import { useMigrationActStore } from "~/store/migrationActs/migrationAct";
import { SEASON_THEME_BEAT_DURATION_SECONDS } from "~/utils/seasonAudio/config";
import { getSeasonForDate, type StorySeasonId } from "~/utils/storyCycle";

type MigrationActSeasonAudioOptions = {
  transport?: SeasonalThemeTransport;
  getTransportSeconds?: () => number;
};

export const useMigrationActSeasonAudio = ({
  transport = useSeasonalThemeTransport(),
  getTransportSeconds,
}: MigrationActSeasonAudioOptions = {}) => {
  const store = useMigrationActStore();
  const audioStore = useAudioStore();
  const readTransportSeconds =
    getTransportSeconds ??
    (() => audioStore.getBaseRhythmTransportTimeMs() / 1_000);

  let started = false;
  let isReady = false;
  let error = "";

  const getSeason = (date: string): StorySeasonId => getSeasonForDate(date).id;

  const prepare = (date: string) => {
    store.setSeasonAudioState({
      currentSeason: getSeason(date),
      isReady,
      error,
    });
  };

  const preload = async () => {
    const result = await transport.preload();
    isReady = result.isReady;
    error = result.error;
    store.setSeasonAudioState({
      isReady,
      error,
    });
  };

  const start = async (date: string) => {
    const season = getSeason(date);
    store.setSeasonAudioState({ currentSeason: season });
    started = true;
    await transport.start(season, readTransportSeconds());
  };

  const changeForDate = async (date: string) => {
    const season = getSeason(date);
    if (store.seasonAudio.currentSeason === season) return;

    store.setSeasonAudioState({ currentSeason: season });
    if (started) {
      await transport.changeSeason(season, readTransportSeconds());
    }
  };

  const pause = () => {
    if (started) transport.pause();
  };

  const resume = async () => {
    if (started) await transport.resume(readTransportSeconds());
  };

  const seek = async (date: string) => {
    const season = getSeason(date);
    store.setSeasonAudioState({ currentSeason: season });
    if (started) {
      await transport.changeSeason(season, readTransportSeconds());
    }
  };

  const fadeOutForCycle = () => {
    started = false;
    transport.stop(SEASON_THEME_BEAT_DURATION_SECONDS);
  };

  const reset = () => {
    started = false;
    transport.stop();
    store.setSeasonAudioState({ currentSeason: null, isReady, error });
  };

  const dispose = () => {
    started = false;
    transport.dispose();
  };

  return {
    preload,
    prepare,
    start,
    changeForDate,
    pause,
    resume,
    seek,
    fadeOutForCycle,
    reset,
    dispose,
  };
};

export type MigrationActSeasonAudioService = ReturnType<
  typeof useMigrationActSeasonAudio
>;
