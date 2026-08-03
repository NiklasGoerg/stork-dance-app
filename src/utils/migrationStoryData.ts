import migrationStoryCsv from "~/assets/storkdata/migration_story_cycles.csv?raw";
import type {
  StorkDataPoint,
  StorkMigrationEvent,
  StorkMigrationPhase,
  StorkPositionSource,
  StorkStoryCycleDefinition,
} from "~/types/stork";
import { parseCsvLine } from "~/utils/csv";

const phases = new Set<StorkMigrationPhase>([
  "summer_rest",
  "autumn_migration",
  "winter_rest",
  "spring_migration",
]);
const events = new Set<StorkMigrationEvent>([
  "autumn_departure",
  "autumn_arrival",
  "spring_departure",
  "spring_arrival",
]);
const positionSources = new Set<StorkPositionSource>([
  "observed",
  "backfilled",
  "forward_filled",
  "interpolated",
]);

const getColumnIndex = (header: string[], name: string) => {
  const index = header.indexOf(name);

  if (index === -1) {
    throw new Error(`Migration story CSV is missing column ${name}.`);
  }

  return index;
};

const parseBoolean = (value: string | undefined, column: string) => {
  if (value === "true") return true;
  if (value === "false") return false;

  throw new Error(`Migration story CSV has invalid ${column}: ${value}.`);
};

export const parseMigrationStoryCsv = (csv: string): StorkDataPoint[] => {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0] ?? "");
  const indexes = {
    cycleId: getColumnIndex(header, "story-cycle-id"),
    cycleIndex: getColumnIndex(header, "cycle-index"),
    cycleYear: getColumnIndex(header, "cycle-year"),
    tag: getColumnIndex(header, "tag-local-identifier"),
    date: getColumnIndex(header, "date"),
    relativeDay: getColumnIndex(header, "relative-day"),
    timestamp: getColumnIndex(header, "timestamp"),
    lat: getColumnIndex(header, "location-lat"),
    lng: getColumnIndex(header, "location-long"),
    phase: getColumnIndex(header, "phase"),
    isMigrationDay: getColumnIndex(header, "isMigrationDay"),
    isRestDay: getColumnIndex(header, "isRestDay"),
    event: getColumnIndex(header, "event"),
    residenceRegion: getColumnIndex(header, "residence-region"),
    destinationCountry: getColumnIndex(header, "destination-country"),
    positionSource: getColumnIndex(header, "position-source"),
    isPositionObserved: getColumnIndex(header, "is-position-observed"),
    sourceDateBefore: getColumnIndex(header, "source-date-before"),
    sourceDateAfter: getColumnIndex(header, "source-date-after"),
    gapLengthDays: getColumnIndex(header, "gap-length-days"),
  };

  return lines.slice(1).map((line, lineIndex) => {
    const row = parseCsvLine(line);
    const phase = row[indexes.phase] as StorkMigrationPhase | undefined;
    const eventValue = row[indexes.event] ?? "";
    const event = eventValue ? (eventValue as StorkMigrationEvent) : null;
    const cycleIndex = Number(row[indexes.cycleIndex]);
    const cycleYear = Number(row[indexes.cycleYear]);
    const relativeDay = Number(row[indexes.relativeDay]);
    const gapLengthDays = Number(row[indexes.gapLengthDays]);
    const lat = Number(row[indexes.lat]);
    const lng = Number(row[indexes.lng]);
    const positionSource = row[indexes.positionSource] as
      StorkPositionSource | undefined;

    if (!phase || !phases.has(phase)) {
      throw new Error(
        `Migration story CSV has invalid phase on line ${lineIndex + 2}.`,
      );
    }
    if (event && !events.has(event)) {
      throw new Error(
        `Migration story CSV has invalid event on line ${lineIndex + 2}.`,
      );
    }
    if (
      !Number.isInteger(cycleIndex) ||
      !Number.isInteger(cycleYear) ||
      !Number.isInteger(relativeDay) ||
      !Number.isInteger(gapLengthDays) ||
      gapLengthDays < 0 ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      throw new Error(
        `Migration story CSV has invalid numeric data on line ${lineIndex + 2}.`,
      );
    }
    if (!positionSource || !positionSources.has(positionSource)) {
      throw new Error(
        `Migration story CSV has invalid position-source on line ${lineIndex + 2}.`,
      );
    }

    const tag = row[indexes.tag] ?? "";
    const date = row[indexes.date] ?? "";
    const timestamp = row[indexes.timestamp] ?? "";
    const cycleId = row[indexes.cycleId] ?? "";

    if (!tag || !date || !timestamp || !cycleId) {
      throw new Error(
        `Migration story CSV has incomplete data on line ${lineIndex + 2}.`,
      );
    }

    return {
      tag,
      date,
      timestamp,
      year: Number(date.slice(0, 4)),
      lat,
      lng,
      story: {
        cycleId,
        cycleIndex,
        cycleYear,
        relativeDay,
        phase,
        isMigrationDay: parseBoolean(
          row[indexes.isMigrationDay],
          "isMigrationDay",
        ),
        isRestDay: parseBoolean(row[indexes.isRestDay], "isRestDay"),
        event,
        residenceRegion: row[indexes.residenceRegion] || null,
        destinationCountry: row[indexes.destinationCountry] || null,
        positionSource,
        isPositionObserved: parseBoolean(
          row[indexes.isPositionObserved],
          "is-position-observed",
        ),
        sourceDateBefore: row[indexes.sourceDateBefore] || null,
        sourceDateAfter: row[indexes.sourceDateAfter] || null,
        gapLengthDays,
      },
    };
  });
};

export const migrationStoryPoints = parseMigrationStoryCsv(migrationStoryCsv);

const pointsByCycle = new Map<string, StorkDataPoint[]>();

for (const point of migrationStoryPoints) {
  const cycleId = point.story?.cycleId;

  if (!cycleId) continue;

  const cyclePoints = pointsByCycle.get(cycleId) ?? [];
  cyclePoints.push(point);
  pointsByCycle.set(cycleId, cyclePoints);
}

const requireEventDate = (
  cycleId: string,
  points: StorkDataPoint[],
  event: StorkMigrationEvent,
) => {
  const matchingPoints = points.filter((point) => point.story?.event === event);

  if (matchingPoints.length !== 1 || !matchingPoints[0]) {
    throw new Error(
      `Migration story cycle ${cycleId} must contain exactly one ${event}.`,
    );
  }

  return matchingPoints[0].date;
};

export const migrationStoryCycleDefinitions: StorkStoryCycleDefinition[] = [
  ...pointsByCycle.entries(),
]
  .map(([cycleId, points]) => {
    const firstPoint = points[0];
    const story = firstPoint?.story;

    if (!firstPoint || !story) {
      throw new Error(`Migration story cycle ${cycleId} contains no data.`);
    }

    const winterPoint = points.find(
      (point) => point.story?.phase === "winter_rest",
    );

    return {
      step: story.cycleIndex,
      targetYear: story.cycleYear,
      tag: firstPoint.tag,
      label: cycleId,
      wintering:
        winterPoint?.story?.residenceRegion ??
        winterPoint?.story?.destinationCountry ??
        "Unknown",
      events: {
        breedingDeparture: requireEventDate(
          cycleId,
          points,
          "autumn_departure",
        ),
        winterArrival: requireEventDate(cycleId, points, "autumn_arrival"),
        winterDeparture: requireEventDate(cycleId, points, "spring_departure"),
        nextBreedingArrival: requireEventDate(
          cycleId,
          points,
          "spring_arrival",
        ),
      },
    };
  })
  .sort((first, second) => first.step - second.step);

if (migrationStoryCycleDefinitions.length !== 5) {
  throw new Error(
    `Expected five migration story cycles, received ${migrationStoryCycleDefinitions.length}.`,
  );
}

export const getMigrationStoryCyclePoints = (cycleId: string) =>
  pointsByCycle.get(cycleId) ?? [];
