import { useMemo, useSyncExternalStore } from "react";
import { samePlace } from "../lib/places";
import {
  MAX_SAVED_PLACES,
  type RenameError,
  getSavedPlaces,
  resetSavedPlaces,
  setSavedPlaces,
  subscribeSavedPlaces,
  withName,
  withPlace,
  withoutPlace,
} from "../lib/savedPlaces";
import type { Place } from "../types";

/** The user's saved places (persisted in localStorage), shown on the Place step and compared on the Compare step. */
export function useSavedPlaces() {
  const places = useSyncExternalStore(subscribeSavedPlaces, getSavedPlaces);
  return useMemo(
    () => ({
      places,
      isFull: places.length >= MAX_SAVED_PLACES,
      has: (p: { lat: number; lon: number }) => places.some((s) => samePlace(s, p)),
      /** Saves the place and returns it as stored (its name may be numbered to stay unique). */
      add: (p: Place): Place | undefined => {
        const next = withPlace(getSavedPlaces(), p);
        setSavedPlaces(next);
        return next.find((s) => samePlace(s, p));
      },
      remove: (p: { lat: number; lon: number }) => setSavedPlaces(withoutPlace(getSavedPlaces(), p)),
      /** Renames a saved place; returns the reason when the name can't be used. */
      rename: (p: { lat: number; lon: number }, name: string): RenameError | null => {
        const next = withName(getSavedPlaces(), p, name);
        if (typeof next === "string") return next;
        setSavedPlaces(next);
        return null;
      },
      reset: resetSavedPlaces,
    }),
    [places],
  );
}
