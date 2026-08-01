import { describe, expect, it } from "vitest";

import {
  springCriterionFeedbackMetadata,
  springFeedbackMetadata,
  summerCriterionFeedbackMetadata,
  summerFeedbackMetadata,
} from "~/utils/act5/feedback/catalog";
import { buildAct5BeatFeedbackSignals } from "~/utils/act5/feedback/signals";
import { selectAct5FinalFeedback } from "~/utils/act5/feedback/selectFinalFeedback";
import type { Act5FeedbackSignal } from "~/types/act5";
import type { SpringFeedbackCode } from "~/utils/movement/acts/climate/spring/springTypes";
import type { SummerFeedbackCode } from "~/utils/movement/acts/climate/summer/summerTypes";

const springSignal = (
  code: SpringFeedbackCode,
  measureIndex: number,
  overrides: Partial<Act5FeedbackSignal<SpringFeedbackCode>> = {},
): Act5FeedbackSignal<SpringFeedbackCode> => ({
  code,
  category: "intensity",
  season: "spring",
  beat: 2,
  measureIndex,
  criterionId: "value-hand-height",
  bodyRegion: "hands",
  essential: true,
  evaluable: true,
  confidence: 0.85,
  severity: 0.9,
  ...overrides,
});

const selectSpring = (signals: Act5FeedbackSignal<SpringFeedbackCode>[]) =>
  selectAct5FinalFeedback<SpringFeedbackCode>({
    season: "spring",
    beatEvaluations: signals.map((signal, index) => ({
      beat: (signal.beat ?? 2) as 1 | 2 | 3 | 4,
      measureIndex: signal.measureIndex,
      score: 0,
      passed: false,
      trackingUnavailable: signal.category === "tracking",
      criteria: [],
      feedbackCode: signal.code,
      feedbackSignals: [signal],
      timestamp: index,
      expectedValue: "20",
      expectedKneeSide: "unknown",
      metrics: {} as never,
    })),
    codeMetadata: springFeedbackMetadata,
    criterionMetadata: springCriterionFeedbackMetadata,
    fallbackCode: "TRY_AGAIN",
  });

describe("Act 5 final feedback selector", () => {
  it("selects Spring lower-bloom feedback for three too-high measures", () => {
    const selected = selectSpring([
      springSignal("KEEP_BLOOM_LOWER", 0),
      springSignal("KEEP_BLOOM_LOWER", 1),
      springSignal("KEEP_BLOOM_LOWER", 2),
    ]);

    expect(selected.code).toBe("KEEP_BLOOM_LOWER");
    expect(selected.evidence.measureCount).toBe(3);
  });

  it("keeps Spring 20% intensity feedback over one isolated wrist gap", () => {
    const selected = selectSpring([
      springSignal("KEEP_BLOOM_LOWER", 0),
      springSignal("HANDS_NOT_VISIBLE", 1, {
        category: "tracking",
        evaluable: false,
        confidence: 0.75,
        severity: 0.8,
      }),
      springSignal("KEEP_BLOOM_LOWER", 2),
    ]);

    expect(selected.code).toBe("KEEP_BLOOM_LOWER");
  });

  it("selects hands-not-visible for repeated hand-only tracking", () => {
    const selected = selectSpring([
      springSignal("HANDS_NOT_VISIBLE", 0, {
        category: "tracking",
        evaluable: false,
      }),
      springSignal("HANDS_NOT_VISIBLE", 1, {
        category: "tracking",
        evaluable: false,
      }),
    ]);

    expect(selected.code).toBe("HANDS_NOT_VISIBLE");
    expect(selected.evidence.severeTracking).toBe(true);
  });

  it("selects full-body tracking when body reference is repeatedly missing", () => {
    const selected = selectSpring([
      springSignal("FULL_BODY_NOT_VISIBLE", 0, {
        category: "tracking",
        bodyRegion: "fullBody",
        criterionId: null,
        evaluable: false,
      }),
      springSignal("FULL_BODY_NOT_VISIBLE", 1, {
        category: "tracking",
        bodyRegion: "fullBody",
        criterionId: null,
        evaluable: false,
      }),
    ]);

    expect(selected.code).toBe("FULL_BODY_NOT_VISIBLE");
    expect(selected.category).toBe("tracking");
  });

  it("lets repeated Spring start-pose errors outrank height mismatch", () => {
    const selected = selectSpring([
      springSignal("START_HANDS_LOW", 0, {
        category: "startPose",
        criterionId: "hands-start-low",
      }),
      springSignal("START_HANDS_LOW", 1, {
        category: "startPose",
        criterionId: "hands-start-low",
      }),
      springSignal("KEEP_BLOOM_LOWER", 2),
    ]);

    expect(selected.code).toBe("START_HANDS_LOW");
  });

  it("does not create optional lower-body tracking signals", () => {
    const signals = buildAct5BeatFeedbackSignals<SummerFeedbackCode>({
      season: "summer",
      beat: 4,
      measureIndex: 0,
      criteria: [
        {
          id: "feet-returned-close",
          status: "notEvaluable",
          passed: false,
          importance: "supporting",
        },
      ],
      trackingUnavailable: false,
      fallbackCode: "RETURN_FEET_TO_CENTER",
      codeMetadata: summerFeedbackMetadata,
      criterionMetadata: summerCriterionFeedbackMetadata,
    });

    expect(signals).toEqual([]);
  });

  it("keeps Summer expansion feedback over optional feet feedback", () => {
    const selected = selectAct5FinalFeedback<SummerFeedbackCode>({
      season: "summer",
      beatEvaluations: [
        {
          beat: 3,
          measureIndex: 0,
          score: 0,
          passed: false,
          trackingUnavailable: false,
          criteria: [],
          feedbackCode: "MOVEMENT_TOO_LARGE",
          feedbackSignals: [
            {
              code: "MOVEMENT_TOO_LARGE",
              category: "intensity",
              season: "summer",
              beat: 3,
              measureIndex: 0,
              criterionId: "arm-opening-target",
              bodyRegion: "hands",
              essential: false,
              evaluable: true,
              confidence: 0.65,
              severity: 0.9,
            },
          ],
          metrics: {} as never,
        },
        {
          beat: 4,
          measureIndex: 1,
          score: 0,
          passed: false,
          trackingUnavailable: false,
          criteria: [],
          feedbackCode: "RETURN_FEET_TO_CENTER",
          feedbackSignals: [
            {
              code: "RETURN_FEET_TO_CENTER",
              category: "returnPose",
              season: "summer",
              beat: 4,
              measureIndex: 1,
              criterionId: "feet-returned-close",
              bodyRegion: "lowerBody",
              essential: false,
              evaluable: true,
              confidence: 0.65,
              severity: 0.9,
            },
          ],
          metrics: {} as never,
        },
      ],
      codeMetadata: summerFeedbackMetadata,
      criterionMetadata: summerCriterionFeedbackMetadata,
      fallbackCode: "TRY_AGAIN",
    });

    expect(selected.code).toBe("MOVEMENT_TOO_LARGE");
  });

  it("falls back to generic retry when no reliable signal exists", () => {
    const selected = selectSpring([]);

    expect(selected.code).toBe("TRY_AGAIN");
    expect(selected.category).toBe("generic");
  });
});
