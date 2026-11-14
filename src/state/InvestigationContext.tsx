import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { VARIABLE_BY_ID, VARIABLE_IDS, seasonById } from "../config/catalog";
import { rankVariables, scanVariables, typicalClues, type Scan } from "../lib/clues";
import { profilePlace } from "../lib/geo";
import { makePlace } from "../lib/places";
import { describeError, fetchPoint } from "../lib/powerApi";
import type { TrendResult } from "../lib/trend";
import { readHash, writeHash } from "../lib/urlHash";
import type { ChartView, Filters, Place, Season, Step, ThemeId, Variable, WhereTab } from "../types";
import { initialState, reducer, type Action, type State } from "./reducer";

interface InvestigateOptions {
  /** Place to investigate; defaults to the one in the picker. */
  place?: Place;
  /** Variable to open; defaults to the strongest clue. */
  variable?: string | null;
}

export interface Actions {
  goTo(step: Step): void;
  setTopic(topic: ThemeId | null): void;
  setPlace(place: Place): void;
  setFilters(filters: Partial<Filters>): void;
  setView(view: ChartView): void;
  setWhereTab(tab: WhereTab): void;
  selectVariable(id: string): void;
  request(what: WhereTab): void;
  /** Downloads all variables for a place. Resolves to true on success. */
  investigate(options?: InvestigateOptions): Promise<boolean>;
  /** Moves the picker to a point and investigates it, keeping the current variable. */
  investigateAt(lat: number, lon: number): Promise<boolean>;
  retry(): Promise<boolean>;
}

/** Derived data for the investigated place, recomputed when the data or filters change. */
export interface Analysis {
  scan: Scan;
  ranked: Variable[];
  hints: Set<string>;
  season: Season;
  /** Currently selected variable and its trend. */
  variable: Variable | null;
  result: TrendResult | null;
}

interface ContextValue {
  state: State;
  actions: Actions;
  analysis: Analysis | null;
}

const InvestigationContext = createContext<ContextValue | null>(null);

export function InvestigationProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, initialState);

  // Mirror of the latest state, updated synchronously so async actions never see stale values.
  const stateRef = useRef(state);
  const dispatch = useCallback((action: Action) => {
    stateRef.current = reducer(stateRef.current, action);
    rawDispatch(action);
  }, []);

  const requestId = useRef(0);
  const lastRequest = useRef<InvestigateOptions>({});

  const actions = useMemo<Actions>(() => {
    const investigate = async (options: InvestigateOptions = {}): Promise<boolean> => {
      lastRequest.current = options;
      const id = ++requestId.current;
      const place = options.place ?? stateRef.current.place;
      dispatch({ type: "investigationStarted" });
      try {
        const data = await fetchPoint(place.lat, place.lon, VARIABLE_IDS);
        if (id !== requestId.current) return false;
        const profile = profilePlace(data, place.lat, place.lon);
        let variable = options.variable && VARIABLE_BY_ID[options.variable] ? options.variable : null;
        if (!variable) {
          const scan = scanVariables(data, stateRef.current.filters);
          const ranked = rankVariables(scan);
          variable = (ranked.find((v) => scan[v.id].ok) ?? ranked[0]).id;
        }
        dispatch({ type: "investigationSucceeded", investigation: { id, place, data, profile }, variable });
        return true;
      } catch (e) {
        if (id === requestId.current) dispatch({ type: "investigationFailed", error: describeError(e) });
        return false;
      }
    };

    return {
      goTo: (step) => dispatch({ type: "setStep", step }),
      setTopic: (topic) => dispatch({ type: "setTopic", topic }),
      setPlace: (place) => dispatch({ type: "setPlace", place }),
      setFilters: (filters) => dispatch({ type: "setFilters", filters }),
      setView: (view) => dispatch({ type: "setView", view }),
      setWhereTab: (tab) => dispatch({ type: "setWhereTab", tab }),
      selectVariable: (variable) => dispatch({ type: "selectVariable", variable }),
      request: (what) => dispatch({ type: "request", what }),
      investigate,
      investigateAt: (lat, lon) => {
        const place = makePlace(lat, lon);
        dispatch({ type: "setPlace", place });
        return investigate({ place, variable: stateRef.current.variable });
      },
      retry: () => investigate(lastRequest.current),
    };
  }, [dispatch]);

  // Restore a shared investigation from the URL on first load.
  useEffect(() => {
    const shared = readHash();
    if (!shared) return;
    if (shared.topic) actions.setTopic(shared.topic);
    actions.setFilters(shared.filters);
    const place = makePlace(shared.lat, shared.lon);
    actions.setPlace(place);
    actions.goTo("verdict");
    void actions.investigate({ place, variable: shared.variable });
  }, [actions]);

  // Keep the URL in sync with the investigation so it can be shared.
  const { investigation, variable, topic, filters } = state;
  useEffect(() => {
    if (investigation && variable) {
      writeHash({ lat: investigation.place.lat, lon: investigation.place.lon, variable, topic, filters });
    }
  }, [investigation, variable, topic, filters]);

  const scan = useMemo(() => (investigation ? scanVariables(investigation.data, filters) : null), [investigation, filters]);

  const analysis = useMemo<Analysis | null>(() => {
    if (!investigation || !scan) return null;
    const hints = typicalClues(investigation.profile.kind, investigation.place.tag);
    return {
      scan,
      hints,
      ranked: rankVariables(scan),
      season: seasonById(filters.season),
      variable: variable ? VARIABLE_BY_ID[variable] : null,
      result: variable ? scan[variable] : null,
    };
  }, [investigation, scan, variable, filters.season]);

  const value = useMemo(() => ({ state, actions, analysis }), [state, actions, analysis]);
  return <InvestigationContext.Provider value={value}>{children}</InvestigationContext.Provider>;
}

export function useInvestigation(): ContextValue {
  const ctx = useContext(InvestigationContext);
  if (!ctx) throw new Error("useInvestigation must be used inside <InvestigationProvider>");
  return ctx;
}
