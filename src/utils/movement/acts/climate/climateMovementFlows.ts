import type { AutumnValueClass } from "~/utils/movement/acts/climate/autumn/autumnMovementRecognition";
import type { SpringValue } from "~/utils/movement/acts/climate/spring/springMovementRecognition";
import type { SummerIntensity } from "~/utils/movement/acts/climate/summer/summerMovementRecognition";
import type { WinterValue } from "~/utils/movement/acts/climate/winter/winterMovementRecognition";
import type { SeasonalCycleSeasonId } from "~/utils/seasonalCycle";

export type ClimateMovementFamilyId = Extract<
  SeasonalCycleSeasonId,
  "summer" | "autumn" | "winter" | "spring"
>;

export type ClimateMovementFlowId =
  | "springSingleDebug"
  | "springSequenceDebug"
  | "summerSingleDebug"
  | "summerSequenceDebug"
  | "autumnSingleDebug"
  | "autumnSequenceDebug"
  | "winterSingleDebug"
  | "winterSequenceDebug"
  | "act5Story";

export type ClimateMovementFlow<TValue extends string = string> = {
  id: ClimateMovementFlowId;
  familyId: ClimateMovementFamilyId;
  label: string;
  values: readonly TValue[];
  measuresPerValue: number;
  requiredSuccessfulMeasures: number;
  feedbackInterludeDurationMs: number;
  recognitionEnabled: boolean;
};

const createSingleDebugFlow = <TValue extends string>({
  id,
  familyId,
  label,
  value,
  recognitionEnabled,
}: {
  id: ClimateMovementFlowId;
  familyId: ClimateMovementFamilyId;
  label: string;
  value: TValue;
  recognitionEnabled: boolean;
}): ClimateMovementFlow<TValue> => ({
  id,
  familyId,
  label,
  values: [value],
  measuresPerValue: 4,
  requiredSuccessfulMeasures: 2,
  feedbackInterludeDurationMs: 4_000,
  recognitionEnabled,
});

export const climateMovementFlowRegistry = {
  springSingleDebug: createSingleDebugFlow({
    id: "springSingleDebug",
    familyId: "spring",
    label: "Spring",
    value: "100",
    recognitionEnabled: true,
  }),
  springSequenceDebug: {
    id: "springSequenceDebug",
    familyId: "spring",
    label: "Spring Sequence",
    values: ["100", "40", "30", "20"],
    measuresPerValue: 4,
    requiredSuccessfulMeasures: 2,
    feedbackInterludeDurationMs: 4_000,
    recognitionEnabled: true,
  } satisfies ClimateMovementFlow<SpringValue>,
  summerSingleDebug: createSingleDebugFlow<SummerIntensity>({
    id: "summerSingleDebug",
    familyId: "summer",
    label: "Summer",
    value: "100",
    recognitionEnabled: true,
  }),
  summerSequenceDebug: {
    id: "summerSequenceDebug",
    familyId: "summer",
    label: "Summer Sequence",
    values: ["100", "60", "30", "10"],
    measuresPerValue: 4,
    requiredSuccessfulMeasures: 2,
    feedbackInterludeDurationMs: 4_000,
    recognitionEnabled: true,
  } satisfies ClimateMovementFlow<SummerIntensity>,
  autumnSingleDebug: createSingleDebugFlow<AutumnValueClass>({
    id: "autumnSingleDebug",
    familyId: "autumn",
    label: "Autumn",
    value: "100",
    recognitionEnabled: true,
  }),
  autumnSequenceDebug: {
    id: "autumnSequenceDebug",
    familyId: "autumn",
    label: "Autumn Sequence",
    values: ["100", "80", "50", "40", "25"],
    measuresPerValue: 4,
    requiredSuccessfulMeasures: 2,
    feedbackInterludeDurationMs: 4_000,
    recognitionEnabled: true,
  } satisfies ClimateMovementFlow<AutumnValueClass>,
  winterSingleDebug: createSingleDebugFlow<WinterValue>({
    id: "winterSingleDebug",
    familyId: "winter",
    label: "Winter",
    value: "100",
    recognitionEnabled: true,
  }),
  winterSequenceDebug: {
    id: "winterSequenceDebug",
    familyId: "winter",
    label: "Winter Sequence",
    values: ["100", "50", "20", "-10"],
    measuresPerValue: 4,
    requiredSuccessfulMeasures: 2,
    feedbackInterludeDurationMs: 4_000,
    recognitionEnabled: true,
  } satisfies ClimateMovementFlow<WinterValue>,
  act5Story: {
    id: "act5Story",
    familyId: "summer",
    label: "Act 5 story",
    values: [],
    measuresPerValue: 4,
    requiredSuccessfulMeasures: 2,
    feedbackInterludeDurationMs: 4_000,
    recognitionEnabled: false,
  } satisfies ClimateMovementFlow,
} as const;

export const climateSequenceFlows = [
  climateMovementFlowRegistry.springSequenceDebug,
  climateMovementFlowRegistry.summerSequenceDebug,
  climateMovementFlowRegistry.autumnSequenceDebug,
  climateMovementFlowRegistry.winterSequenceDebug,
] as const;
