import { describe, expect, it } from "vitest";

import { buildAct5TutorialSequence } from "~/utils/act5/sequence";
import en from "~/locales/en.json";
import {
  act5TutorialNarrationCatalog,
  formatSpokenPercent,
  resolveAct5SeasonCompletionNarration,
  resolveAct5TutorialNarration,
} from "~/utils/act5/tutorialNarration";

describe("Act 5 tutorial narration", () => {
  it("defines every required tutorial narration key", () => {
    expect(Object.values(act5TutorialNarrationCatalog).map((cue) => cue.textKey))
      .toEqual(
        expect.arrayContaining([
          "story.acts.act5.narration.tutorial.intro.context",
          "story.acts.act5.narration.tutorial.intro.encoding",
          "story.acts.act5.narration.tutorial.intro.scale",
          "story.acts.act5.narration.tutorial.intro.range",
          "story.acts.act5.narration.tutorial.intro.measureLength",
          "story.acts.act5.narration.tutorial.intro.watchThenMove",
          "story.acts.act5.narration.tutorial.winter.encoding",
          "story.acts.act5.narration.tutorial.winter.maximum",
          "story.acts.act5.narration.tutorial.winter.minimum",
          "story.acts.act5.narration.tutorial.winter.complete",
          "story.acts.act5.narration.tutorial.spring.encoding",
          "story.acts.act5.narration.tutorial.spring.maximum",
          "story.acts.act5.narration.tutorial.spring.minimum",
          "story.acts.act5.narration.tutorial.spring.complete",
          "story.acts.act5.narration.tutorial.summer.encoding",
          "story.acts.act5.narration.tutorial.summer.maximum",
          "story.acts.act5.narration.tutorial.summer.minimum",
          "story.acts.act5.narration.tutorial.summer.complete",
          "story.acts.act5.narration.tutorial.autumn.encoding",
          "story.acts.act5.narration.tutorial.autumn.maximum",
          "story.acts.act5.narration.tutorial.autumn.minimum",
          "story.acts.act5.narration.tutorial.autumn.complete",
        ]),
      );
  });

  it("keeps the deterministic tutorial target order", () => {
    expect(
      buildAct5TutorialSequence().map((target) => [
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
    const target = buildAct5TutorialSequence()[0];

    expect(target).toBeDefined();

    expect(
      resolveAct5TutorialNarration({
        target: target!,
        targetIndex: 0,
        flowId: "act5Full",
      }).cues.map((cue) => cue.id),
    ).toEqual([
      "act5.tutorial.intro.context",
      "act5.tutorial.intro.encoding",
      "act5.tutorial.intro.scale",
      "act5.tutorial.intro.range",
      "act5.tutorial.intro.measureLength",
      "act5.tutorial.intro.watchThenMove",
      "act5.tutorial.winter.encoding",
      "act5.tutorial.winter.maximum",
    ]);
  });

  it("explains the temperature-difference scale before season encoding", () => {
    const scaleText = en.story.acts.act5.narration.tutorial.intro.scale;

    expect(scaleText).toContain("2.33 degrees");
    expect(scaleText).toContain("100 percent");
    expect(scaleText).toContain("50 percent");
    expect(scaleText).toContain("1.17 degrees");
  });

  it("names each tutorial season inside the existing encoding cue", () => {
    expect(en.story.acts.act5.narration.tutorial.winter.encoding).toBe(
      "First, winter. Your body height carries the value. At 100 percent, you stay at full height; lower values bring your body lower.",
    );
    expect(en.story.acts.act5.narration.tutorial.spring.encoding).toBe(
      "Next, spring. The arm arc carries the value. At 100 percent, complete the full arc above your head; at 50 percent, you would stop around shoulder height.",
    );
    expect(en.story.acts.act5.narration.tutorial.summer.encoding).toBe(
      "Now, summer. The circle size carries the value. Start with your hands at your chest: at 100 percent, reach fully up and trace the largest circle; smaller values create a smaller circle.",
    );
    expect(en.story.acts.act5.narration.tutorial.autumn.encoding).toBe(
      "Finally, autumn. The sweep distance carries the value. At 100 percent, move all the way from one side to the other; at 50 percent, you would stop in front of your chest.",
    );
  });

  it("resolves each target explanation cue without repeating the global intro", () => {
    expect(
      buildAct5TutorialSequence()
        .slice(1)
        .map((target, index) =>
          resolveAct5TutorialNarration({
            target,
            targetIndex: index + 1,
            flowId: "act5Full",
          }).cues.map((cue) => cue.id),
        ),
    ).toEqual([
      ["act5.tutorial.winter.minimum"],
      ["act5.tutorial.spring.encoding", "act5.tutorial.spring.maximum"],
      ["act5.tutorial.spring.minimum"],
      ["act5.tutorial.summer.encoding", "act5.tutorial.summer.maximum"],
      ["act5.tutorial.summer.minimum"],
      ["act5.tutorial.autumn.encoding", "act5.tutorial.autumn.maximum"],
      ["act5.tutorial.autumn.minimum"],
    ]);
  });

  it("does not add encoding cues before minimum targets", () => {
    const minimumCueIds = buildAct5TutorialSequence()
      .filter((target) => target.target === "minimum")
      .flatMap((target, index) =>
        resolveAct5TutorialNarration({
          target,
          targetIndex: index,
          flowId: "act5Full",
        }).cues.map((cue) => cue.id),
      );

    expect(minimumCueIds).not.toContain("act5.tutorial.winter.encoding");
    expect(minimumCueIds).not.toContain("act5.tutorial.spring.encoding");
    expect(minimumCueIds).not.toContain("act5.tutorial.summer.encoding");
    expect(minimumCueIds).not.toContain("act5.tutorial.autumn.encoding");
  });

  it("resolves season completion only after minimum targets", () => {
    const sequence = buildAct5TutorialSequence();

    expect(resolveAct5SeasonCompletionNarration(sequence[0]!)).toBeNull();
    expect(resolveAct5SeasonCompletionNarration(sequence[1]!)?.id).toBe(
      "act5.tutorial.winter.complete",
    );
  });

  it("formats negative percentages naturally for speech", () => {
    expect(formatSpokenPercent(-10)).toBe("minus 10");
    expect(formatSpokenPercent(25)).toBe("25");
  });
});
