import { describe, expect, it } from "vitest";
import { FIRST_YEAR } from "../config/catalog";
import type { MonthlyGrid } from "../types";
import { analyzeTrend, annualSeries, yearsNeeded } from "./trend";

const ALL = Array.from({ length: 12 }, (_, i) => i);

/** Synthetic grid: seasonal cycle + linear trend (per year) for `years` years. */
function makeGrid(years: number, trendPerYear: number): MonthlyGrid {
  return Array.from({ length: years }, (_, y) => ALL.map((m) => 10 + 5 * Math.sin((m / 12) * 2 * Math.PI) + trendPerYear * y));
}

describe("annualSeries", () => {
  it("removes the seasonal cycle and keeps the long-term mean", () => {
    const s = annualSeries(makeGrid(20, 0), FIRST_YEAR, FIRST_YEAR + 19, ALL);
    expect(s.years).toHaveLength(20);
    for (const v of s.values) expect(v).toBeCloseTo(10, 6);
  });

  it("drops years with fewer than 75% of the months", () => {
    const grid = makeGrid(12, 0);
    grid[3] = ALL.map((m) => (m < 6 ? 10 : null));
    const s = annualSeries(grid, FIRST_YEAR, FIRST_YEAR + 11, ALL);
    expect(s.years).not.toContain(FIRST_YEAR + 3);
  });
});

describe("analyzeTrend", () => {
  it("requires at least 8 valid years", () => {
    expect(analyzeTrend(makeGrid(7, 0.1), FIRST_YEAR, FIRST_YEAR + 6, ALL).ok).toBe(false);
  });

  it("detects a clean upward trend as very strong", () => {
    const r = analyzeTrend(makeGrid(30, 0.03), FIRST_YEAR, FIRST_YEAR + 29, ALL);
    if (!r.ok) throw new Error("expected ok");
    expect(r.direction).toBe(1);
    expect(r.level).toBe(3);
    expect(r.mk.sen * 10).toBeCloseTo(0.3, 6);
  });

  it("reports a constant series as flat", () => {
    const r = analyzeTrend(makeGrid(15, 0), FIRST_YEAR, FIRST_YEAR + 14, ALL);
    if (!r.ok) throw new Error("expected ok");
    expect(r.direction).toBe(0);
    expect(r.level).toBe(0);
  });

  it("estimates extra years for a weak trend", () => {
    // Deterministic pseudo-random yearly noise (LCG) much larger than the trend.
    let seed = 42;
    const noise = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31 - 0.5) * 2;
    const grid = makeGrid(12, 0.01).map((row) => {
      const n = noise();
      return row!.map((v) => v! + n);
    });
    const r = analyzeTrend(grid, FIRST_YEAR, FIRST_YEAR + 11, ALL);
    if (!r.ok) throw new Error("expected ok");
    expect(r.level).toBeLessThan(2);
    expect(yearsNeeded(r)).toBeGreaterThan(0);
  });
});
