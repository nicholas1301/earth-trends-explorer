/** Monthly values indexed as grid[yearIndex][monthIndex]; null = missing. yearIndex 0 is FIRST_YEAR unless an origin is given. */
export type MonthlyGrid = Array<Array<number | null> | undefined>;

export type ThemeId = "heat" | "water" | "ice" | "sun" | "wind" | "air" | "life";

/** Which colour an *increase* of the variable gets: red = warming/drying, blue = more water/cold. */
export type IncreaseColor = "red" | "blue";

export interface Theme {
  id: ThemeId;
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
  /** Set for records that are not from NASA POWER: downloaded in advance, only for the featured places. */
  extra?: {
    /** NASA tool the record was downloaded from. */
    tool: "AppEEARS" | "Giovanni";
    product: string;
    /** First year of the record. */
    since: number;
    /** What area the value represents. */
    scope: string;
  };
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
  /** True once the user renamed the place; set only on saved places. */
  customName?: boolean;
}

export interface Season {
  id: string;
  name: string;
  months: number[];
}

export type ChartView = "annual" | "monthly" | "anomaly";
export type WhereTab = "region" | "world";
/** Screens of the investigation, in order (each one shows a single step of the journey), plus the side screen that
 * analyses a time series imported from another tool. */
export type Step = "home" | "place" | "clues" | "verdict" | "compare" | "import";

export interface Filters {
  y0: number;
  y1: number;
  season: string;
}

export type PointData = Record<string, MonthlyGrid>;
