// Client for the NASA POWER monthly API (https://power.larc.nasa.gov).
import { FIRST_YEAR, LAST_YEAR } from "../config/catalog";
import type { MonthlyGrid, PointData } from "../types";

const API = "https://power.larc.nasa.gov/api/temporal/monthly/";
const TIMEOUT_MS = 90_000;
const FILL_VALUE_THRESHOLD = -990;

type ParameterSeries = Record<string, number>;

interface PointResponse {
  properties: { parameter: Record<string, ParameterSeries> };
}

interface RegionalResponse {
  features: Array<{
    geometry: { coordinates: [number, number] };
    properties: { parameter: Record<string, ParameterSeries> };
  }>;
}

export interface GridCell {
  lat: number;
  lon: number;
  grid: MonthlyGrid;
}

export interface BoundingBox {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

// In-flight and completed requests are memoised by URL; failures are evicted so they can be retried.
const cache = new Map<string, Promise<unknown>>();

function getJson<T>(url: string): Promise<T> {
  const cached = cache.get(url);
  if (cached) return cached as Promise<T>;

  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`The NASA server responded ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  })();
  cache.set(url, request);
  request.catch(() => cache.delete(url));
  return request;
}

/** {"198101": v, ...} → grid[yearIndex][month]. Key month "13" is the annual value and is skipped. */
function toGrid(series: ParameterSeries = {}): MonthlyGrid {
  const grid: MonthlyGrid = [];
  for (const key in series) {
    const yearIndex = +key.slice(0, 4) - FIRST_YEAR;
    const month = +key.slice(4) - 1;
    if (month > 11 || yearIndex < 0) continue;
    const row = (grid[yearIndex] ??= new Array<number | null>(12).fill(null));
    row[month] = series[key] <= FILL_VALUE_THRESHOLD ? null : series[key];
  }
  return grid;
}

const commonQuery = `community=AG&start=${FIRST_YEAR}&end=${LAST_YEAR}&format=JSON`;

export async function fetchPoint(lat: number, lon: number, parameters: string[]): Promise<PointData> {
  const url = `${API}point?parameters=${parameters.join(",")}&longitude=${lon}&latitude=${lat}&${commonQuery}`;
  const json = await getJson<PointResponse>(url);
  return Object.fromEntries(parameters.map((id) => [id, toGrid(json.properties.parameter[id])]));
}

export async function fetchRegion(box: BoundingBox, parameter: string): Promise<GridCell[]> {
  const url =
    `${API}regional?parameters=${parameter}` +
    `&latitude-min=${box.latMin}&latitude-max=${box.latMax}&longitude-min=${box.lonMin}&longitude-max=${box.lonMax}&${commonQuery}`;
  const json = await getJson<RegionalResponse>(url);
  return json.features.map((f) => ({
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    grid: toGrid(f.properties.parameter[parameter]),
  }));
}

/** Human-readable message for a failed request. */
export const describeError = (e: unknown): string =>
  e instanceof Error ? (e.name === "AbortError" ? "timed out" : e.message) : String(e);
