import { FIRST_YEAR } from "../config/catalog";
import type { MonthlyGrid } from "../types";
import { mannKendall, mean, ols, tCritical95, type MannKendallResult, type OlsResult } from "./stats";

export const LEVEL_LABELS = ["not significant", "suggestive", "significant", "very strong"] as const;
/** Evidence level: 0 none (p ≥ 0.1), 1 suggestive, 2 significant (p < 0.05), 3 very strong (p < 0.01). */
export type EvidenceLevel = 0 | 1 | 2 | 3;
export const SIGNIFICANT: EvidenceLevel = 2;
const MIN_YEARS = 8;

export interface AnnualSeries {
  years: number[];
  values: number[];
  /** Mean of each selected month over the period (the seasonal climatology). */
  climatology: Record<number, number>;
  /** Mean of the climatology — the level the anomalies are added back to. */
  base: number;
}

export interface TrendOk extends AnnualSeries {
  ok: true;
  ols: OlsResult;
  mk: MannKendallResult;
  /** −1 falling, 0 flat, +1 rising (by Sen's slope). */
  direction: -1 | 0 | 1;
  level: EvidenceLevel;
  span: number;
}

export interface TrendInsufficient extends AnnualSeries {
  ok: false;
}

export type TrendResult = TrendOk | TrendInsufficient;

const cell = (grid: MonthlyGrid, yearIndex: number, month: number) => grid[yearIndex]?.[month] ?? null;

/**
 * Annual series built from monthly anomalies (monthly value minus that month's mean, averaged per year), which
 * makes it robust to missing months. Years with fewer than 75% of the selected months are discarded.
 * `origin` is the calendar year of grid row 0 (FIRST_YEAR for NASA POWER data; imported series may start earlier).
 */
export function annualSeries(grid: MonthlyGrid, y0: number, y1: number, months: number[], origin = FIRST_YEAR): AnnualSeries {
  const i0 = Math.max(0, y0 - origin);
  const i1 = y1 - origin;
  const climatology: Record<number, number> = {};
  for (const m of months) {
    let sum = 0;
    let count = 0;
    for (let i = i0; i <= i1; i++) {
      const v = cell(grid, i, m);
      if (v != null) { sum += v; count++; }
    }
    if (count >= 3) climatology[m] = sum / count;
  }

  const usable = Object.keys(climatology).map(Number);
  if (!usable.length) return { years: [], values: [], climatology, base: 0 };

  const base = mean(usable.map((m) => climatology[m]));
  const years: number[] = [];
  const values: number[] = [];
  for (let i = i0; i <= i1; i++) {
    let sum = 0;
    let count = 0;
    for (const m of usable) {
      const v = cell(grid, i, m);
      if (v != null) { sum += v - climatology[m]; count++; }
    }
    if (count && count >= 0.75 * usable.length) {
      years.push(origin + i);
      values.push(base + sum / count);
    }
  }
  return { years, values, climatology, base };
}

export function analyzeTrend(grid: MonthlyGrid, y0: number, y1: number, months: number[], origin = FIRST_YEAR): TrendResult {
  const series = annualSeries(grid, y0, y1, months, origin);
  if (series.years.length < MIN_YEARS) return { ok: false, ...series };

  const { years, values } = series;
  const o = ols(years, values);
  const mk = mannKendall(years, values);
  const span = years[years.length - 1] - years[0];
  const range = Math.max(...values) - Math.min(...values);
  const flat = range === 0 || Math.abs(mk.sen) * span < 1e-9;
  const direction = flat ? 0 : (Math.sign(mk.sen) as -1 | 1);
  const level: EvidenceLevel = flat ? 0 : mk.p < 0.01 ? 3 : mk.p < 0.05 ? 2 : mk.p < 0.1 ? 1 : 0;
  return { ok: true, ...series, ols: o, mk, direction, level, span };
}

/** Extra years needed for the same rate (and variability) to become significant by the t-test. */
export function yearsNeeded(r: TrendOk): number | null {
  const b = Math.abs(r.ols.slope);
  const s = r.ols.residualSd;
  if (!(b > 0) || !(s > 0)) return null;
  for (let n = r.ols.n + 1; n <= r.ols.n + 300; n++) {
    const se = s * Math.sqrt(12 / (n * (n * n - 1)));
    if (b / se > tCritical95(n - 2)) return n - r.ols.n;
  }
  return null;
}

export const isSignificant = (r: TrendResult): r is TrendOk => r.ok && r.level >= SIGNIFICANT;
/** Sen's slope expressed per decade. */
export const perDecade = (r: TrendOk): number => r.mk.sen * 10;
