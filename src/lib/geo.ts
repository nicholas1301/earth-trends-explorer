// Continent outlines and simple place classification.
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { MultiPolygon, Polygon } from "geojson";
import landTopology from "world-atlas/land-110m.json";
import { FIRST_YEAR, LAST_YEAR, SEASONS } from "../config/catalog";
import type { PointData } from "../types";
import { annualSeries } from "./trend";

type Ring = Array<[number, number]>; // [lon, lat]

/**
 * Makes a spherical ring usable on a flat lon/lat plane:
 * - longitudes are unwrapped so the ring has no ±180° jumps (Chukotka, Fiji…);
 * - a ring that circles a pole (Antarctica) is closed through that pole;
 * - parts pushed beyond ±180° get a copy shifted by 360° so they reappear on the other side.
 */
function flattenRing(ring: Ring): Ring[] {
  const out: Ring = [ring[0]];
  for (let k = 1; k < ring.length; k++) {
    const prev = out[out.length - 1][0];
    let lon = ring[k][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, ring[k][1]]);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (Math.abs(last[0] - first[0]) > 180) {
    const pole = first[1] < 0 ? -90 : 90;
    out.push([last[0], pole], [first[0], pole]);
  }
  const lons = out.map((p) => p[0]);
  const copies = [out];
  if (Math.min(...lons) < -180) copies.push(out.map(([x, y]) => [x + 360, y]));
  if (Math.max(...lons) > 180) copies.push(out.map(([x, y]) => [x - 360, y]));
  return copies;
}

const topology = landTopology as unknown as Topology<{ land: GeometryCollection }>;

/** Natural Earth 1:110m land (public domain) as spherical GeoJSON, for d3-geo projections. */
export const LAND_GEOJSON = feature(topology, topology.objects.land);

/** The same land as flat lon/lat rings, for planar maps and the point-in-polygon test. */
const LAND_RINGS: Ring[] = (() => {
  const rings: Ring[] = [];
  for (const f of LAND_GEOJSON.features) {
    const g = f.geometry as Polygon | MultiPolygon;
    const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const polygon of polygons) for (const ring of polygon) rings.push(...flattenRing(ring as Ring));
  }
  return rings;
})();

/**
 * SVG path of the land in an equirectangular viewBox "-180 -90 360 180" (y = −lat).
 * Render with fill-rule="evenodd" so lakes/holes stay empty.
 */
export const LAND_PATH = LAND_RINGS.map(
  (r) => "M" + r.map(([lon, lat]) => `${lon.toFixed(2)} ${(-lat).toFixed(2)}`).join("L") + "Z",
).join("");

/** Even-odd point-in-polygon test over all land rings. */
export function isLand(lat: number, lon: number): boolean {
  let inside = false;
  for (const ring of LAND_RINGS) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[j];
      if (ay > lat !== by > lat && lon < ((bx - ax) * (lat - ay)) / (by - ay) + ax) inside = !inside;
    }
  }
  return inside;
}

export interface PlaceProfile {
  /** Climate type, used to pick “typical clue” variables. */
  kind: string;
  /** Mean annual air temperature (°C). */
  meanTemp: number;
  /** Mean annual precipitation (mm/year). */
  annualRain: number;
}

/** Rough climate classification from long-term means of temperature and precipitation. */
export function profilePlace(data: PointData, lat: number, lon: number): PlaceProfile {
  const allMonths = SEASONS[0].months;
  const meanTemp = annualSeries(data.T2M, FIRST_YEAR, LAST_YEAR, allMonths).base;
  const annualRain = annualSeries(data.PRECTOTCORR, FIRST_YEAR, LAST_YEAR, allMonths).base * 365.25;

  let kind: string;
  if (!isLand(lat, lon)) kind = "ocean";
  else if (meanTemp < 0) kind = "polar";
  else if (meanTemp < 10) kind = "cold";
  else if (annualRain < 250) kind = "desert";
  else if (annualRain < 700) kind = "semi-arid";
  else if (meanTemp >= 22 && annualRain >= 1500) kind = "humid tropical";
  else kind = "temperate";
  return { kind, meanTemp, annualRain };
}
