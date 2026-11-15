// Loads the extra records stored in the repository for the featured places (written by scripts/fetch-extras.mjs).
// Each place has its own file, fetched only when that place is investigated.
import { FIRST_YEAR, PRESETS, presetAt } from "../config/catalog";
import { EXTRA_VARIABLES } from "../config/extraVariables";
import storedIndex from "../data/extras-index.json";
import type { MonthlyGrid, PointData, Preset, Variable } from "../types";

export interface StoredSeries {
  /** Calendar year of values[0]. */
  origin: number;
  values: Array<Array<number | null>>;
  /** Exact dataset and tool it came from. */
  source: string | null;
}

export interface ExtrasFile {
  place: string;
  lat: number;
  lon: number;
  /** Date of the download (YYYY-MM-DD). */
  generated: string;
  series: Record<string, StoredSeries>;
  /** Variables left out at this place, with the reason (e.g. "ocean variable"). */
  missing: Record<string, string>;
}

export interface Extras {
  data: PointData;
  sources: Record<string, string>;
  generated: string;
}

const FILES = import.meta.glob<ExtrasFile>("../data/extras/*.json", { import: "default" });
const fileKey = (lat: number, lon: number) => `../data/extras/${lat}_${lon}.json`;
/** Variables stored for each place (written with the files by scripts/fetch-extras.mjs). */
const INDEX: Record<string, string[]> = storedIndex.places;

/** IDs of the extra records stored for a place (empty for any point that is not a featured place). */
export function storedIds(lat: number, lon: number): string[] {
  return presetAt(lat, lon) && fileKey(lat, lon) in FILES ? INDEX[`${lat}_${lon}`] ?? [] : [];
}

/** True when the place is a featured place with at least one extra record in the repository. */
export const hasExtras = (lat: number, lon: number): boolean => storedIds(lat, lon).length > 0;

/** Extra variables stored for at least one featured place — what the app can actually show. */
export const STORED_EXTRA_VARIABLES: Variable[] = EXTRA_VARIABLES.filter((v) =>
  PRESETS.some((p) => storedIds(p.lat, p.lon).includes(v.id)),
);

/** Short names of the instruments/models behind the stored records (e.g. "OMI", "MERRA-2"). */
export const STORED_EXTRA_SOURCES: string[] = [...new Set(STORED_EXTRA_VARIABLES.map((v) => v.source.split(" ")[0]))];

/** Featured places that have extra records. */
export const placesWithExtras = (): Preset[] => PRESETS.filter((p) => hasExtras(p.lat, p.lon));

/** Stored series → grid indexed from FIRST_YEAR, like the NASA POWER data. */
export function toGrid(s: StoredSeries): MonthlyGrid {
  const grid: MonthlyGrid = [];
  s.values.forEach((row, i) => {
    const index = s.origin + i - FIRST_YEAR;
    if (index >= 0) grid[index] = row;
  });
  return grid;
}

export function fromFile(file: ExtrasFile): Extras {
  const data: PointData = {};
  const sources: Record<string, string> = {};
  for (const [id, s] of Object.entries(file.series)) {
    data[id] = toGrid(s);
    if (s.source) sources[id] = s.source;
  }
  return { data, sources, generated: file.generated };
}

const cache = new Map<string, Promise<Extras>>();

/** Extra records of a featured place, or null for any other point. */
export async function loadExtras(lat: number, lon: number): Promise<Extras | null> {
  if (!hasExtras(lat, lon)) return null;
  const key = fileKey(lat, lon);
  let pending = cache.get(key);
  if (!pending) {
    pending = FILES[key]().then(fromFile);
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }
  return pending;
}
