import { useSyncExternalStore } from "react";
import type { Filters } from "../types";

/**
 * What the Compare step found, published by its two views so the challenge card can see it. Each summary carries
 * the investigation, variable and filters it was computed for, so stale results are easy to ignore.
 */
interface CompareKey {
  investigationId: number;
  variable: string;
  filters: Filters;
}

/** “Around here”: the trend of every grid cell in the box around the point. */
export interface RegionSummary extends CompareKey {
  /** Cells with enough data. */
  n: number;
  up: number;
  down: number;
  sigUp: number;
  sigDown: number;
  /** Change per decade of the area-weighted mean series; null when too short. */
  areaMean: number | null;
}

/** “Across the world”: the trend at each saved place, fastest rise first. */
export interface WorldSummary extends CompareKey {
  places: Array<{ name: string; perDecade: number; significant: boolean; isCurrent: boolean }>;
}

export interface CompareResults {
  region: RegionSummary | null;
  world: WorldSummary | null;
}

let current: CompareResults = { region: null, world: null };
const listeners = new Set<() => void>();

export function publishCompare<K extends keyof CompareResults>(kind: K, summary: CompareResults[K]): void {
  if (current[kind] === summary) return;
  current = { ...current, [kind]: summary };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useCompareResults = (): CompareResults => useSyncExternalStore(subscribe, () => current);

/** True when a summary was computed for exactly this investigation, variable and filters. */
export const isCurrentSummary = (s: CompareKey | null, investigationId: number, variable: string | null, f: Filters): boolean =>
  !!s && s.investigationId === investigationId && s.variable === variable && s.filters.y0 === f.y0 && s.filters.y1 === f.y1 && s.filters.season === f.season;
