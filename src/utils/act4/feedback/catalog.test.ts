import { describe, expect, it } from "vitest";

import { resolveAct4FeedbackNarrationCue } from "~/utils/act4/feedback/catalog";

describe("resolveAct4FeedbackNarrationCue", () => {
  it.each([
    [
      "spring",
      "FULL_BODY_NOT_VISIBLE",
      "story.acts.act4.narration.feedback.common.fullBodyNotVisible",
    ],
    [
      "spring",
      "HANDS_NOT_VISIBLE",
      "story.acts.act4.narration.feedback.common.handsNotVisible",
    ],
    [
      "winter",
      "UPPER_BODY_NOT_VISIBLE",
      "story.acts.act4.narration.feedback.common.upperBodyNotVisible",
    ],
    [
      "winter",
      "LOWER_BODY_NOT_VISIBLE",
      "story.acts.act4.narration.feedback.common.lowerBodyNotVisible",
    ],
    [
      "summer",
      "TRY_AGAIN",
      "story.acts.act4.narration.feedback.common.tryAgain",
    ],
    [
      "winter",
      "CROSS_ARMS_IN_FRONT",
      "story.acts.act4.narration.feedback.winter.crossArmsInFront",
    ],
    [
      "winter",
      "CONTRACT_MORE",
      "story.acts.act4.narration.feedback.winter.contractMore",
    ],
    [
      "spring",
      "START_HANDS_LOW",
      "story.acts.act4.narration.feedback.spring.startHandsLow",
    ],
    [
      "spring",
      "KEEP_BLOOM_LOWER",
      "story.acts.act4.narration.feedback.spring.keepBloomLower",
    ],
    [
      "summer",
      "ALTERNATE_STEP_SIDE",
      "story.acts.act4.narration.feedback.summer.alternateStepSide",
    ],
    [
      "summer",
      "MOVEMENT_TOO_LARGE",
      "story.acts.act4.narration.feedback.summer.movementTooLarge",
    ],
    [
      "autumn",
      "START_LEFT",
      "story.acts.act4.narration.feedback.autumn.startLeft",
    ],
    [
      "autumn",
      "ENDPOINT_TOO_SHORT",
      "story.acts.act4.narration.feedback.autumn.endpointTooShort",
    ],
    [
      "autumn",
      "SWEEP_FARTHER",
      "story.acts.act4.narration.feedback.autumn.insufficientProgress",
    ],
  ] as const)("maps %s %s to %s", (season, feedbackCode, expectedCueKey) => {
    expect(resolveAct4FeedbackNarrationCue(season, feedbackCode)).toBe(
      expectedCueKey,
    );
  });

  it.each([
    ["spring", "SUCCESS"],
    ["autumn", null],
    ["summer", undefined],
  ] as const)("returns null for %s %s", (season, feedbackCode) => {
    expect(resolveAct4FeedbackNarrationCue(season, feedbackCode)).toBeNull();
  });
});
