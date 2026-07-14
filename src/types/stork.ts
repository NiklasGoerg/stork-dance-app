export type StorkDataPoint = {
  tag: string;
  date: string;
  timestamp: string;
  year: number;
  lat: number;
  lng: number;
};

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

export type StorkStoryCycleRoute = {
  id: string;
  step: number;
  targetYear: number;
  tag: string;
  label: string;
  wintering: string;
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
