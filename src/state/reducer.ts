import { FIRST_YEAR, LAST_YEAR, MIN_SPAN, PRESETS } from "../config/catalog";
import type { PlaceProfile } from "../lib/geo";
import { placeFromPreset } from "../lib/places";
import type { ChartView, Filters, Place, PointData, ThemeId, WhereTab } from "../types";

/** A completed data download for one place. */
export interface Investigation {
  id: number;
  place: Place;
  data: PointData;
  profile: PlaceProfile;
}

export interface State {
  theme: ThemeId;
  /** Place currently chosen in the picker (may differ from the investigated one). */
  place: Place;
  filters: Filters;
  view: ChartView;
  whereTab: WhereTab;
  investigation: Investigation | null;
  variable: string | null;
  loading: boolean;
  error: string | null;
  /** Whether the user asked to map the neighbourhood / compare with the world for the current variable. */
  regionRequested: boolean;
  worldRequested: boolean;
}

export const initialState: State = {
  theme: "heat",
  place: placeFromPreset(PRESETS[0]),
  filters: { y0: FIRST_YEAR, y1: LAST_YEAR, season: "year" },
  view: "annual",
  whereTab: "region",
  investigation: null,
  variable: null,
  loading: false,
  error: null,
  regionRequested: false,
  worldRequested: false,
};

export type Action =
  | { type: "setTheme"; theme: ThemeId }
  | { type: "setPlace"; place: Place }
  | { type: "setFilters"; filters: Partial<Filters> }
  | { type: "setView"; view: ChartView }
  | { type: "setWhereTab"; tab: WhereTab }
  | { type: "selectVariable"; variable: string }
  | { type: "request"; what: WhereTab }
  | { type: "investigationStarted" }
  | { type: "investigationSucceeded"; investigation: Investigation; variable: string }
  | { type: "investigationFailed"; error: string };

/** Keeps the period at least MIN_SPAN years long, adjusting the bound that was not edited. */
function normalizeFilters(prev: Filters, patch: Partial<Filters>): Filters {
  const next = { ...prev, ...patch };
  if (patch.y0 !== undefined && patch.y1 === undefined) next.y0 = Math.min(next.y0, next.y1 - MIN_SPAN);
  if (patch.y1 !== undefined && patch.y0 === undefined) next.y1 = Math.max(next.y1, next.y0 + MIN_SPAN);
  return next;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setTheme":
      return { ...state, theme: action.theme };
    case "setPlace":
      return { ...state, place: action.place };
    case "setFilters":
      return { ...state, filters: normalizeFilters(state.filters, action.filters) };
    case "setView":
      return { ...state, view: action.view };
    case "setWhereTab":
      return { ...state, whereTab: action.tab };
    case "selectVariable":
      if (action.variable === state.variable) return state;
      return { ...state, variable: action.variable, regionRequested: false, worldRequested: false };
    case "request":
      return action.what === "region" ? { ...state, regionRequested: true } : { ...state, worldRequested: true };
    case "investigationStarted":
      return { ...state, loading: true, error: null };
    case "investigationSucceeded":
      return {
        ...state,
        loading: false,
        error: null,
        investigation: action.investigation,
        variable: action.variable,
        regionRequested: false,
        worldRequested: false,
      };
    case "investigationFailed":
      return { ...state, loading: false, error: action.error };
  }
}
