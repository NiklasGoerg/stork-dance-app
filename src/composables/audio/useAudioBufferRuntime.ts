export type SharedAudioCue = {
  id: string;
  url: string;
};

let audioContext: AudioContext | null = null;
const audioBuffers = new Map<string, AudioBuffer>();
const audioLoadPromises = new Map<string, Promise<AudioBuffer>>();

export const getSharedAudioContext = () => {
  if (import.meta.server || typeof AudioContext === "undefined") return null;

  audioContext ??= new AudioContext();

  return audioContext;
};

export const getSharedAudioBuffer = (cueId: string) =>
  audioBuffers.get(cueId) ?? null;

export const loadSharedAudioBuffer = async (cue: SharedAudioCue) => {
  const cachedBuffer = audioBuffers.get(cue.id);
  if (cachedBuffer) return cachedBuffer;

  const existingPromise = audioLoadPromises.get(cue.id);
  if (existingPromise) return existingPromise;

  const loadPromise = (async () => {
    const context = getSharedAudioContext();
    if (!context) throw new Error("Web Audio API is unavailable.");

    const response = await fetch(cue.url);
    if (!response.ok) throw new Error(`Could not load ${cue.id}.`);

    const buffer = await context.decodeAudioData(await response.arrayBuffer());

    audioBuffers.set(cue.id, buffer);
    return buffer;
  })().finally(() => {
    audioLoadPromises.delete(cue.id);
  });

  audioLoadPromises.set(cue.id, loadPromise);
  return loadPromise;
};
