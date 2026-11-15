import { presetAt } from "../config/catalog";
import type { Place, Preset } from "../types";
import { clamp } from "./stats";

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Normalises coordinates (0.1° precision, inside the grid) and attaches preset metadata when it matches.
 * `label` names a non-preset point (default “Selected point”).
 */
export const DEFAULT_PLACE_LABEL = "Selected point";

export function makePlace(lat: number, lon: number, preset?: Preset, label = DEFAULT_PLACE_LABEL): Place {
  lat = clamp(round1(lat), -89.5, 89.5);
  lon = clamp(round1(lon), -179.5, 179.5);
  const p = preset ?? presetAt(lat, lon);
  return { lat, lon, name: p?.name ?? label, region: p?.region ?? "", tag: p?.tag ?? null };
}

export const placeFromPreset = (p: Preset): Place => makePlace(p.lat, p.lon, p);

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const samePlace = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  a.lat === b.lat && a.lon === b.lon;
