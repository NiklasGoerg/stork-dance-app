import {
  climateDataSourceId,
  type ClimateSeason,
} from "~/utils/movement/acts/climate/climateSeasonData";
import type { SeasonalCycleSeasonId } from "~/utils/seasonalCycle";

export type ClimateMovementFamilyId = Extract<
  SeasonalCycleSeasonId,
  "summer" | "autumn" | "winter" | "spring"
>;

export type ClimateMovementFlowId =
  | "act5Full"
  | "act5TutorialDebug"
  | "springSingleDebug"
  | "springSequenceDebug"
  | "summerSingleDebug"
  | "summerSequenceDebug"
  | "autumnSingleDebug"
  | "autumnSequenceDebug"
  | "winterSingleDebug"
  | "winterSequenceDebug"
  | "act5Story";

export type ClimateMovementFlowKind =
  "full-act" | "tutorial" | "single-baseline" | "season-timeline" | "story";

export type ClimateMovementFlow = {
  id: ClimateMovementFlowId;
  familyId: ClimateMovementFamilyId;
  label: string;
  kind: ClimateMovementFlowKind;
  season: ClimateSeason;
  dataSource: typeof climateDataSourceId;
  measuresPerValue: number;
  requiredSuccessfulMeasures: number;
  feedbackInterludeDurationMs: number;
  recognitionEnabled: boolean;
};

const createFlow = ({
  id,
  familyId,
  label,
  kind,
  recognitionEnabled,
}: {
  id: ClimateMovementFlowId;
  familyId: ClimateMovementFamilyId;
  label: string;
  kind: ClimateMovementFlowKind;
  recognitionEnabled: boolean;
}): ClimateMovementFlow => ({
  id,
  familyId,
  label,
  kind,
  season: familyId,
  dataSource: climateDataSourceId,
  measuresPerValue: 4,
  requiredSuccessfulMeasures: 2,
  feedbackInterludeDurationMs: 4_000,
  recognitionEnabled,
});

export const climateMovementFlowRegistry = {
  act5Full: createFlow({
    id: "act5Full",
    familyId: "summer",
    label: "Act 5",
    kind: "full-act",
    recognitionEnabled: true,
  }),
  act5TutorialDebug: createFlow({
    id: "act5TutorialDebug",
    familyId: "summer",
    label: "Act 5 tutorial",
    kind: "tutorial",
    recognitionEnabled: true,
  }),
  springSingleDebug: createFlow({
    id: "springSingleDebug",
    familyId: "spring",
    label: "Spring",
    kind: "single-baseline",
    recognitionEnabled: true,
  }),
  springSequenceDebug: createFlow({
    id: "springSequenceDebug",
    familyId: "spring",
    label: "Spring Timeline",
    kind: "season-timeline",
    recognitionEnabled: true,
  }),
  summerSingleDebug: createFlow({
    id: "summerSingleDebug",
    familyId: "summer",
    label: "Summer",
    kind: "single-baseline",
    recognitionEnabled: true,
  }),
  summerSequenceDebug: createFlow({
    id: "summerSequenceDebug",
    familyId: "summer",
    label: "Summer Timeline",
    kind: "season-timeline",
    recognitionEnabled: true,
  }),
  autumnSingleDebug: createFlow({
    id: "autumnSingleDebug",
    familyId: "autumn",
    label: "Autumn",
    kind: "single-baseline",
    recognitionEnabled: true,
  }),
  autumnSequenceDebug: createFlow({
    id: "autumnSequenceDebug",
    familyId: "autumn",
    label: "Autumn Timeline",
    kind: "season-timeline",
    recognitionEnabled: true,
  }),
  winterSingleDebug: createFlow({
    id: "winterSingleDebug",
    familyId: "winter",
    label: "Winter",
    kind: "single-baseline",
    recognitionEnabled: true,
  }),
  winterSequenceDebug: createFlow({
    id: "winterSequenceDebug",
    familyId: "winter",
    label: "Winter Timeline",
    kind: "season-timeline",
    recognitionEnabled: true,
  }),
  act5Story: createFlow({
    id: "act5Story",
    familyId: "summer",
    label: "Act 5 story",
    kind: "story",
    recognitionEnabled: false,
  }),
} as const;
