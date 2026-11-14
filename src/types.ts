/** Monthly values indexed as grid[yearIndex][monthIndex]; null = missing. yearIndex 0 is FIRST_YEAR. */
export type MonthlyGrid = Array<Array<number | null> | undefined>;

export type ThemeId = "heat" | "water" | "ice" | "sun" | "wind" | "air";

/** Which colour an *increase* of the variable gets: red = warming/drying, blue = more water/cold. */
export type IncreaseColor = "red" | "blue";

export interface Theme {
  id: ThemeId;
  icon: string;
  name: string;
  description: string;
}

export interface Variable {
  id: string;
  name: string;
  unit: string;
  themes: ThemeId[];
  increase: IncreaseColor;
  /** Decimal places used when formatting values. */
  digits: number;
  source: string;
  definition: string;
}

export interface Preset {
  name: string;
  region: string;
  lat: number;
  lon: number;
  tag: string;
}

export interface Place {
  lat: number;
  lon: number;
  name: string;
  region: string;
  /** Place type from a preset (e.g. "megacity"); null for arbitrary points. */
  tag: string | null;
}

export interface Season {
  id: string;
  name: string;
  months: number[];
}

export type ChartView = "annual" | "monthly" | "anomaly";
export type WhereTab = "region" | "world";

export interface Filters {
  y0: number;
  y1: number;
  season: string;
}

export type PointData = Record<string, MonthlyGrid>;
