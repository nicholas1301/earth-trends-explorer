// View state and math for the interactive world map: an orthographic globe (true shapes)
// or a flat Equal Earth map (true areas). Pure functions; rendering lives in <GeoMap>.
import { geoDistance, geoEqualEarth, geoOrthographic, type GeoProjection } from "d3-geo";
import { clamp } from "./stats";

export type MapMode = "globe" | "flat";

export interface MapView {
  mode: MapMode;
  /** Globe centre. */
  lon0: number;
  lat0: number;
  /** Zoom factor (1 = whole Earth). */
  k: number;
  /** Flat-map pan offset, in viewBox units. */
  px: number;
  py: number;
}

export interface LatLon {
  lat: number;
  lon: number;
}

export const MAP_W = 600;
export const MAP_H = 340;
const CX = MAP_W / 2;
const CY = MAP_H / 2;
const GLOBE_RADIUS = 156;
export const MAX_ZOOM = 12;
const R2D = 180 / Math.PI;
const PAN_MARGIN = 30;

const SPHERE = { type: "Sphere" } as const;
/** Equal Earth scale that fits the whole world in the viewBox, and its half-size at scale 1. */
const FLAT_SCALE = geoEqualEarth().fitExtent([[10, 10], [MAP_W - 10, MAP_H - 10]], SPHERE).scale();
const unitEE = geoEqualEarth().scale(1).translate([0, 0]);
const EE_HALF_W = unitEE([180, 0])![0];
const EE_HALF_H = Math.abs(unitEE([0, 90])![1]);

export const wrapLon = (lon: number) => ((((lon + 540) % 360) + 360) % 360) - 180;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function initialView(mode: MapMode, center: LatLon = { lat: 15, lon: -20 }): MapView {
  return { mode, lon0: center.lon, lat0: clamp(center.lat, -60, 60), k: 1, px: 0, py: 0 };
}

export const globeRadius = (v: MapView) => GLOBE_RADIUS * v.k;
export const center = { x: CX, y: CY };

export function makeProjection(v: MapView): GeoProjection {
  if (v.mode === "flat") return geoEqualEarth().scale(FLAT_SCALE * v.k).translate([CX + v.px, CY + v.py]);
  return geoOrthographic().scale(globeRadius(v)).translate([CX, CY]).rotate([-v.lon0, -v.lat0]);
}

/** Geographic point under a viewBox coordinate, or null outside the Earth. */
export function invert(v: MapView, x: number, y: number): LatLon | null {
  if (v.mode === "globe" && Math.hypot(x - CX, y - CY) > globeRadius(v)) return null;
  const p = makeProjection(v).invert?.([x, y]);
  if (!p || !isFinite(p[0]) || !isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) return null;
  return { lon: p[0], lat: p[1] };
}

/** Whether a point is on the visible hemisphere (always true on the flat map). */
export const isVisible = (v: MapView, p: LatLon) =>
  v.mode === "flat" || geoDistance([p.lon, p.lat], [v.lon0, v.lat0]) < Math.PI / 2 + 0.02;

function clampPan(v: MapView): MapView {
  const s = FLAT_SCALE * v.k;
  const mx = Math.max(0, EE_HALF_W * s - MAP_W / 2 + PAN_MARGIN);
  const my = Math.max(0, EE_HALF_H * s - MAP_H / 2 + PAN_MARGIN);
  return { ...v, px: clamp(v.px, -mx, mx), py: clamp(v.py, -my, my) };
}

/** Drag by (dx, dy) viewBox units: rotates the globe or pans the flat map. */
export function pan(v: MapView, dx: number, dy: number): MapView {
  if (v.mode === "flat") return clampPan({ ...v, px: v.px + dx, py: v.py + dy });
  const r = globeRadius(v);
  return { ...v, lon0: wrapLon(v.lon0 - (dx / r) * R2D), lat0: clamp(v.lat0 + (dy / r) * R2D, -89, 89) };
}

/** Zooms by `factor`, keeping the point under (x, y) fixed. */
export function zoomAt(v: MapView, factor: number, x = CX, y = CY): MapView {
  const k = clamp(v.k * factor, 1, MAX_ZOOM);
  if (k === v.k) return v;
  if (v.mode === "flat") {
    const ax = x - CX;
    const ay = y - CY;
    return clampPan({ ...v, k, px: ax - ((ax - v.px) * k) / v.k, py: ay - ((ay - v.py) * k) / v.k });
  }
  // Globe: rotate so the geographic point under the cursor stays put (two refinement passes).
  const anchor = invert(v, x, y);
  let next = { ...v, k };
  for (let i = 0; i < 2 && anchor; i++) {
    const now = invert(next, x, y);
    if (!now) break;
    next = { ...next, lon0: wrapLon(next.lon0 + wrapLon(anchor.lon - now.lon)), lat0: clamp(next.lat0 + anchor.lat - now.lat, -89, 89) };
  }
  return next;
}

/** Zoom by a factor around the current centre, also scaling the flat pan (used by the +/− buttons). */
export function zoomCentered(v: MapView, factor: number): MapView {
  const k = clamp(v.k * factor, 1, MAX_ZOOM);
  const r = k / v.k;
  return clampPan({ ...v, k, px: v.px * r, py: v.py * r });
}

/** View centred on a point (globe: rotate; flat: pan). */
export function centeredOn(v: MapView, p: LatLon, k = v.k): MapView {
  if (v.mode === "flat") {
    const xy = unitEE([p.lon, p.lat])!;
    const s = FLAT_SCALE * k;
    return clampPan({ ...v, k, px: -xy[0] * s, py: -xy[1] * s });
  }
  return { ...v, lon0: p.lon, lat0: clamp(p.lat, -80, 80), k, px: 0, py: 0 };
}

/** Animation length for flying to a point: longer for farther targets on the globe. */
export function flightDuration(v: MapView, p: LatLon): number {
  if (v.mode === "flat") return 600;
  return 450 + geoDistance([p.lon, p.lat], [v.lon0, v.lat0]) * R2D * 5;
}

/** Reset zoom; the globe re-centres on `home` when given. */
export function homeView(v: MapView, home?: LatLon): MapView {
  if (v.mode === "flat") return { ...v, k: 1, px: 0, py: 0 };
  return { ...v, k: 1, px: 0, py: 0, ...(home ? { lon0: home.lon, lat0: clamp(home.lat, -60, 60) } : {}) };
}

/** Switches projection, keeping what is in the middle of the screen. */
export function switchMode(v: MapView, mode: MapMode): MapView {
  if (mode === v.mode) return v;
  const middle = v.mode === "flat" ? invert(v, CX, CY) : null;
  return {
    mode,
    k: 1,
    px: 0,
    py: 0,
    lon0: middle ? middle.lon : v.lon0,
    lat0: middle ? clamp(middle.lat, -60, 60) : v.lat0,
  };
}

/** Linear blend between two views of the same mode (longitude takes the short way round). */
export function interpolateView(a: MapView, b: MapView, t: number): MapView {
  return {
    mode: b.mode,
    lon0: wrapLon(a.lon0 + wrapLon(b.lon0 - a.lon0) * t),
    lat0: a.lat0 + (b.lat0 - a.lat0) * t,
    k: a.k + (b.k - a.k) * t,
    px: a.px + (b.px - a.px) * t,
    py: a.py + (b.py - a.py) * t,
  };
}
