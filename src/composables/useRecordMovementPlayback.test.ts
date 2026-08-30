import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRecordMovementPlayback } from "~/composables/useRecordMovementPlayback";
import type { MovementRecording } from "~/types/movement";
import { getMovementRecordingDurationMs } from "~/utils/movementPlaybackTiming";

const movementModules = import.meta.glob<MovementRecording>(
  "../assets/movement_library/{migration,seasons}/*.json",
  { eager: true, import: "default" },
);

const readMovement = (folder: "migration" | "seasons", movementId: string) => {
  const recording =
    movementModules[`../assets/movement_library/${folder}/${movementId}.json`];

  if (!recording) throw new Error(`Missing test movement ${movementId}.`);

  return recording;
};

describe("useRecordMovementPlayback", () => {
  let nowMs = 0;
  let nextFrame: FrameRequestCallback | null = null;

  beforeEach(() => {
    nowMs = 0;
    nextFrame = null;
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        nextFrame = callback;
        return 1;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads an uploaded Movement JSON and prepares the first frame", () => {
    const controller = useRecordMovementPlayback();
    const recording = readMovement("migration", "departure-gesture");
    const firstOriginalLandmark = recording.frames[0]?.landmarks[0];

    controller.loadUploadedRecording(recording, "departure-upload.json");

    expect(controller.sourceName.value).toBe("departure-upload.json");
    expect(controller.hasRecording.value).toBe(true);
    expect(controller.currentFrame.value?.landmarks).toEqual(
      recording.frames[0]?.landmarks,
    );
    expect(controller.currentFrame.value?.landmarks[0]).toEqual(
      firstOriginalLandmark,
    );
    expect(controller.durationMs.value).toBe(
      getMovementRecordingDurationMs(controller.recording.value!),
    );
  });

  it.each([
    ["migration", "arrival-gesture"],
    ["seasons", "summer-100-percent"],
  ] as const)(
    "loads an existing %s asset recording",
    async (folder, movementId) => {
      const controller = useRecordMovementPlayback();
      const asset = controller.assets.find((item) =>
        item.label.endsWith(`${folder} / ${movementId}`),
      );

      expect(asset).toBeTruthy();
      await expect(controller.loadAsset(asset!.id)).resolves.toBe(true);
      expect(controller.selectedAssetId.value).toBe(asset!.id);
      expect(controller.sourceName.value).toBe(asset!.label);
      expect(controller.recording.value?.name).toBe(movementId);
      expect(controller.currentFrame.value).toBeTruthy();
    },
  );

  it("uses source metadata to resolve the playback stage aspect", () => {
    const controller = useRecordMovementPlayback();
    const recording = readMovement("migration", "departure-gesture");

    controller.loadUploadedRecording(recording, "departure-upload.json");

    expect(controller.sourceAspect.value).toBe(1080 / 1920);
  });

  it("falls back to webcam aspect for recordings without source metadata", () => {
    const controller = useRecordMovementPlayback();
    const recording = readMovement("migration", "departure-gesture");
    const webcamRecording: MovementRecording = {
      ...recording,
      source: undefined,
    };

    controller.loadUploadedRecording(webcamRecording, "webcam-upload.json");

    expect(controller.sourceAspect.value).toBe(4 / 3);
  });

  it("advances playback with recorded frame timing", () => {
    const controller = useRecordMovementPlayback();
    controller.loadUploadedRecording(
      readMovement("migration", "departure-gesture"),
      "departure-upload.json",
    );
    const firstFrame = controller.currentFrame.value;

    controller.play();
    nowMs = 500;
    nextFrame?.(nowMs);

    expect(controller.isPlaying.value).toBe(true);
    expect(controller.currentTimeMs.value).toBe(500);
    expect(controller.currentFrame.value).not.toBe(firstFrame);
  });

  it("pauses and resumes without jumping back to the beginning", () => {
    const controller = useRecordMovementPlayback();
    controller.loadUploadedRecording(
      readMovement("seasons", "summer-100-percent"),
      "summer-upload.json",
    );

    controller.play();
    nowMs = 750;
    nextFrame?.(nowMs);
    controller.pause();

    const pausedTimeMs = controller.currentTimeMs.value;
    const pausedFrame = controller.currentFrame.value;

    nowMs = 2_000;
    controller.play();

    expect(controller.currentTimeMs.value).toBe(pausedTimeMs);
    expect(controller.currentFrame.value).toBe(pausedFrame);
  });

  it("resets playback to the first frame", () => {
    const controller = useRecordMovementPlayback();
    controller.loadUploadedRecording(
      readMovement("seasons", "summer-100-percent"),
      "summer-upload.json",
    );
    const firstFrame = controller.currentFrame.value;

    controller.play();
    nowMs = 750;
    nextFrame?.(nowMs);
    controller.reset();

    expect(controller.isPlaying.value).toBe(false);
    expect(controller.currentTimeMs.value).toBe(0);
    expect(controller.hasCompleted.value).toBe(false);
    expect(controller.currentFrame.value).toBe(firstFrame);
  });

  it("marks playback completed when the recording reaches its end", () => {
    const controller = useRecordMovementPlayback();
    controller.loadUploadedRecording(
      readMovement("migration", "arrival-gesture"),
      "arrival-upload.json",
    );

    controller.play();
    nowMs = controller.durationMs.value + 1;
    nextFrame?.(nowMs);

    expect(controller.isPlaying.value).toBe(false);
    expect(controller.hasCompleted.value).toBe(true);
    expect(controller.currentTimeMs.value).toBe(controller.durationMs.value);
  });
});
