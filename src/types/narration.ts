export interface NarrationVoicePreference {
  voiceUri: string | null;
  name: string | null;
  lang: string | null;
}

export interface NarrationSettingsState {
  enabled: boolean;
  preferredVoice: NarrationVoicePreference;
  rate: number;
  pitch: number;
  volume: number;
}

export type NarrationSpeakBehavior = "replace" | "queue" | "skip-if-speaking";

export interface NarrationSpeakOptions {
  voiceUri?: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  behavior?: NarrationSpeakBehavior;
  onStart?: (details: NarrationSpeechStartDetails) => void;
  onEnd?: (details: NarrationSpeechEndDetails) => void;
}

export interface NarrationSpeechStartDetails {
  rate: number;
  voiceName: string | null;
}

export interface NarrationSpeechEndDetails extends NarrationSpeechStartDetails {
  status: NarrationResultStatus;
}

export type NarrationResultStatus =
  "completed" | "cancelled" | "skipped" | "disabled" | "unsupported" | "error";

export interface NarrationResult {
  status: NarrationResultStatus;
  error?: unknown;
}
