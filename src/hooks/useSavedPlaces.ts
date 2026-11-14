import { useMemo, useSyncExternalStore } from "react";
import { samePlace } from "../lib/places";
import {
  MAX_SAVED_PLACES,
  getSavedPlaces,
  resetSavedPlaces,
  setSavedPlaces,
  subscribeSavedPlaces,
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
      add: (p: Place) => setSavedPlaces(withPlace(getSavedPlaces(), p)),
      remove: (p: { lat: number; lon: number }) => setSavedPlaces(withoutPlace(getSavedPlaces(), p)),
      reset: resetSavedPlaces,
    }),
    [places],
  );
}
