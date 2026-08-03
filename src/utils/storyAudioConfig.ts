import { STORY_TIMING_CONFIG } from "~/story/storyTimingConfig";

export const STORY_AUDIO_CONFIG = {
  bpm: 60,
  beatsPerBar: 4,
  barsPerLoop: 4,
  cycleBars: 24,
  cycleDurationMs: STORY_TIMING_CONFIG.cycleDurationMs,
  baseRhythmCueId: "base-rhythm-loop",
  baseRhythmFileName: "base-rhythm-60bpm-4bar.wav",
} as const;

export const BASE_RHYTHM_LOOP_DURATION_SECONDS =
  (STORY_AUDIO_CONFIG.beatsPerBar * STORY_AUDIO_CONFIG.barsPerLoop * 60) /
  STORY_AUDIO_CONFIG.bpm;
