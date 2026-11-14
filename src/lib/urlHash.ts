// Shareable investigation links: #lat=..&lon=..&v=..&t=..&y0=..&y1=..&s=..
import { FIRST_YEAR, LAST_YEAR, MIN_SPAN, SEASONS, THEMES, VARIABLE_BY_ID } from "../config/catalog";
import type { Filters, ThemeId } from "../types";

export interface SharedInvestigation {
  lat: number;
  lon: number;
  variable: string | null;
  topic: ThemeId | null;
  filters: Partial<Filters>;
}

export function writeHash(s: { lat: number; lon: number; variable: string; topic: ThemeId | null; filters: Filters }): void {
  const { y0, y1, season } = s.filters;
  const t = s.topic ? `&t=${s.topic}` : "";
  history.replaceState(null, "", `#lat=${s.lat}&lon=${s.lon}&v=${s.variable}${t}&y0=${y0}&y1=${y1}&s=${season}`);
}

export function readHash(hash = location.hash): SharedInvestigation | null {
  const q = new URLSearchParams(hash.slice(1));
  const lat = parseFloat(q.get("lat") ?? "");
  const lon = parseFloat(q.get("lon") ?? "");
  if (!isFinite(lat) || !isFinite(lon)) return null;

  const topic = THEMES.find((t) => t.id === q.get("t"))?.id ?? null;
  const v = q.get("v");
  const filters: Partial<Filters> = {};
  const season = q.get("s");
  if (season && SEASONS.some((s) => s.id === season)) filters.season = season;
  const y0 = parseInt(q.get("y0") ?? "");
  const y1 = parseInt(q.get("y1") ?? "");
  if (y0 >= FIRST_YEAR && y1 <= LAST_YEAR && y1 - y0 >= MIN_SPAN) Object.assign(filters, { y0, y1 });

  return { lat, lon, variable: v && VARIABLE_BY_ID[v] ? v : null, topic, filters };
}
