export type ClimateSeason = "winter" | "spring" | "summer" | "autumn";
export type ClimateDataSeason = ClimateSeason | "annual_mean";
export type ClimateDisplayValueType =
  "absolute_temperature" | "difference_from_1995_1999";
export type ClimateDisplayUnit = "degC";
export type ClimateMovementResolutionReason =
  "baseline-reference" | "movement-percent";
export type ClimateSeasonLoaderState = "idle" | "loading" | "loaded" | "error";

export type ClimateSeasonDataRow = {
  intervalOrder: number;
  interval: string;
  intervalStart: number;
  intervalEnd: number;
  seasonOrder: number;
  season: ClimateDataSeason;
  absoluteValue: number;
  displayValue: number;
  displayValueType: ClimateDisplayValueType;
  displayUnit: ClimateDisplayUnit;
  normalizedValue: number;
  movementPercent: number | null;
  isBaseline: boolean;
};

export type ClimateMovementFlowStep = {
  id: string;
  movementDefinitionId: string;
  sourceRow: ClimateSeasonDataRow;
  season: ClimateSeason;
  intervalOrder: number;
  interval: string;
  intervalStart: number;
  intervalEnd: number;
  movementValue: number;
  resolutionReason: ClimateMovementResolutionReason;
  absoluteValue: number;
  displayValue: number;
  displayValueType: ClimateDisplayValueType;
  displayUnit: ClimateDisplayUnit;
  normalizedValue: number;
  rawMovementPercent: number | null;
  isBaseline: boolean;
};

export type ClimateSeasonDataset = {
  sourceId: "temperature-seasons";
  sourcePath: "src/assets/climate_data/temperature_seasons_data.csv";
  rows: ClimateSeasonDataRow[];
};

export type ClimateDataValidationError = {
  code: string;
  message: string;
  rowIndex?: number;
};

export type ClimateSeasonParseResult = {
  dataset: ClimateSeasonDataset | null;
  errors: ClimateDataValidationError[];
};
