import { HINTS, VARIABLES } from "../config/catalog";
import type { Filters, PointData, Variable } from "../types";
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

/** All variables from the most to the least significant trend (evidence level, then |Z|); those without enough data last. */
export function rankVariables(scan: Scan): Variable[] {
  const score = (v: Variable) => {
    const r = scan[v.id];
    return r.ok ? r.level * 1000 + Math.abs(r.mk.Z) : -1;
  };
  return [...VARIABLES].sort((a, b) => score(b) - score(a));
}
