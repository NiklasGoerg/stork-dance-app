import type { MigrationActCycleRun } from "~/types/migrationAct";

const yearSeparator = "\u2013";
const transitionSeparator = "\u2192";

export const formatYearPeriod = (startYear: number, endYear: number) =>
  `${startYear}${yearSeparator}${endYear}`;

export const formatDelimitedPeriod = (period: string | null | undefined) =>
  period?.replace("-", yearSeparator).trim() ?? "";

export const formatPeriodTransition = ({
  previousPeriod,
  nextPeriod,
}: {
  previousPeriod: string;
  nextPeriod: string;
}) => {
  const previous = formatDelimitedPeriod(previousPeriod);
  const next = formatDelimitedPeriod(nextPeriod);

  if (previous && next) return `${previous} ${transitionSeparator} ${next}`;
  return next || previous;
};

export const formatMigrationCyclePeriod = (
  cycleRun: MigrationActCycleRun | null,
) =>
  cycleRun
    ? formatYearPeriod(cycleRun.cycleStartYear, cycleRun.cycleStartYear + 1)
    : "";
