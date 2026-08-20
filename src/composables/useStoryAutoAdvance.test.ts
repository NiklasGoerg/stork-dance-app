import { describe, expect, it } from "vitest";
import autoAdvanceSource from "~/composables/useStoryAutoAdvance?raw";
import migrationStageSource from "~/components/story/MigrationActStage.vue?raw";
import climateStageSource from "~/components/act4/ClimateActStage.vue?raw";

describe("story auto advance source wiring", () => {
  it("continues the runtime gate and navigates to the next story route once", () => {
    expect(autoAdvanceSource).toContain("const advancing = ref(false)");
    expect(autoAdvanceSource).toContain("runtimeStore.currentAct?.nextActId");
    expect(autoAdvanceSource).toContain("storyEngine.continueFromGate()");
    expect(autoAdvanceSource).toContain("navigateTo(`/story/${nextActId}`)");
  });

  it("wires Act II guided completion and Act III gate completion to auto advance", () => {
    expect(migrationStageSource).toContain("useStoryAutoAdvance");
    expect(migrationStageSource).toContain("onGuidedCycleCompleted");
    expect(migrationStageSource).toContain("runtimeStore.completeAct()");
    expect(migrationStageSource).toContain("await advanceToNextAct()");
    expect(migrationStageSource).toContain('props.act.id === "act-3"');
    expect(migrationStageSource).toContain("runtimeStore.showContinueGate");
  });

  it("wires Climate gate completion to auto advance while keeping Epilogue final", () => {
    expect(climateStageSource).toContain("useStoryAutoAdvance");
    expect(climateStageSource).toContain("runtimeStore.showContinueGate");
    expect(climateStageSource).toContain("void advanceToNextAct()");
  });
});
