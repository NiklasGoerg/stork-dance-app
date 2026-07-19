import { ref } from "vue";
import type {
  MovementMatchState,
  MovementRequirement,
  PoseLandmark,
} from "~/story/types";

const matchState = ref<MovementMatchState>("idle");
const requirements = ref<MovementRequirement[]>([]);
const lastMatchedAtMs = ref<number | null>(null);

export const useMovementMatcher = () => {
  const setRequirements = (nextRequirements: MovementRequirement[]) => {
    requirements.value = nextRequirements;
    matchState.value = nextRequirements.length ? "waiting" : "idle";
    lastMatchedAtMs.value = null;
  };

  const waitForMatch = () => {
    matchState.value = "waiting";
  };

  const resolveMatch = (matched: boolean) => {
    matchState.value = matched ? "matched" : "failed";
    lastMatchedAtMs.value = matched ? Date.now() : null;
  };

  const evaluateFrame = (_landmarks: PoseLandmark[]) => {
    // TODO: Implement binary MVP matching against requirements.
    return matchState.value === "matched";
  };

  const resetMatch = () => {
    matchState.value = "idle";
    requirements.value = [];
    lastMatchedAtMs.value = null;
  };

  return {
    matchState,
    requirements,
    lastMatchedAtMs,
    setRequirements,
    waitForMatch,
    resolveMatch,
    evaluateFrame,
    resetMatch,
  };
};
