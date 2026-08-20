import { describe, expect, it } from "vitest";

import { buildAct4TutorialSequence } from "~/utils/act4/sequence";
import en from "~/locales/en.json";
import {
  act4TutorialNarrationCatalog,
  formatSpokenPercent,
  resolveAct4SeasonCompletionNarration,
  resolveAct4TutorialNarration,
} from "~/utils/act4/tutorialNarration";

describe("Act 4 tutorial narration", () => {
  it("defines every required tutorial narration key", () => {
    expect(
      Object.values(act4TutorialNarrationCatalog).map((cue) => cue.textKey),
    ).toEqual(
      expect.arrayContaining([
        "story.acts.act4.narration.tutorial.intro.context",
        "story.acts.act4.narration.tutorial.intro.encoding",
        "story.acts.act4.narration.tutorial.intro.scale",
        "story.acts.act4.narration.tutorial.intro.range",
        "story.acts.act4.narration.tutorial.intro.measureLength",
        "story.acts.act4.narration.tutorial.intro.watchThenMove",
        "story.acts.act4.narration.tutorial.winter.encoding",
        "story.acts.act4.narration.tutorial.winter.example",
        "story.acts.act4.narration.tutorial.winter.maximum",
        "story.acts.act4.narration.tutorial.winter.minimum",
        "story.acts.act4.narration.tutorial.winter.complete",
        "story.acts.act4.narration.tutorial.spring.encoding",
        "story.acts.act4.narration.tutorial.spring.maximum",
        "story.acts.act4.narration.tutorial.spring.minimum",
        "story.acts.act4.narration.tutorial.spring.complete",
        "story.acts.act4.narration.tutorial.summer.encoding",
        "story.acts.act4.narration.tutorial.summer.maximum",
        "story.acts.act4.narration.tutorial.summer.minimum",
        "story.acts.act4.narration.tutorial.summer.complete",
        "story.acts.act4.narration.tutorial.autumn.encoding",
        "story.acts.act4.narration.tutorial.autumn.maximum",
        "story.acts.act4.narration.tutorial.autumn.minimum",
        "story.acts.act4.narration.tutorial.autumn.complete",
      ]),
    );
  });

  it("keeps the deterministic tutorial target order", () => {
    expect(
      buildAct4TutorialSequence().map((target) => [
        target.season,
        target.movementValue,
      ]),
    ).toEqual([
      ["winter", 20],
      ["winter", 100],
      ["winter", -10],
      ["spring", 100],
      ["spring", 20],
      ["summer", 100],
      ["summer", 10],
      ["autumn", 100],
      ["autumn", 25],
    ]);
  });

  it("prepends the global introduction before the first winter example", () => {
    const target = buildAct4TutorialSequence()[0];

    expect(target).toBeDefined();

    expect(
      resolveAct4TutorialNarration({
        target: target!,
        targetIndex: 0,
        flowId: "act4Full",
      }).cues.map((cue) => cue.id),
    ).toEqual([
      "act4.tutorial.intro.context",
      "act4.tutorial.intro.encoding",
      "act4.tutorial.intro.scale",
      "act4.tutorial.intro.range",
      "act4.tutorial.intro.measureLength",
      "act4.tutorial.intro.watchThenMove",
      "act4.tutorial.winter.encoding",
      "act4.tutorial.winter.example",
    ]);
  });

  it("explains German seasonal averages and the movement scale", () => {
    const contextText = en.story.acts.act4.narration.tutorial.intro.context;
    const encodingText = en.story.acts.act4.narration.tutorial.intro.encoding;
    const scaleText = en.story.acts.act4.narration.tutorial.intro.scale;
    const rangeText = en.story.acts.act4.narration.tutorial.intro.range;

    expect(contextText).toContain("seasonal average temperatures in Germany");
    expect(encodingText).toContain("winter, spring, summer, and autumn");
    expect(encodingText).toContain("1995 to 1999 reference period");
    expect(scaleText).toContain("Each season has its own dance movement");
    expect(rangeText).toContain("Zero percent means no change");
    expect(rangeText).toContain("2.33 degrees");
  });

  it("names each tutorial season inside the existing encoding cue", () => {
    expect(en.story.acts.act4.narration.tutorial.winter.encoding).toBe(
      "First, winter. Watch a 20 percent example: open your arms on one, wrap them in on two, then let your body height show the value.",
    );
    expect(en.story.acts.act4.narration.tutorial.spring.encoding).toBe(
      "Next, spring. The movement opens like a plant growing upward. The height of your arm arc carries the value.",
    );
    expect(en.story.acts.act4.narration.tutorial.summer.encoding).toBe(
      "Now, summer. The movement draws a sun-like circle. The size of the circle carries the value.",
    );
    expect(en.story.acts.act4.narration.tutorial.autumn.encoding).toBe(
      "Finally, autumn. The movement sweeps sideways like wind moving leaves. The distance of the sweep carries the value.",
    );
  });

  it("explains the value-bearing body part and optional leg movement", () => {
    const tutorial = en.story.acts.act4.narration.tutorial;

    expect(tutorial.winter.maximum).toContain("stay upright on count three");
    expect(tutorial.spring.maximum).toContain("knee; that is optional");
    expect(tutorial.spring.minimum).toContain("arm height is what counts");
    expect(tutorial.summer.maximum).toContain("circle size is the data");
    expect(tutorial.autumn.maximum).toContain("leg shift can help");
    expect(tutorial.autumn.maximum).toContain("optional");
  });

  it("resolves each target explanation cue without repeating the global intro", () => {
    expect(
      buildAct4TutorialSequence()
        .slice(1)
        .map((target, index) =>
          resolveAct4TutorialNarration({
            target,
            targetIndex: index + 1,
            flowId: "act4Full",
          }).cues.map((cue) => cue.id),
        ),
    ).toEqual([
      ["act4.tutorial.winter.maximum"],
      ["act4.tutorial.winter.minimum"],
      ["act4.tutorial.spring.encoding", "act4.tutorial.spring.maximum"],
      ["act4.tutorial.spring.minimum"],
      ["act4.tutorial.summer.encoding", "act4.tutorial.summer.maximum"],
      ["act4.tutorial.summer.minimum"],
      ["act4.tutorial.autumn.encoding", "act4.tutorial.autumn.maximum"],
      ["act4.tutorial.autumn.minimum"],
    ]);
  });

  it("does not add encoding cues before minimum targets", () => {
    const minimumCueIds = buildAct4TutorialSequence()
      .filter((target) => target.target === "minimum")
      .flatMap((target, index) =>
        resolveAct4TutorialNarration({
          target,
          targetIndex: index,
          flowId: "act4Full",
        }).cues.map((cue) => cue.id),
      );

    expect(minimumCueIds).not.toContain("act4.tutorial.winter.encoding");
    expect(minimumCueIds).not.toContain("act4.tutorial.spring.encoding");
    expect(minimumCueIds).not.toContain("act4.tutorial.summer.encoding");
    expect(minimumCueIds).not.toContain("act4.tutorial.autumn.encoding");
  });

  it("resolves season completion only after minimum targets", () => {
    const sequence = buildAct4TutorialSequence();

    expect(resolveAct4SeasonCompletionNarration(sequence[0]!)).toBeNull();
    expect(resolveAct4SeasonCompletionNarration(sequence[1]!)).toBeNull();
    expect(resolveAct4SeasonCompletionNarration(sequence[2]!)?.id).toBe(
      "act4.tutorial.winter.complete",
    );
  });

  it("formats negative percentages naturally for speech", () => {
    expect(formatSpokenPercent(-10)).toBe("minus 10");
    expect(formatSpokenPercent(25)).toBe("25");
  });
});
