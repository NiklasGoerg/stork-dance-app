import type { StorySeasonId } from "~/utils/storyCycle";
import { STORY_AUDIO_CONFIG } from "~/utils/storyAudioConfig";

export type SeasonThemeCue = {
  id: StorySeasonId;
  asset: string;
  url: string;
};

export const SEASON_THEME_CONFIG = {
  summer: {
    id: "summer",
    asset: "src/assets/audio/music/summer.wav",
    url: new URL("../../assets/audio/music/summer.wav", import.meta.url).href,
  },
  autumn: {
    id: "autumn",
    asset: "src/assets/audio/music/autumn.wav",
    url: new URL("../../assets/audio/music/autumn.wav", import.meta.url).href,
  },
  winter: {
    id: "winter",
    asset: "src/assets/audio/music/winter.wav",
    url: new URL("../../assets/audio/music/winter.wav", import.meta.url).href,
  },
  spring: {
    id: "spring",
    asset: "src/assets/audio/music/spring.wav",
    url: new URL("../../assets/audio/music/spring.wav", import.meta.url).href,
  },
} as const satisfies Record<StorySeasonId, SeasonThemeCue>;

export const SEASON_THEME_CUES = Object.values(SEASON_THEME_CONFIG);

export const SEASON_THEME_BEAT_DURATION_SECONDS = 60 / STORY_AUDIO_CONFIG.bpm;
export const SEASON_THEME_BAR_DURATION_SECONDS =
  STORY_AUDIO_CONFIG.beatsPerBar * SEASON_THEME_BEAT_DURATION_SECONDS;
export const SEASON_THEME_LOOP_DURATION_SECONDS =
  STORY_AUDIO_CONFIG.barsPerLoop * SEASON_THEME_BAR_DURATION_SECONDS;
export const SEASON_THEME_CROSSFADE_DURATION_SECONDS =
  STORY_AUDIO_CONFIG.beatsPerBar * SEASON_THEME_BEAT_DURATION_SECONDS;

export const SEASON_THEME_AUDIO_CONFIG = {
  initialFadeInSeconds: SEASON_THEME_BEAT_DURATION_SECONDS,
  crossfadeDurationSeconds: SEASON_THEME_CROSSFADE_DURATION_SECONDS,
  durationWarningToleranceSeconds: 0.075,
} as const;
