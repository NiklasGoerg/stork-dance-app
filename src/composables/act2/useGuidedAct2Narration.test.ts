import { describe, expect, it, vi } from "vitest";
import {
  GUIDED_ACT2_NARRATION_RATE,
  useGuidedAct2Narration,
} from "~/composables/act2/useGuidedAct2Narration";
import type { NarrationResult, NarrationSpeakOptions } from "~/types/narration";

const tokens = {
  breedingArea: "Germany",
  winteringArea: "Chad",
  departureMonth: "August",
  southboundRoute: "south across Europe",
  northboundRoute: "north across Europe",
};

const createHarness = () => {
  let transportMs = 0;
  const pending: Array<{
    options: NarrationSpeakOptions;
    resolve: (result: NarrationResult) => void;
  }> = [];
  const speakText = vi.fn(
    (_text: string, options: NarrationSpeakOptions = {}) =>
      new Promise<NarrationResult>((resolve) => {
        pending.push({ options, resolve });
      }),
  );
  const stop = vi.fn();
  const scheduler = useGuidedAct2Narration({
    narration: { speakText, stop },
    getTransportMs: () => transportMs,
    getTokens: () => tokens,
  });
  const advance = (deltaMs: number) => {
    transportMs += deltaMs;
  };
  const start = (index = pending.length - 1) =>
    pending[index]?.options.onStart?.({
      rate: GUIDED_ACT2_NARRATION_RATE,
      voiceName: "Test voice",
    });
  const end = (
    index = pending.length - 1,
    result: NarrationResult = { status: "completed" },
  ) => {
    pending[index]?.options.onEnd?.({
      status: result.status,
      rate: GUIDED_ACT2_NARRATION_RATE,
      voiceName: "Test voice",
    });
    pending[index]?.resolve(result);
  };
  return { scheduler, speakText, stop, pending, advance, start, end };
};

describe("useGuidedAct2Narration", () => {
  it("starts display with actual speech and keeps it through completion", async () => {
    const { scheduler, advance, start, end } = createHarness();
    scheduler.enterPhase("journey-introduction");
    scheduler.present("act2.introduction.annualJourney", "run-1:intro");

    expect(scheduler.panelContent.value.id).toBe("act2.introduction.title");
    expect(scheduler.diagnostics.value.currentNarrationState).toBe("ready");
    advance(140);
    start();
    expect(scheduler.panelContent.value.id).toBe(
      "act2.introduction.annualJourney",
    );
    expect(scheduler.diagnostics.value.displaySpeechLeadMs).toBe(0);

    advance(3_100);
    end();
    await Promise.resolve();
    expect(scheduler.diagnostics.value.actualDurationMs).toBe(3_100);
    expect(scheduler.diagnostics.value.currentNarrationState).toBe("completed");
    expect(scheduler.panelContent.value.id).toBe(
      "act2.introduction.annualJourney",
    );
  });

  it("expires a cue that misses its 250 ms start window", () => {
    const { scheduler, advance, start, stop } = createHarness();
    scheduler.enterPhase("summer-story-transition");
    scheduler.present("act2.summer.story.breeding", "run-1:story:0");
    advance(251);
    start();

    expect(stop).toHaveBeenCalledOnce();
    expect(scheduler.diagnostics.value.currentNarrationState).toBe("expired");
    expect(scheduler.diagnostics.value.skipReason).toBe("latest-start-missed");
    expect(scheduler.panelContent.value.id).toBe("act2.introduction.title");
  });

  it("does not display speech that is cancelled before it starts", async () => {
    const { scheduler, end } = createHarness();
    scheduler.enterPhase("journey-introduction");
    scheduler.present("act2.introduction.annualJourney", "run-1:intro");

    end(0, { status: "cancelled" });
    await Promise.resolve();

    expect(scheduler.panelContent.value.id).toBe("act2.introduction.title");
    expect(scheduler.diagnostics.value.currentNarrationState).toBe("skipped");
    expect(scheduler.diagnostics.value.skipReason).toBe("tts-cancelled");
  });

  it("skips lower-priority context while a protected handover is active", () => {
    const { scheduler, start, speakText } = createHarness();
    scheduler.enterPhase("summer-practice-prompt");
    scheduler.present("act2.summer.handover", "run-1:handover");
    start();
    scheduler.enterPhase("summer-story-transition");
    scheduler.present("act2.summer.story.breeding", "run-1:story:0");

    expect(speakText).toHaveBeenCalledOnce();
    expect(scheduler.panelContent.value.id).toBe("act2.summer.handover");
    expect(scheduler.diagnostics.value.events.at(-1)).toMatchObject({
      id: "act2.summer.story.breeding",
      outcome: "priority",
    });
  });

  it("cancels stale optional speech on phase change and reset", () => {
    const { scheduler, start, stop } = createHarness();
    scheduler.enterPhase("summer-story-transition");
    scheduler.present("act2.summer.story.breeding", "run-1:story:0");
    start();
    scheduler.enterPhase("autumn-departure-context");
    expect(stop).toHaveBeenCalledOnce();
    expect(scheduler.diagnostics.value.cancellationReason).toContain("phase:");

    scheduler.reset("test-reset");
    expect(scheduler.panelContent.value.id).toBe("act2.introduction.title");
  });

  it("ignores a stale speech-start callback after reset", () => {
    const { scheduler, start, stop } = createHarness();
    scheduler.enterPhase("journey-introduction");
    scheduler.present("act2.introduction.annualJourney", "run-1:intro");

    scheduler.reset("test-reset-before-start");
    start(0);

    expect(stop).toHaveBeenCalledOnce();
    expect(scheduler.panelContent.value.id).toBe("act2.introduction.title");
    expect(scheduler.diagnostics.value.currentNarrationState).toBe("idle");
  });

  it("keeps success feedback visible when a lower-priority progress cue arrives", () => {
    const { scheduler, start, speakText } = createHarness();
    scheduler.enterPhase("summer-success");
    scheduler.present("act2.summer.success", "run-1:summer-success");
    start();
    scheduler.enterPhase("summer-story-transition");
    scheduler.present("act2.summer.story.breeding", "run-1:story:0");

    expect(speakText).toHaveBeenCalledOnce();
    expect(scheduler.panelContent.value.id).toBe("act2.summer.success");
    expect(scheduler.diagnostics.value.events.at(-1)).toMatchObject({
      id: "act2.summer.story.breeding",
      outcome: "priority",
    });
  });

  it("ignores disabled movement failures but retains technical tracking", () => {
    const { scheduler, speakText, start } = createHarness();
    const failures = [
      ["summer-practice", "act2.summer.failure.noMovement"],
      ["autumn-migration-practice", "act2.autumnMigration.failure.incomplete"],
      ["winter-practice", "act2.winter.failure.noMovement"],
      ["spring-migration-practice", "act2.springMigration.failure.incomplete"],
    ] as const;
    failures.forEach(([phase, id], index) => {
      scheduler.enterPhase(phase);
      scheduler.present(id, `failure-${index}`);
    });
    expect(speakText).not.toHaveBeenCalled();
    expect(scheduler.panelContent.value.id).toBe("act2.introduction.title");

    scheduler.present("act2.feedback.bodyNotVisible", "tracking-1");
    start();
    expect(speakText).toHaveBeenCalledOnce();
    expect(scheduler.panelContent.value.id).toBe(
      "act2.feedback.bodyNotVisible",
    );
  });

  it("configures the Guided rate exactly once in the natural range", () => {
    const { scheduler, speakText } = createHarness();
    scheduler.enterPhase("journey-introduction");
    scheduler.present("act2.introduction.annualJourney", "run-1:intro");

    expect(GUIDED_ACT2_NARRATION_RATE).toBeGreaterThanOrEqual(1);
    expect(GUIDED_ACT2_NARRATION_RATE).toBeLessThanOrEqual(1.25);
    expect(speakText.mock.calls[0]?.[1]?.rate).toBe(1.15);
  });
});
