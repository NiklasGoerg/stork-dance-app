import type {
  Act5BodyRegion,
  Act5FeedbackCategory,
  Act5FeedbackSelectionOptions,
  Act5SelectedFeedback,
} from "~/types/act5";
import type { ClimateSeason } from "~/types/climate";
import {
  buildAct5BeatFeedbackSignals,
  getAct5SignalMetadata,
} from "~/utils/act5/feedback/signals";

type SignalGroup<TCode extends string> = {
  code: TCode;
  category: Act5FeedbackCategory;
  season: ClimateSeason;
  bodyRegion: Act5BodyRegion;
  criterionIds: Set<string>;
  measureIndexes: Set<number>;
  beatKeys: Set<string>;
  essential: boolean;
  optionalLowerBody: boolean;
  confidenceTotal: number;
  confidenceCount: number;
  maxConfidence: number;
  maxSeverity: number;
  severeTracking: boolean;
  priority: number;
};

const categoryPriority = ({
  category,
  measureCount,
  confidence,
  optionalLowerBody,
  severeTracking,
}: {
  category: Act5FeedbackCategory;
  measureCount: number;
  confidence: number;
  optionalLowerBody: boolean;
  severeTracking: boolean;
}) => {
  if (severeTracking) return 1;
  if (optionalLowerBody) return 6;
  if (category === "startPose" || category === "direction") {
    return measureCount >= 2 || confidence >= 0.85 ? 2 : 4;
  }
  if (category === "intensity") return 3;
  if (category === "form") return 4;
  if (category === "returnPose" || category === "timing") return 5;
  if (category === "tracking") return 7;

  return 8;
};

const compareGroups = <TCode extends string>(
  left: SignalGroup<TCode>,
  right: SignalGroup<TCode>,
) => {
  const leftMeasureCount = left.measureIndexes.size;
  const rightMeasureCount = right.measureIndexes.size;
  const leftPriority = categoryPriority({
    category: left.category,
    measureCount: leftMeasureCount,
    confidence: left.maxConfidence,
    optionalLowerBody: left.optionalLowerBody,
    severeTracking: left.severeTracking,
  });
  const rightPriority = categoryPriority({
    category: right.category,
    measureCount: rightMeasureCount,
    confidence: right.maxConfidence,
    optionalLowerBody: right.optionalLowerBody,
    severeTracking: right.severeTracking,
  });

  return (
    leftPriority - rightPriority ||
    rightMeasureCount - leftMeasureCount ||
    right.beatKeys.size - left.beatKeys.size ||
    Number(right.essential) - Number(left.essential) ||
    right.maxConfidence - left.maxConfidence ||
    right.maxSeverity - left.maxSeverity ||
    left.priority - right.priority ||
    String(left.code).localeCompare(String(right.code))
  );
};

export const selectAct5FinalFeedback = <TCode extends string>({
  season,
  beatEvaluations,
  codeMetadata,
  criterionMetadata = {},
  fallbackCode,
}: Act5FeedbackSelectionOptions<TCode>): Act5SelectedFeedback<TCode> => {
  const reliableMovementSignalCount = beatEvaluations
    .flatMap((evaluation) => evaluation.feedbackSignals ?? [])
    .filter((signal) => signal.category !== "tracking").length;
  const signals = beatEvaluations.flatMap((evaluation) => {
    if (evaluation.feedbackSignals?.length) return evaluation.feedbackSignals;

    return buildAct5BeatFeedbackSignals({
      season,
      beat: evaluation.beat,
      measureIndex: evaluation.measureIndex ?? null,
      criteria: evaluation.criteria,
      trackingUnavailable: evaluation.trackingUnavailable,
      fallbackCode: evaluation.feedbackCode ?? fallbackCode,
      codeMetadata,
      criterionMetadata,
      landmarkConfidence: evaluation.metrics?.landmarkConfidence,
    });
  });
  const groups = new Map<string, SignalGroup<TCode>>();

  signals.forEach((signal) => {
    const metadata = getAct5SignalMetadata(
      codeMetadata,
      criterionMetadata,
      signal.criterionId,
      signal.code,
    );
    const key = [
      signal.code,
      signal.category,
      signal.criterionId,
      signal.bodyRegion,
    ].join(":");
    const group =
      groups.get(key) ??
      ({
        code: signal.code,
        category: signal.category,
        season,
        bodyRegion: signal.bodyRegion,
        criterionIds: new Set<string>(),
        measureIndexes: new Set<number>(),
        beatKeys: new Set<string>(),
        essential: false,
        optionalLowerBody: metadata.optionalLowerBody === true,
        confidenceTotal: 0,
        confidenceCount: 0,
        maxConfidence: 0,
        maxSeverity: 0,
        severeTracking: false,
        priority: metadata.priority,
      } satisfies SignalGroup<TCode>);

    if (signal.criterionId) group.criterionIds.add(signal.criterionId);
    if (typeof signal.measureIndex === "number") {
      group.measureIndexes.add(signal.measureIndex);
    }
    group.beatKeys.add(`${signal.measureIndex ?? "unknown"}-${signal.beat}`);
    group.essential ||= signal.essential;
    group.confidenceTotal += signal.confidence;
    group.confidenceCount += 1;
    group.maxConfidence = Math.max(group.maxConfidence, signal.confidence);
    group.maxSeverity = Math.max(group.maxSeverity, signal.severity);

    groups.set(key, group);
  });

  const totalBeatCount = Math.max(beatEvaluations.length, 1);
  const movementSignalCount =
    reliableMovementSignalCount ||
    signals.filter((signal) => signal.category !== "tracking").length;

  groups.forEach((group) => {
    group.severeTracking =
      group.category === "tracking" &&
      group.essential &&
      !group.optionalLowerBody &&
      (group.measureIndexes.size >= 2 ||
        group.beatKeys.size > totalBeatCount / 2 ||
        movementSignalCount === 0);
  });

  const selectedGroup = [...groups.values()].sort(compareGroups)[0];

  if (!selectedGroup) {
    return {
      code: fallbackCode,
      category: "generic",
      season,
      bodyRegion: null,
      narrationCue: null,
      evidence: {
        measureCount: 0,
        beatCount: 0,
        confidence: 0,
        severity: 0,
        criterionIds: [],
        severeTracking: false,
      },
    };
  }

  return {
    code: selectedGroup.code,
    category: selectedGroup.category,
    season,
    bodyRegion: selectedGroup.bodyRegion,
    narrationCue: null,
    evidence: {
      measureCount: selectedGroup.measureIndexes.size,
      beatCount: selectedGroup.beatKeys.size,
      confidence:
        selectedGroup.confidenceCount > 0
          ? selectedGroup.confidenceTotal / selectedGroup.confidenceCount
          : 0,
      severity: selectedGroup.maxSeverity,
      criterionIds: [...selectedGroup.criterionIds].sort(),
      severeTracking: selectedGroup.severeTracking,
    },
  };
};
