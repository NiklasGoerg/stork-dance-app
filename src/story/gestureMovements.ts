import type { StoryGestureDefinition } from "~/story/gestures";
import type { MovementRecording } from "~/types/movement";

type GestureMovementPlaybackSource = "recorded";

export type GestureMovementLoadResult = {
  recording: MovementRecording;
  source: GestureMovementPlaybackSource;
};

const movementLoaders: Partial<
  Record<string, () => Promise<MovementRecording>>
> = {
  "arrival-gesture": () => loadMovementRecording(arrivalGestureMovementUrl),
  "departure-gesture": () => loadMovementRecording(departureGestureMovementUrl),
};

const arrivalGestureMovementUrl = new URL(
  "../assets/movement_library/migration/arrival-gesture.json",
  import.meta.url,
).href;

const departureGestureMovementUrl = new URL(
  "../assets/movement_library/migration/departure-gesture.json",
  import.meta.url,
).href;

const loadMovementRecording = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load movement recording from ${url}.`);
  }

  return (await response.json()) as MovementRecording;
};

// Loads the recorded avatar demonstration for a gesture by registry id.
export const loadGestureMovement = async (
  gesture: StoryGestureDefinition,
): Promise<GestureMovementLoadResult> => {
  const movementId = gesture.movementId;
  const loadMovement = movementLoaders[movementId];

  if (loadMovement) {
    try {
      return {
        recording: await loadMovement(),
        source: "recorded",
      };
    } catch (error) {
      console.error(
        `[StoryGesture] Movement "${movementId}" could not be loaded.`,
        error,
      );
      throw error;
    }
  }

  throw new Error(`[StoryGesture] Movement "${movementId}" is not available.`);
};
