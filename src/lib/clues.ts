import { HINTS, VARIABLES } from "../config/catalog";
import type { Filters, PointData, ThemeId, Variable } from "../types";
import { seasonById } from "../config/catalog";
import { analyzeTrend, type TrendResult } from "./trend";

export type Scan = Record<string, TrendResult>;

/** Runs the trend analysis for every variable. */
export function scanVariables(data: PointData, filters: Filters): Scan {
  const months = seasonById(filters.season).months;
  return Object.fromEntries(VARIABLES.map((v) => [v.id, analyzeTrend(data[v.id] ?? [], filters.y0, filters.y1, months)]));
}

/** Variables that usually make good clues for this place (by climate profile and preset tag). */
export function typicalClues(profileKind: string, tag: string | null): Set<string> {
  return new Set([...(HINTS[profileKind] ?? []), ...(tag ? HINTS[tag] ?? [] : [])]);
}

/** Theme variables first, then typical clues, each ordered by strength of evidence (|Z|). */
export function rankVariables(scan: Scan, theme: ThemeId, hints: Set<string>): Variable[] {
  const score = (v: Variable) => {
    const r = scan[v.id];
    return (v.themes.includes(theme) ? 1000 : 0) + (hints.has(v.id) ? 100 : 0) + (r.ok ? Math.abs(r.mk.Z) : -50);
  };
  return [...VARIABLES].sort((a, b) => score(b) - score(a));
}
