import { describe, expect, it } from "vitest";
import climateStageSource from "~/components/act4/ClimateActStage.vue?raw";
import migrationStageSource from "~/components/story/MigrationActStage.vue?raw";
import {
  getPresenterActionForEvent,
  type PresenterAction,
} from "~/composables/usePresenterActions";

const countOccurrences = (source: string, pattern: string) =>
  source.split(pattern).length - 1;

const applyPresenterAction = (
  context: "running" | "paused",
  action: PresenterAction | null,
  skippableGesture = false,
) => {
  const calls: string[] = [];
  let nextContext = context;

  if (action === "pageUp" && nextContext === "paused") {
    calls.push("back");
  } else if (action === "pageUp" && nextContext === "running") {
    calls.push("pause");
    nextContext = "paused";
  } else if (action === "pageDown" && nextContext === "paused") {
    calls.push("resume");
    nextContext = "running";
  } else if (
    action === "pageDown" &&
    nextContext === "running" &&
    skippableGesture
  ) {
    calls.push("skip");
  }

  return { calls, context: nextContext };
};

describe("pause presenter ownership", () => {
  it("uses one shared PauseOverlay in migration and climate stages", () => {
    for (const source of [migrationStageSource, climateStageSource]) {
      expect(source).toContain("PauseOverlay");
      expect(source).toContain('v-if="isUserPaused"');
      expect(source).toContain('@back="handleBackToStart"');
      expect(source).toContain('@resume="handleResume"');
      expect(source).toContain("common.backToStart");
      expect(source).toContain("common.resume");
    }
  });

  it("keeps active presenter ownership in one stage-level listener per active stage", () => {
    expect(
      countOccurrences(migrationStageSource, "usePresenterActions({"),
    ).toBe(1);
    expect(countOccurrences(climateStageSource, "usePresenterActions({")).toBe(
      1,
    );
    expect(migrationStageSource).toContain("type MigrationPresenterContext");
    expect(climateStageSource).toContain("type ClimatePresenterContext");
    expect(migrationStageSource).toContain("activePresenterContext");
    expect(climateStageSource).toContain("activePresenterContext");
  });

  it("maps active running and paused presenter actions with paused state precedence", () => {
    expect(migrationStageSource).toContain(
      'activePresenterContext.value === "running"',
    );
    expect(migrationStageSource).toContain("handlePause();");
    expect(migrationStageSource).toContain(
      'activePresenterContext.value === "paused"',
    );
    expect(migrationStageSource).toContain("handleResume();");
    expect(migrationStageSource).toContain("showSkipMovementButton.value");
    expect(migrationStageSource).toContain("handleSkipMovement();");
    expect(migrationStageSource).not.toContain(
      "if (isGuidedAct.value) handleStoryProgress();",
    );

    expect(climateStageSource).toContain(
      'activePresenterContext.value === "running"',
    );
    expect(climateStageSource).toContain("handlePause();");
    expect(climateStageSource).toContain(
      'activePresenterContext.value === "paused"',
    );
    expect(climateStageSource).toContain("handleResume();");
    expect(climateStageSource).toContain("showSkipMovementButton.value");
    expect(climateStageSource).toContain("handleSkipMovement();");
  });

  it("exposes Skip Movement only for active Act III blocking gestures", () => {
    expect(migrationStageSource).toContain("showSkipMovementButton");
    expect(migrationStageSource).toContain('props.act.id === "act-3"');
    expect(migrationStageSource).toContain("!isUserPaused.value");
    expect(migrationStageSource).toContain("store.isGestureActive");
    expect(migrationStageSource).toContain('gestureId === "departure"');
    expect(migrationStageSource).toContain('gestureId === "arrival"');
    expect(migrationStageSource).toContain(
      'store.playbackState === "gesture_lead_in"',
    );
    expect(migrationStageSource).toContain(
      'store.playbackState === "gesture_playing"',
    );
    expect(migrationStageSource).toContain("migration-skip-button");
    expect(migrationStageSource).toContain(
      "controller.skipCurrentBlockingInteraction();",
    );
  });

  it("exposes Skip Movement only for active Climate blocking targets", () => {
    expect(climateStageSource).toContain("showSkipMovementButton");
    expect(climateStageSource).toContain(
      "controller.canSkipCurrentBlockingInteraction.value",
    );
    expect(climateStageSource).toContain("!isUserPaused.value");
    expect(climateStageSource).toContain("!act4Store.isCompleted");
    expect(climateStageSource).toContain("!runtimeStore.showContinueGate");
    expect(climateStageSource).toContain("climate-act-skip-button");
    expect(climateStageSource).toContain(
      "story.acts.act4.controls.skipMovement",
    );
    expect(climateStageSource).toContain(
      "controller.skipCurrentBlockingInteraction();",
    );
    expect(climateStageSource).toContain(
      "cancelQueuedSeasonRestart: cycle.cancelQueuedSeasonRestart",
    );
    expect(climateStageSource).toContain(
      "waitForNextBarBoundary: cycle.waitForNextBarBoundary",
    );
  });

  it("keeps Pause visible outside Debug in all movement-active stages", () => {
    expect(migrationStageSource).toContain("showPauseButton");
    expect(migrationStageSource).toContain("migration-pause-button");
    expect(migrationStageSource).toContain("showMigrationDebugDock");
    expect(climateStageSource).toContain("showPauseButton");
    expect(climateStageSource).toContain("climate-act-pause-button");
    expect(climateStageSource).toContain("climate-act-debug-button");
  });

  it("prevents a held PageUp from pausing and immediately navigating home", () => {
    const firstPageUp = getPresenterActionForEvent(
      {
        key: "PageUp",
        repeat: false,
        target: { tagName: "button" } as unknown as EventTarget,
      },
      true,
    );
    const firstResult = applyPresenterAction("running", firstPageUp);

    expect(firstResult.calls).toEqual(["pause"]);
    expect(firstResult.context).toBe("paused");

    const repeatedPageUp = getPresenterActionForEvent(
      {
        key: "PageUp",
        repeat: true,
        target: { tagName: "button" } as unknown as EventTarget,
      },
      true,
    );
    const repeatResult = applyPresenterAction(
      firstResult.context,
      repeatedPageUp,
    );

    expect(repeatResult.calls).toEqual([]);
    expect(repeatResult.context).toBe("paused");
  });

  it("keeps a single non-repeat PageUp event as exactly one pause action", () => {
    const action = getPresenterActionForEvent(
      {
        key: "PageUp",
        repeat: false,
        target: { tagName: "button" } as unknown as EventTarget,
      },
      true,
    );

    expect(applyPresenterAction("running", action)).toEqual({
      calls: ["pause"],
      context: "paused",
    });
  });

  it("maps one non-repeat PageDown to one skip only while running and skippable", () => {
    const action = getPresenterActionForEvent(
      {
        key: "PageDown",
        repeat: false,
        target: { tagName: "button" } as unknown as EventTarget,
      },
      true,
    );

    expect(applyPresenterAction("running", action)).toEqual({
      calls: [],
      context: "running",
    });
    expect(applyPresenterAction("running", action, true)).toEqual({
      calls: ["skip"],
      context: "running",
    });
    expect(applyPresenterAction("paused", action, true)).toEqual({
      calls: ["resume"],
      context: "running",
    });

    const repeatedAction = getPresenterActionForEvent(
      {
        key: "PageDown",
        repeat: true,
        target: { tagName: "button" } as unknown as EventTarget,
      },
      true,
    );

    expect(applyPresenterAction("running", repeatedAction, true)).toEqual({
      calls: [],
      context: "running",
    });
  });
});
