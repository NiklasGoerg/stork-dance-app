import { parseCsvRows } from "~/utils/csv";
import type {
  ClimateDataSeason,
  ClimateDataValidationError,
  ClimateDisplayUnit,
  ClimateDisplayValueType,
  ClimateMovementFlowStep,
  ClimateSeason,
  ClimateSeasonDataRow,
  ClimateSeasonDataset,
  ClimateSeasonParseResult,
} from "~/types/climate";

export const climateDataSourceId = "temperature-seasons" as const;
export const climateDataSourcePath =
  "src/assets/climate_data/temperature_seasons_data.csv";

const requiredColumns = [
  "interval_order",
  "interval",
  "interval_start",
  "interval_end",
  "season_order",
  "season",
  "absolute_value",
  "display_value",
  "display_value_type",
  "display_unit",
  "normalized_value",
  "movement_percent",
  "is_baseline",
] as const;

const climateMovementSeasons = [
  "winter",
  "spring",
  "summer",
  "autumn",
] as const satisfies readonly ClimateSeason[];

const supportedMovementValues: Record<ClimateSeason, readonly number[]> = {
  winter: [100, 50, 20, -10],
  spring: [100, 40, 30, 20],
  summer: [100, 60, 30, 10],
  autumn: [100, 80, 50, 40, 25],
};

const isClimateDataSeason = (season: string): season is ClimateDataSeason =>
  [...climateMovementSeasons, "annual_mean"].includes(
    season as ClimateDataSeason,
  );

export const isClimateMovementSeason = (
  season: string,
): season is ClimateSeason =>
  climateMovementSeasons.includes(season as ClimateSeason);

const parseNumberField = ({
  value,
  field,
  rowIndex,
  errors,
}: {
  value: string | undefined;
  field: string;
  rowIndex: number;
  errors: ClimateDataValidationError[];
}) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    errors.push({
      code: "invalid-number",
      message: `Invalid numeric value for ${field} in row ${rowIndex}.`,
      rowIndex,
    });
    return Number.NaN;
  }

  return numericValue;
};

const parseOptionalNumberField = ({
  value,
  field,
  rowIndex,
  errors,
}: {
  value: string | undefined;
  field: string;
  rowIndex: number;
  errors: ClimateDataValidationError[];
}) => {
  if (value === undefined || value === "") return null;

  return parseNumberField({ value, field, rowIndex, errors });
};

const parseBooleanField = ({
  value,
  field,
  rowIndex,
  errors,
}: {
  value: string | undefined;
  field: string;
  rowIndex: number;
  errors: ClimateDataValidationError[];
}) => {
  if (value === "true") return true;
  if (value === "false") return false;

  errors.push({
    code: "invalid-boolean",
    message: `Invalid boolean value for ${field} in row ${rowIndex}.`,
    rowIndex,
  });
  return false;
};

const getHeaderIndexMap = (
  header: string[],
  errors: ClimateDataValidationError[],
) => {
  const headerIndexMap = new Map<string, number>();

  header.forEach((column, index) => {
    headerIndexMap.set(column, index);
  });

  requiredColumns.forEach((column) => {
    if (!headerIndexMap.has(column)) {
      errors.push({
        code: "missing-column",
        message: `Missing required climate CSV column: ${column}.`,
      });
    }
  });

  return headerIndexMap;
};

const getColumnValue = (
  row: string[],
  headerIndexMap: Map<string, number>,
  column: (typeof requiredColumns)[number],
) => {
  const index = headerIndexMap.get(column);

  return index === undefined ? undefined : row[index];
};

const buildRow = ({
  row,
  rowIndex,
  headerIndexMap,
  errors,
}: {
  row: string[];
  rowIndex: number;
  headerIndexMap: Map<string, number>;
  errors: ClimateDataValidationError[];
}): ClimateSeasonDataRow | null => {
  const season = getColumnValue(row, headerIndexMap, "season") ?? "";
  const displayValueType =
    getColumnValue(row, headerIndexMap, "display_value_type") ?? "";
  const displayUnit = getColumnValue(row, headerIndexMap, "display_unit") ?? "";

  if (!isClimateDataSeason(season)) {
    errors.push({
      code: "unknown-season",
      message: `Unknown climate season "${season}" in row ${rowIndex}.`,
      rowIndex,
    });
    return null;
  }

  if (
    displayValueType !== "absolute_temperature" &&
    displayValueType !== "difference_from_1995_1999"
  ) {
    errors.push({
      code: "unknown-display-value-type",
      message: `Unknown display_value_type "${displayValueType}" in row ${rowIndex}.`,
      rowIndex,
    });
    return null;
  }

  if (displayUnit !== "degC") {
    errors.push({
      code: "unknown-display-unit",
      message: `Unknown display_unit "${displayUnit}" in row ${rowIndex}.`,
      rowIndex,
    });
    return null;
  }

  return {
    intervalOrder: parseNumberField({
      value: getColumnValue(row, headerIndexMap, "interval_order"),
      field: "interval_order",
      rowIndex,
      errors,
    }),
    interval: getColumnValue(row, headerIndexMap, "interval") ?? "",
    intervalStart: parseNumberField({
      value: getColumnValue(row, headerIndexMap, "interval_start"),
      field: "interval_start",
      rowIndex,
      errors,
    }),
    intervalEnd: parseNumberField({
      value: getColumnValue(row, headerIndexMap, "interval_end"),
      field: "interval_end",
      rowIndex,
      errors,
    }),
    seasonOrder: parseNumberField({
      value: getColumnValue(row, headerIndexMap, "season_order"),
      field: "season_order",
      rowIndex,
      errors,
    }),
    season,
    absoluteValue: parseNumberField({
      value: getColumnValue(row, headerIndexMap, "absolute_value"),
      field: "absolute_value",
      rowIndex,
      errors,
    }),
    displayValue: parseNumberField({
      value: getColumnValue(row, headerIndexMap, "display_value"),
      field: "display_value",
      rowIndex,
      errors,
    }),
    displayValueType,
    displayUnit,
    normalizedValue: parseNumberField({
      value: getColumnValue(row, headerIndexMap, "normalized_value"),
      field: "normalized_value",
      rowIndex,
      errors,
    }),
    movementPercent: parseOptionalNumberField({
      value: getColumnValue(row, headerIndexMap, "movement_percent"),
      field: "movement_percent",
      rowIndex,
      errors,
    }),
    isBaseline: parseBooleanField({
      value: getColumnValue(row, headerIndexMap, "is_baseline"),
      field: "is_baseline",
      rowIndex,
      errors,
    }),
  };
};

const validateRows = (
  rows: ClimateSeasonDataRow[],
  errors: ClimateDataValidationError[],
) => {
  climateMovementSeasons.forEach((season) => {
    const seasonRows = rows.filter((row) => row.season === season);
    const baselineRows = seasonRows.filter((row) => row.isBaseline);

    if (baselineRows.length !== 1) {
      errors.push({
        code: "invalid-baseline-count",
        message: `Expected exactly one baseline row for ${season}, found ${baselineRows.length}.`,
      });
    }

    seasonRows.forEach((row) => {
      const resolvedMovementValue = row.isBaseline ? 100 : row.movementPercent;

      if (!row.isBaseline && row.movementPercent === null) {
        errors.push({
          code: "missing-movement-percent",
          message: `Missing movement_percent for ${season} interval ${row.interval}.`,
        });
        return;
      }

      if (
        resolvedMovementValue === null ||
        !supportedMovementValues[season].includes(resolvedMovementValue)
      ) {
        errors.push({
          code: "unsupported-movement-value",
          message: `Unsupported movement value ${String(resolvedMovementValue)} for ${season} interval ${row.interval}.`,
        });
      }
    });
  });
};

export const parseClimateSeasonDataCsv = (
  csv: string,
): ClimateSeasonParseResult => {
  const errors: ClimateDataValidationError[] = [];
  const { header, rows: rawRows } = parseCsvRows(csv);
  const headerIndexMap = getHeaderIndexMap(header, errors);

  if (errors.length) return { dataset: null, errors };

  const rows = rawRows
    .map((row, index) =>
      buildRow({
        row,
        rowIndex: index + 2,
        headerIndexMap,
        errors,
      }),
    )
    .filter((row): row is ClimateSeasonDataRow => Boolean(row));

  validateRows(rows, errors);

  if (errors.length) return { dataset: null, errors };

  return {
    dataset: {
      sourceId: climateDataSourceId,
      sourcePath: climateDataSourcePath,
      rows,
    },
    errors,
  };
};

export const resolveClimateMovementStep = (
  row: ClimateSeasonDataRow,
): ClimateMovementFlowStep | null => {
  if (!isClimateMovementSeason(row.season)) return null;

  const movementValue = row.isBaseline ? 100 : row.movementPercent;

  if (movementValue === null) return null;

  return {
    id: `${row.season}-${row.intervalOrder}-${row.interval}`,
    movementDefinitionId: `act5-${row.season}-${movementValue}`,
    sourceRow: row,
    season: row.season,
    intervalOrder: row.intervalOrder,
    interval: row.interval,
    intervalStart: row.intervalStart,
    intervalEnd: row.intervalEnd,
    movementValue,
    resolutionReason: row.isBaseline
      ? "baseline-reference"
      : "movement-percent",
    absoluteValue: row.absoluteValue,
    displayValue: row.displayValue,
    displayValueType: row.displayValueType,
    displayUnit: row.displayUnit,
    normalizedValue: row.normalizedValue,
    rawMovementPercent: row.movementPercent,
    isBaseline: row.isBaseline,
  };
};

export const buildSeasonTimeline = (
  dataset: ClimateSeasonDataset,
  season: ClimateSeason,
) =>
  dataset.rows
    .filter((row) => row.season === season)
    .sort((a, b) => a.intervalOrder - b.intervalOrder)
    .map(resolveClimateMovementStep)
    .filter((step): step is ClimateMovementFlowStep => Boolean(step));

export const getBaselineStep = (
  dataset: ClimateSeasonDataset,
  season: ClimateSeason,
) =>
  buildSeasonTimeline(dataset, season).find((step) => step.isBaseline) ?? null;

export const formatClimateTemperature = ({
  value,
  type,
  unit,
}: {
  value: number;
  type: ClimateDisplayValueType;
  unit: ClimateDisplayUnit;
}) => {
  const unitLabel = unit === "degC" ? "°C" : unit;

  if (type === "absolute_temperature") {
    return `${value.toFixed(2)} ${unitLabel}`;
  }

  if (value > 0) return `+${value.toFixed(2)} ${unitLabel}`;
  if (value < 0) return `−${Math.abs(value).toFixed(2)} ${unitLabel}`;

  return `0.00 ${unitLabel}`;
};
