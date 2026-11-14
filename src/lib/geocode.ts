// Place search (cities, states, countries, landmarks…) via Photon, a free OpenStreetMap geocoder
// built for search-as-you-type. No API key; CORS enabled. https://photon.komoot.io
const PHOTON_URL = "https://photon.komoot.io/api/";

export interface GeocodeResult {
  /** Stable key for lists. */
  id: string;
  name: string;
  /** Broader context, e.g. "São Paulo, Brazil". */
  region: string;
  /** Kind of place, e.g. "city", "state", "country". */
  kind: string;
  lat: number;
  lon: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    osm_value?: string;
    type?: string;
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

/** Turns a Photon response into unique, labelled results (Photon often returns the same city twice). */
export function parsePhoton(json: { features?: PhotonFeature[] }): GeocodeResult[] {
  const seen = new Set<string>();
  const out: GeocodeResult[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties;
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (!p?.name || !isFinite(lat) || !isFinite(lon)) continue;

    const context = [p.city, p.county, p.state, p.country].filter((x, i, a): x is string => !!x && x !== p.name && a.indexOf(x) === i);
    const region = context.slice(-2).join(", ");
    const label = `${p.name}|${region}`;
    if (seen.has(label)) continue;
    seen.add(label);

    out.push({
      id: `${p.osm_type ?? ""}${p.osm_id ?? out.length}`,
      name: p.name,
      region,
      kind: (p.osm_value === "administrative" ? p.type : p.osm_value) ?? p.type ?? "place",
      lat,
      lon,
    });
  }
  return out;
}

export async function searchPlaces(query: string, signal?: AbortSignal, limit = 8): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=${limit + 4}&lang=en`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  return parsePhoton(await res.json()).slice(0, limit);
}

// Reverse geocoding (point → city/state) via Nominatim, which resolves administrative boundaries,
// so rural points still get their municipality. Usage policy: ≤1 request/s — callers debounce.
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

export interface ReverseResult {
  name: string;
  region: string;
}

interface NominatimReverse {
  error?: string;
  name?: string;
  address?: Record<string, string | undefined>;
}

export function parseNominatimReverse(json: NominatimReverse): ReverseResult | null {
  if (json.error) return null;
  const a = json.address ?? {};
  const name = json.name || a.city || a.town || a.village || a.municipality || a.county || a.state || a.country;
  if (!name) return null;
  const region = [a.state, a.country].filter((x, i, arr): x is string => !!x && x !== name && arr.indexOf(x) === i).join(", ");
  return { name, region };
}

const reverseCache = new Map<string, ReverseResult | null>();

/** Name of the city/municipality (or county, state, country) at a point; null over the ocean. */
export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<ReverseResult | null> {
  const key = `${lat},${lon}`;
  if (reverseCache.has(key)) return reverseCache.get(key)!;
  const url = `${NOMINATIM_REVERSE_URL}?format=jsonv2&zoom=10&accept-language=en&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Place lookup failed (${res.status})`);
  const result = parseNominatimReverse(await res.json());
  reverseCache.set(key, result);
  return result;
}
