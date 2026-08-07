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

const createHarness = ({
  withSpeech = true,
}: { withSpeech?: boolean } = {}) => {
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
    narration: withSpeech ? { speakText, stop } : { stop },
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

  it("allows a cold first TTS start inside the 1000 ms start window", () => {
    const { scheduler, advance, start, stop } = createHarness();
    scheduler.enterPhase("summer-story-transition");
    scheduler.present("act2.summer.story.breeding", "run-1:story:0");
    advance(700);
    start();

    expect(stop).not.toHaveBeenCalled();
    expect(scheduler.diagnostics.value.currentNarrationState).toBe("speaking");
    expect(scheduler.panelContent.value.id).toBe("act2.summer.story.breeding");
  });

  it("expires a cue that misses its 1000 ms start window", () => {
    const { scheduler, advance, start, stop } = createHarness();
    scheduler.enterPhase("summer-story-transition");
    scheduler.present("act2.summer.story.breeding", "run-1:story:0");
    advance(1_001);
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

  it("does not mark priority-blocked cues as permanently handled", async () => {
    const { scheduler, start, speakText } = createHarness();
    scheduler.enterPhase("summer-practice");
    scheduler.present("act2.feedback.bodyNotVisible", "run-1:tracking");
    start();
    expect(
      scheduler.present("act2.summer.progress", "run-1:summer:progress"),
    ).toBe(false);

    scheduler.reset("retry");
    scheduler.enterPhase("summer-practice");
    expect(
      scheduler.present("act2.summer.progress", "run-1:summer:progress"),
    ).toBe(true);

    expect(speakText).toHaveBeenCalledOnce();
    expect(scheduler.panelContent.value.id).toBe("act2.summer.progress");
  });

  it("cancels stale speech on phase change and reset", () => {
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

  it("does not let display-only updates invalidate active speech callbacks", () => {
    const { scheduler, start, end } = createHarness();
    scheduler.enterPhase("cycle-complete");
    scheduler.present("act2.completion.journeyComplete", "run-1:complete:0");
    start();
    scheduler.present("act2.completion.title", "run-1:complete:title");

    expect(scheduler.panelContent.value.id).toBe("act2.completion.title");
    end(0);
    expect(scheduler.diagnostics.value.currentNarrationState).toBe("completed");
  });

  it("shows text and completes cleanly when speakText is unavailable", () => {
    const { scheduler, speakText } = createHarness({ withSpeech: false });
    scheduler.enterPhase("journey-introduction");
    expect(scheduler.present("act2.introduction.annualJourney", "no-tts")).toBe(
      true,
    );

    expect(speakText).not.toHaveBeenCalled();
    expect(scheduler.panelContent.value.id).toBe(
      "act2.introduction.annualJourney",
    );
    expect(scheduler.diagnostics.value.currentNarrationState).toBe("completed");
  });

  it("discards a semantically stale cue before speech begins", () => {
    const { scheduler, advance, start, stop } = createHarness();
    scheduler.enterPhase("journey-introduction");
    scheduler.present("act2.introduction.annualJourney", "run-1:intro");
    scheduler.enterPhase("summer-demonstration");
    advance(500);
    start();

    expect(stop).toHaveBeenCalled();
    expect(scheduler.diagnostics.value.currentNarrationState).toBe("cancelled");
    expect(scheduler.diagnostics.value.cancellationReason).toContain("phase:");
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
    expect(speakText.mock.calls[0]?.[1]?.rate).toBe(GUIDED_ACT2_NARRATION_RATE);
  });
});
