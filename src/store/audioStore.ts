import { defineStore } from "pinia";
import {
  BASE_RHYTHM_LOOP_DURATION_SECONDS,
  STORY_AUDIO_CONFIG,
} from "~/utils/storyAudioConfig";

let audioContext: AudioContext | null = null;
let metronomeTimer: ReturnType<typeof setInterval> | null = null;
let baseRhythmBuffer: AudioBuffer | null = null;
let baseRhythmLoadPromise: Promise<void> | null = null;
let baseRhythmSource: AudioBufferSourceNode | null = null;
let baseRhythmStartedAtSeconds = 0;
let baseRhythmStartOffsetSeconds = 0;

const baseRhythmLoopUrl = new URL(
  "../assets/audio/music/base-rhythm-60bpm-4bar.wav",
  import.meta.url,
).href;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown audio error.";

const getAudioContext = () => {
  if (import.meta.server) return null;

  audioContext ??= new AudioContext();

  return audioContext;
};

const normalizeLoopOffset = (
  offsetSeconds: number,
  loopDurationSeconds: number,
) =>
  ((offsetSeconds % loopDurationSeconds) + loopDurationSeconds) %
  loopDurationSeconds;

const stopMetronomeTimer = () => {
  if (!metronomeTimer) return;

  clearInterval(metronomeTimer);
  metronomeTimer = null;
};

const playMetronomeClick = () => {
  if (import.meta.server) return;

  const context = getAudioContext();

  if (!context) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.24, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.07);
};

const stopBaseRhythmSource = () => {
  if (!baseRhythmSource) return;

  const source = baseRhythmSource;

  baseRhythmSource = null;
  source.onended = null;

  try {
    source.stop();
  } catch {
    // The node may already be stopped by the browser.
  }

  source.disconnect();
};

const getBeatDurationMs = (bpm: number) => 60_000 / bpm;

const getBaseRhythmBarDurationMs = (bpm: number, beatsPerBar: number) =>
  getBeatDurationMs(bpm) * beatsPerBar;

const getBaseRhythmTransportTimeMs = (state: {
  baseRhythmLoop: {
    currentOffsetSeconds: number;
    isPlaying: boolean;
  };
}) => {
  const context = getAudioContext();

  if (!context || !state.baseRhythmLoop.isPlaying) {
    return state.baseRhythmLoop.currentOffsetSeconds * 1000;
  }

  return (
    (baseRhythmStartOffsetSeconds +
      context.currentTime -
      baseRhythmStartedAtSeconds) *
    1000
  );
};

export const useAudioStore = defineStore("audio", {
  state: () => ({
    bpm: STORY_AUDIO_CONFIG.bpm,
    isMetronomePlaying: false,
    beatIndex: 0,
    baseRhythmLoop: {
      cueId: STORY_AUDIO_CONFIG.baseRhythmCueId,
      assetPath: "src/assets/audio/music/base-rhythm-60bpm-4bar.wav",
      isLoaded: false,
      isLoading: false,
      isPlaying: false,
      currentOffsetSeconds: 0,
      bpm: STORY_AUDIO_CONFIG.bpm,
      beatsPerBar: STORY_AUDIO_CONFIG.beatsPerBar,
      barsPerLoop: STORY_AUDIO_CONFIG.barsPerLoop,
      loopDurationSeconds: BASE_RHYTHM_LOOP_DURATION_SECONDS,
      expectedLoopDurationSeconds: BASE_RHYTHM_LOOP_DURATION_SECONDS,
      durationDeviationSeconds: 0,
      error: null as string | null,
    },
  }),
  getters: {
    baseRhythmPosition: (state) => {
      const beatDurationSeconds = 60 / state.baseRhythmLoop.bpm;
      const loopBeatIndex = Math.floor(
        state.baseRhythmLoop.currentOffsetSeconds / beatDurationSeconds,
      );
      const currentBar =
        Math.floor(loopBeatIndex / state.baseRhythmLoop.beatsPerBar) + 1;
      const currentBeat =
        (loopBeatIndex % state.baseRhythmLoop.beatsPerBar) + 1;

      return {
        currentBar,
        currentBeat,
      };
    },
  },
  actions: {
    getBaseRhythmBarDurationMs() {
      return getBaseRhythmBarDurationMs(
        this.baseRhythmLoop.bpm,
        this.baseRhythmLoop.beatsPerBar,
      );
    },
    getBeatDurationMs() {
      return getBeatDurationMs(this.baseRhythmLoop.bpm);
    },
    getBaseRhythmTransportTimeMs() {
      return getBaseRhythmTransportTimeMs(this);
    },
    getMsUntilNextBaseRhythmBeat(targetBeat: number) {
      const beatDurationMs = this.getBeatDurationMs();
      const beatsPerBar = this.baseRhythmLoop.beatsPerBar;
      const targetBeatIndex =
        (((Math.round(targetBeat) - 1) % beatsPerBar) + beatsPerBar) %
        beatsPerBar;
      const transportTimeMs = this.getBaseRhythmTransportTimeMs();
      const currentBeatIndex = Math.floor(transportTimeMs / beatDurationMs);
      const currentBarStartBeatIndex =
        Math.floor(currentBeatIndex / beatsPerBar) * beatsPerBar;
      let targetGlobalBeatIndex = currentBarStartBeatIndex + targetBeatIndex;
      let targetTransportTimeMs = targetGlobalBeatIndex * beatDurationMs;

      if (targetTransportTimeMs <= transportTimeMs + 40) {
        targetGlobalBeatIndex += beatsPerBar;
        targetTransportTimeMs = targetGlobalBeatIndex * beatDurationMs;
      }

      return Math.max(0, Math.round(targetTransportTimeMs - transportTimeMs));
    },
    getMsUntilNextBaseRhythmBar() {
      const offsetSeconds = this.syncBaseRhythmLoopOffset();
      const barDurationMs = this.getBaseRhythmBarDurationMs();
      const offsetMs = offsetSeconds * 1000;
      const msIntoBar =
        ((offsetMs % barDurationMs) + barDurationMs) % barDurationMs;
      const msUntilNextBar = barDurationMs - msIntoBar;

      return Math.max(0, Math.round(msUntilNextBar || barDurationMs));
    },
    scheduleAtNextBaseRhythmBar(callback: () => void) {
      const delayMs = this.getMsUntilNextBaseRhythmBar();
      const timer = setTimeout(() => {
        this.syncBaseRhythmLoopOffset();
        callback();
      }, delayMs);

      return () => {
        clearTimeout(timer);
      };
    },
    scheduleAtNextBaseRhythmBeat(targetBeat: number, callback: () => void) {
      const delayMs = this.getMsUntilNextBaseRhythmBeat(targetBeat);
      const timer = setTimeout(() => {
        this.syncBaseRhythmLoopOffset();
        callback();
      }, delayMs);

      return () => {
        clearTimeout(timer);
      };
    },
    setBpm(bpm: number) {
      this.bpm = Math.max(20, Math.min(240, Math.round(bpm)));

      if (!this.isMetronomePlaying) return;

      this.stopMetronome();
      this.startMetronome();
    },
    startMetronome(bpm?: number) {
      if (typeof bpm === "number") {
        this.setBpm(bpm);
      }

      if (this.isMetronomePlaying || import.meta.server) return;

      this.isMetronomePlaying = true;
      this.beatIndex = 0;

      const tick = () => {
        playMetronomeClick();
        this.beatIndex++;
      };

      tick();
      metronomeTimer = setInterval(tick, 60000 / this.bpm);
    },
    stopMetronome() {
      stopMetronomeTimer();
      this.isMetronomePlaying = false;
      this.beatIndex = 0;
    },
    async loadBaseRhythmLoop() {
      if (import.meta.server || this.baseRhythmLoop.isLoaded) return;

      if (baseRhythmLoadPromise) {
        await baseRhythmLoadPromise;
        return;
      }

      this.baseRhythmLoop.isLoading = true;
      this.baseRhythmLoop.error = null;

      baseRhythmLoadPromise = (async () => {
        try {
          const context = getAudioContext();

          if (!context) return;

          const response = await fetch(baseRhythmLoopUrl);

          if (!response.ok) {
            throw new Error(
              `Could not load ${STORY_AUDIO_CONFIG.baseRhythmFileName}.`,
            );
          }

          const arrayBuffer = await response.arrayBuffer();

          baseRhythmBuffer = await context.decodeAudioData(arrayBuffer);

          const loopDurationSeconds = baseRhythmBuffer.duration;

          this.baseRhythmLoop.isLoaded = true;
          this.baseRhythmLoop.loopDurationSeconds = loopDurationSeconds;
          this.baseRhythmLoop.durationDeviationSeconds =
            loopDurationSeconds - BASE_RHYTHM_LOOP_DURATION_SECONDS;
        } catch (error) {
          baseRhythmBuffer = null;
          this.baseRhythmLoop.isLoaded = false;
          this.baseRhythmLoop.error = getErrorMessage(error);
        } finally {
          this.baseRhythmLoop.isLoading = false;
          baseRhythmLoadPromise = null;
        }
      })();

      await baseRhythmLoadPromise;
    },
    syncBaseRhythmLoopOffset() {
      const context = getAudioContext();
      const loopDurationSeconds = this.baseRhythmLoop.loopDurationSeconds;

      if (!context || !this.baseRhythmLoop.isPlaying || !loopDurationSeconds) {
        return this.baseRhythmLoop.currentOffsetSeconds;
      }

      this.baseRhythmLoop.currentOffsetSeconds = normalizeLoopOffset(
        baseRhythmStartOffsetSeconds +
          context.currentTime -
          baseRhythmStartedAtSeconds,
        loopDurationSeconds,
      );

      return this.baseRhythmLoop.currentOffsetSeconds;
    },
    async startBaseRhythmLoop(offsetSeconds = 0) {
      if (import.meta.server || this.baseRhythmLoop.isPlaying) return;

      await this.loadBaseRhythmLoop();

      const context = getAudioContext();

      if (!context || !baseRhythmBuffer) return;

      try {
        await context.resume();
      } catch (error) {
        this.baseRhythmLoop.error = getErrorMessage(error);
        return;
      }

      stopBaseRhythmSource();

      const loopDurationSeconds = this.baseRhythmLoop.loopDurationSeconds;
      if (loopDurationSeconds <= 0) {
        this.baseRhythmLoop.error = "Base rhythm loop has no audio duration.";
        return;
      }

      const offset = normalizeLoopOffset(offsetSeconds, loopDurationSeconds);
      const source = context.createBufferSource();

      source.buffer = baseRhythmBuffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = loopDurationSeconds;
      source.connect(context.destination);
      source.start(0, offset);

      baseRhythmSource = source;
      baseRhythmStartedAtSeconds = context.currentTime;
      baseRhythmStartOffsetSeconds = offset;
      this.baseRhythmLoop.currentOffsetSeconds = offset;
      this.baseRhythmLoop.isPlaying = true;
      this.baseRhythmLoop.error = null;
    },
    pauseBaseRhythmLoop() {
      if (!this.baseRhythmLoop.isPlaying) return;

      this.syncBaseRhythmLoopOffset();
      stopBaseRhythmSource();
      this.baseRhythmLoop.isPlaying = false;
    },
    async resumeBaseRhythmLoop() {
      if (this.baseRhythmLoop.isPlaying) return;

      await this.startBaseRhythmLoop(this.baseRhythmLoop.currentOffsetSeconds);
    },
    stopBaseRhythmLoop() {
      stopBaseRhythmSource();
      this.baseRhythmLoop.isPlaying = false;
      this.baseRhythmLoop.currentOffsetSeconds = 0;
      baseRhythmStartedAtSeconds = 0;
      baseRhythmStartOffsetSeconds = 0;
    },
    resetBaseRhythmLoop() {
      this.stopBaseRhythmLoop();
    },
  },
});
