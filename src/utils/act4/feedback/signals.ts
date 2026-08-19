import type {
  Act4BodyRegion,
  Act4CriterionFeedbackMetadata,
  Act4FeedbackCriterionLike,
  Act4FeedbackSignal,
} from "~/types/act4";
import type { ClimateSeason } from "~/types/climate";

const trackingCodeForRegion = (bodyRegion: Act4BodyRegion) => {
  if (bodyRegion === "hands") return "HANDS_NOT_VISIBLE";
  if (bodyRegion === "upperBody") return "UPPER_BODY_NOT_VISIBLE";
  if (bodyRegion === "lowerBody") return "LOWER_BODY_NOT_VISIBLE";

  return "FULL_BODY_NOT_VISIBLE";
};

const defaultMetadataForCode = (
  code: string,
): Act4CriterionFeedbackMetadata => {
  if (
    code === "FULL_BODY_NOT_VISIBLE" ||
    code === "UPPER_BODY_NOT_VISIBLE" ||
    code === "LOWER_BODY_NOT_VISIBLE" ||
    code === "HANDS_NOT_VISIBLE"
  ) {
    return {
      category: "tracking",
      bodyRegion:
        code === "UPPER_BODY_NOT_VISIBLE"
          ? "upperBody"
          : code === "LOWER_BODY_NOT_VISIBLE"
            ? "lowerBody"
            : code === "HANDS_NOT_VISIBLE"
              ? "hands"
              : "fullBody",
      priority: 0,
    };
  }

  if (code === "TRY_AGAIN") {
    return {
      category: "generic",
      bodyRegion: null,
      priority: 999,
    };
  }

  return {
    category: "form",
    bodyRegion: null,
    priority: 500,
  };
};

export const getAct4SignalMetadata = <TCode extends string>(
  codeMetadata: Partial<Record<TCode | string, Act4CriterionFeedbackMetadata>>,
  criterionMetadata: Partial<Record<string, Act4CriterionFeedbackMetadata>>,
  criterionId: string | null,
  code: string,
) =>
  (criterionId ? criterionMetadata[criterionId] : undefined) ??
  codeMetadata[code] ??
  defaultMetadataForCode(code);

export const buildAct4BeatFeedbackSignals = <TCode extends string>({
  season,
  beat,
  measureIndex,
  criteria,
  trackingUnavailable,
  fallbackCode,
  codeMetadata,
  criterionMetadata,
  missedBeatSample = false,
  landmarkConfidence,
}: {
  season: ClimateSeason;
  beat: number;
  measureIndex: number | null;
  criteria: Act4FeedbackCriterionLike<TCode>[];
  trackingUnavailable: boolean;
  fallbackCode?: TCode;
  codeMetadata: Partial<Record<TCode | string, Act4CriterionFeedbackMetadata>>;
  criterionMetadata?: Partial<Record<string, Act4CriterionFeedbackMetadata>>;
  missedBeatSample?: boolean;
  landmarkConfidence?: string;
}): Act4FeedbackSignal<TCode>[] => {
  const signals: Act4FeedbackSignal<TCode>[] = [];

  if (trackingUnavailable && criteria.length === 0) {
    signals.push({
      code: (fallbackCode ?? "FULL_BODY_NOT_VISIBLE") as TCode,
      category: "tracking",
      season,
      beat,
      measureIndex,
      criterionId: null,
      bodyRegion: "fullBody",
      essential: true,
      evaluable: false,
      confidence: missedBeatSample ? 0.45 : 0.9,
      severity: missedBeatSample ? 0.45 : 1,
      evidence: {
        missedBeatSample,
        landmarkConfidence,
      },
    });
  }

  criteria.forEach((criterion) => {
    const code = criterion.feedbackCode;

    if (criterion.status === "failed" && code) {
      const metadata = getAct4SignalMetadata(
        codeMetadata,
        criterionMetadata ?? {},
        criterion.id,
        code,
      );

      signals.push({
        code,
        category: metadata.category,
        season,
        beat,
        measureIndex,
        criterionId: criterion.id,
        bodyRegion: metadata.bodyRegion,
        essential: criterion.importance === "essential",
        evaluable: true,
        confidence: criterion.importance === "essential" ? 0.85 : 0.65,
        severity: 1 - (typeof criterion.debugValue === "number" ? 0 : 0.15),
        evidence: {
          debugValue: criterion.debugValue,
          expectedRange: criterion.expectedRange,
          optionalLowerBody: metadata.optionalLowerBody === true,
        },
      });
    }

    if (criterion.status === "notEvaluable") {
      const metadata = getAct4SignalMetadata(
        codeMetadata,
        criterionMetadata ?? {},
        criterion.id,
        code ?? fallbackCode ?? "TRY_AGAIN",
      );

      if (metadata.optionalLowerBody || criterion.importance !== "essential") {
        return;
      }

      signals.push({
        code: (metadata.trackingCode ??
          trackingCodeForRegion(metadata.bodyRegion)) as TCode,
        category: "tracking",
        season,
        beat,
        measureIndex,
        criterionId: criterion.id,
        bodyRegion: metadata.bodyRegion,
        essential: true,
        evaluable: false,
        confidence: 0.75,
        severity: 0.8,
        evidence: {
          debugValue: criterion.debugValue,
          expectedRange: criterion.expectedRange,
          landmarkConfidence,
        },
      });
    }
  });

  return signals;
};
