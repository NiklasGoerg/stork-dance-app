export type StorkDataPoint = {
  tag: string;
  date: string;
  timestamp: string;
  year: number;
  lat: number;
  lng: number;
  story?: StorkStoryDay;
};

export type StorkMigrationPhase =
  "summer_rest" | "autumn_migration" | "winter_rest" | "spring_migration";

export type StorkMigrationEvent =
  "autumn_departure" | "autumn_arrival" | "spring_departure" | "spring_arrival";

export type StorkPositionSource =
  "observed" | "backfilled" | "forward_filled" | "interpolated";

export type StorkStoryDay = {
  cycleId: string;
  cycleIndex: number;
  cycleYear: number;
  relativeDay: number;
  phase: StorkMigrationPhase;
  isMigrationDay: boolean;
  isRestDay: boolean;
  event: StorkMigrationEvent | null;
  residenceRegion: string | null;
  destinationCountry: string | null;
  positionSource: StorkPositionSource;
  isPositionObserved: boolean;
  sourceDateBefore: string | null;
  sourceDateAfter: string | null;
  gapLengthDays: number;
};

export type StorkDataSource = "raw" | "story";

export type StorkYearRoute = {
  year: number;
  color: string;
  points: StorkDataPoint[];
};

export type StorkYearPoint = {
  year: number;
  color: string;
  point: StorkDataPoint;
};

export type StorkMapMode = "explore" | "all-years" | "story";

export type StorkStoryCycleEvents = {
  breedingDeparture: string;
  winterArrival: string;
  winterDeparture: string;
  nextBreedingArrival: string;
};

export type StorkStoryCycleDefinition = {
  step: number;
  targetYear: number;
  tag: string;
  label: string;
  wintering: string;
  events: StorkStoryCycleEvents;
};

export type StorkStoryCycleRoute = StorkStoryCycleDefinition & {
  id: string;
  color: string;
  startDate: string;
  endDate: string;
  points: StorkDataPoint[];
};

export type StorkStoryPoint = {
  cycle: StorkStoryCycleRoute;
  point: StorkDataPoint;
  timelineIndex: number;
};

export type StorkMarkerKind = "nesting" | "eating" | "flying";

export type StorkMarkerVisual = {
  kind: StorkMarkerKind;
  mirrored: boolean;
};
