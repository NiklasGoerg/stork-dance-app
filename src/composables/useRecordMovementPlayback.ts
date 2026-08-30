import { computed, ref } from "vue";

import { useMovementPlayback } from "~/composables/useMovementPlayback";
import type { MovementRecording } from "~/types/movement";

const movementAssetLoaders = import.meta.glob<MovementRecording>(
  "../assets/movement_library/{migration,seasons}/*.json",
  { import: "default" },
);

export type RecordPlaybackAsset = {
  id: string;
  label: string;
};

const formatAssetLabel = (path: string) =>
  path
    .replace("../assets/movement_library/", "")
    .replace(".json", "")
    .replaceAll("/", " / ");

const cloneRecording = (recording: MovementRecording): MovementRecording => ({
  ...recording,
  source: recording.source ? { ...recording.source } : undefined,
  frames: recording.frames.map((frame) => ({
    ...frame,
    landmarks: frame.landmarks.map((landmark) => ({ ...landmark })),
  })),
});

const createMovementAssets = (): RecordPlaybackAsset[] =>
  Object.keys(movementAssetLoaders)
    .map((path) => ({
      id: path,
      label: formatAssetLabel(path),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

export const useRecordMovementPlayback = () => {
  const playback = useMovementPlayback();
  const assets = createMovementAssets();
  const selectedAssetId = ref("");
  const sourceName = ref("");

  const hasRecording = computed(() => Boolean(playback.recording.value));
  const sourceAspect = computed(() => {
    const source = playback.recording.value?.source;

    return source?.width && source.height
      ? source.width / source.height
      : 4 / 3;
  });

  const loadRecording = (recording: MovementRecording, name = "") => {
    const nextRecording = cloneRecording(recording);

    playback.loadRecording(nextRecording);
    sourceName.value = name || nextRecording.name || "";
  };

  const loadAsset = async (assetId: string) => {
    const asset = assets.find((item) => item.id === assetId);
    const loader = movementAssetLoaders[assetId];

    if (!asset || !loader) return false;

    selectedAssetId.value = assetId;
    loadRecording(await loader(), asset.label);

    return true;
  };

  const loadUploadedRecording = (
    recording: MovementRecording,
    fileName: string,
  ) => {
    selectedAssetId.value = "";
    loadRecording(recording, fileName);
  };

  const reset = () => {
    playback.stop();
  };

  return {
    assets,
    selectedAssetId,
    sourceName,
    hasRecording,
    recording: playback.recording,
    currentFrame: playback.currentFrame,
    sourceAspect,
    isPlaying: playback.isPlaying,
    currentTimeMs: playback.currentTimeMs,
    durationMs: playback.durationMs,
    hasCompleted: playback.hasCompleted,
    loadAsset,
    loadUploadedRecording,
    play: playback.play,
    pause: playback.pause,
    reset,
  };
};
