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

  it("prepends the global introduction before the first winter maximum", () => {
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
      "act4.tutorial.winter.maximum",
    ]);
  });

  it("explains the temperature-difference scale before season encoding", () => {
    const scaleText = en.story.acts.act4.narration.tutorial.intro.scale;

    expect(scaleText).toContain("2.33 degrees");
    expect(scaleText).toContain("100 percent");
    expect(scaleText).toContain("50 percent");
    expect(scaleText).toContain("1.17 degrees");
  });

  it("names each tutorial season inside the existing encoding cue", () => {
    expect(en.story.acts.act4.narration.tutorial.winter.encoding).toBe(
      "First, winter. Your body height carries the value. At 100 percent, you stay at full height; lower values bring your body lower.",
    );
    expect(en.story.acts.act4.narration.tutorial.spring.encoding).toBe(
      "Next, spring. The arm arc carries the value. At 100 percent, complete the full arc above your head; at 50 percent, you would stop around shoulder height.",
    );
    expect(en.story.acts.act4.narration.tutorial.summer.encoding).toBe(
      "Now, summer. The circle size carries the value. Start with your hands at your chest: at 100 percent, reach fully up and trace the largest circle; smaller values create a smaller circle.",
    );
    expect(en.story.acts.act4.narration.tutorial.autumn.encoding).toBe(
      "Finally, autumn. The sweep distance carries the value. At 100 percent, move all the way from one side to the other; at 50 percent, you would stop in front of your chest.",
    );
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
    expect(resolveAct4SeasonCompletionNarration(sequence[1]!)?.id).toBe(
      "act4.tutorial.winter.complete",
    );
  });

  it("formats negative percentages naturally for speech", () => {
    expect(formatSpokenPercent(-10)).toBe("minus 10");
    expect(formatSpokenPercent(25)).toBe("25");
  });
});
