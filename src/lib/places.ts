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

export const samePlace = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  a.lat === b.lat && a.lon === b.lon;
