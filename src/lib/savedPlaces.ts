import { PRESETS } from "../config/catalog";
import type { Place } from "../types";
import { placeFromPreset, samePlace } from "./places";

/** localStorage key; bump the suffix if the stored shape ever changes. */
export const SAVED_PLACES_KEY = "saved-places-v1";
export const MAX_SAVED_PLACES = 40;

export const defaultSavedPlaces = (): Place[] => PRESETS.map(placeFromPreset);

const isPlace = (x: unknown): x is Place => {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.lat === "number" && isFinite(p.lat) && Math.abs(p.lat) <= 90 &&
    typeof p.lon === "number" && isFinite(p.lon) && Math.abs(p.lon) <= 180 &&
    typeof p.name === "string" && p.name.trim() !== "" &&
    typeof p.region === "string" &&
    (p.tag === null || typeof p.tag === "string") &&
    (p.customName === undefined || typeof p.customName === "boolean")
  );
};

const MAX_NAME_LENGTH = 40;
const nameKey = (name: string) => cleanName(name).toLocaleLowerCase();

/** Trims and collapses spaces; names are compared ignoring case. */
export const cleanName = (name: string) => name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);

/** True when another saved place (not at `except`) already uses this name. */
export const isNameTaken = (list: Place[], name: string, except?: { lat: number; lon: number }) =>
  list.some((p) => (!except || !samePlace(p, except)) && nameKey(p.name) === nameKey(name));

/** `name`, or `name 2`, `name 3`… so that no two saved places share a name. */
export function uniqueName(list: Place[], name: string): string {
  if (!isNameTaken(list, name)) return name;
  let n = 2;
  while (isNameTaken(list, `${name} ${n}`)) n++;
  return `${name} ${n}`;
}

const stored = (p: Place, name = p.name): Place => ({
  lat: p.lat,
  lon: p.lon,
  name,
  region: p.region,
  tag: p.tag,
  ...(p.customName ? { customName: true } : {}),
});

/** Parses the stored list. Invalid entries and duplicates are dropped, repeated names numbered; null means “nothing usable stored”. */
export function parseSavedPlaces(raw: string | null): Place[] | null {
  if (raw == null) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    const out: Place[] = [];
    for (const x of data) {
      if (isPlace(x) && !out.some((p) => samePlace(p, x))) {
        out.push(stored(x, uniqueName(out, x.name)));
      }
    }
    return out.slice(0, MAX_SAVED_PLACES);
  } catch {
    return null;
  }
}

/** Adds the place (once, up to the maximum), numbering its name if another saved place already uses it. */
export const withPlace = (list: Place[], place: Place): Place[] =>
  list.some((p) => samePlace(p, place)) || list.length >= MAX_SAVED_PLACES
    ? list
    : [...list, stored(place, uniqueName(list, place.name))];

export type RenameError = "empty" | "taken";

/** Renames the saved place at these coordinates, or says why the name can't be used. */
export function withName(list: Place[], at: { lat: number; lon: number }, name: string): Place[] | RenameError {
  const clean = cleanName(name);
  if (!clean) return "empty";
  if (isNameTaken(list, clean, at)) return "taken";
  return list.map((p) => (samePlace(p, at) ? { ...stored(p, clean), customName: true } : p));
}

export const withoutPlace = (list: Place[], place: { lat: number; lon: number }): Place[] =>
  list.filter((p) => !samePlace(p, place));

// ---- Shared store: one list for every component and browser tab ----

type Listener = () => void;
const listeners = new Set<Listener>();
let current: Place[] | null = null;

function read(): Place[] {
  try {
    return parseSavedPlaces(localStorage.getItem(SAVED_PLACES_KEY)) ?? defaultSavedPlaces();
  } catch {
    return defaultSavedPlaces(); // storage blocked (private mode, sandboxed frame)
  }
}

export function getSavedPlaces(): Place[] {
  return (current ??= read());
}

export function setSavedPlaces(next: Place[]): void {
  current = next;
  try {
    localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(next));
  } catch {
    // Private mode: the list just won't be remembered.
  }
  listeners.forEach((l) => l());
}

export function resetSavedPlaces(): void {
  current = defaultSavedPlaces();
  try {
    localStorage.removeItem(SAVED_PLACES_KEY);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function subscribeSavedPlaces(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === SAVED_PLACES_KEY) {
      current = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
