import { climateDataSourceId } from "~/utils/movement/acts/climate/climateSeasonData";
import type { ClimateSeason } from "~/types/climate";
import type { SeasonalCycleSeasonId } from "~/utils/seasonalCycle";

export type ClimateMovementFamilyId = Extract<
  SeasonalCycleSeasonId,
  "summer" | "autumn" | "winter" | "spring"
>;

export type ClimateMovementFlowId =
  | "act4Full"
  | "act4TutorialDebug"
  | "springSingleDebug"
  | "springSequenceDebug"
  | "summerSingleDebug"
  | "summerSequenceDebug"
  | "autumnSingleDebug"
  | "autumnSequenceDebug"
  | "winterSingleDebug"
  | "winterSequenceDebug"
  | "act4Story";

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
  act4Full: createFlow({
    id: "act4Full",
    familyId: "summer",
    label: "Act 4",
    kind: "full-act",
    recognitionEnabled: true,
  }),
  act4TutorialDebug: createFlow({
    id: "act4TutorialDebug",
    familyId: "summer",
    label: "Act 4 tutorial",
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
  act4Story: createFlow({
    id: "act4Story",
    familyId: "summer",
    label: "Act 4 story",
    kind: "story",
    recognitionEnabled: false,
  }),
} as const;
