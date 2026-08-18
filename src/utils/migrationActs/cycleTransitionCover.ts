import type { CycleTransitionState } from "~/types/migrationAct";

export const isCycleTransitionCoverMounted = (state: CycleTransitionState) =>
  state !== "idle";
