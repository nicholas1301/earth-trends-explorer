import { useCallback, useEffect, useRef, useState } from "react";
import { seasonById, THEMES, VARIABLES } from "../../config/catalog";
import { useSavedPlaces } from "../../hooks/useSavedPlaces";
import { makePlace, samePlace } from "../../lib/places";
import { useInvestigation } from "../../state/InvestigationContext";
import type { Place } from "../../types";
import { PlaceSearch } from "../setup/PlaceSearch";
import { FiltersBar } from "./FiltersBar";
import "../setup/PlacePicker.css";
import "./SelectionBar.css";

/** Variables grouped by their main topic, for the variable picker. */
const VARIABLE_GROUPS = THEMES.map((t) => ({ theme: t, variables: VARIABLES.filter((v) => v.themes[0] === t.id) })).filter(
  (g) => g.variables.length > 0,
);

interface Props {
  /** Show the variable picker (steps that depend on one variable). */
  showVariable: boolean;
}

/**
 * The investigation's context — place, variable, period and time of year — visible and editable on every result step.
 * Wide screens show every control in one compact strip; narrow screens show a one-line summary that expands on demand.
 */
export function SelectionBar({ showVariable }: Props) {
  const { state, actions } = useInvestigation();
  const place = state.investigation?.place ?? state.place;
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setEditing(false), []);

  const choose = (p: Place) => {
    setEditing(false);
    if (state.investigation && samePlace(p, state.investigation.place)) return;
    actions.setPlace(p);
    void actions.investigate({ place: p, variable: state.variable });
  };

  if (!place) return null;

  const { filters } = state;
  const variable = showVariable ? VARIABLES.find((v) => v.id === state.variable) : undefined;
  const summary = [variable?.name, `${filters.y0}–${filters.y1}`, seasonById(filters.season).name].filter(Boolean);

  return (
    <section className="selection-bar" id="selection" aria-label="Investigation settings" data-open={open}>
      <button type="button" className="selection-summary" aria-expanded={open} aria-controls="selection-controls" onClick={() => setOpen((o) => !o)}>
        <span className="selection-summary-text">
          <b>{place.name}</b>
          {summary.map((s) => <span key={s}> · {s}</span>)}
        </span>
        <span className="selection-summary-action">{open ? "Done" : "Edit"}</span>
      </button>

      <div className="selection-controls" id="selection-controls">
        <div className="ctl ctl-place">
          <span className="ctl-label">Place</span>
          <span className="ctl-input">
            <span className="selection-value">
              <b>{place.name}</b>
              {place.region && <span className="muted"> · {place.region}</span>}
            </span>
            <button type="button" className="link" aria-expanded={editing} aria-controls="selection-place" onClick={() => setEditing((e) => !e)}>
              {editing ? "Cancel" : "Change"}
            </button>
          </span>
        </div>

        {showVariable && (
          <label className="ctl ctl-variable">
            <span className="ctl-label">Variable</span>
            <select value={state.variable ?? ""} onChange={(e) => actions.selectVariable(e.target.value)}>
              {VARIABLE_GROUPS.map(({ theme, variables }) => (
                <optgroup key={theme.id} label={theme.name}>
                  {variables.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        )}

        <FiltersBar />

        {editing && <PlaceEditor current={place} onChoose={choose} onMap={() => { setEditing(false); actions.goTo("place"); }} onClose={close} />}
      </div>
    </section>
  );
}

interface EditorProps {
  current: Place;
  onChoose(place: Place): void;
  onMap(): void;
  onClose(): void;
}

/** Quick place switcher: search by name or pick a saved place; the globe stays on step 1. */
function PlaceEditor({ current, onChoose, onMap, onClose }: EditorProps) {
  const saved = useSavedPlaces();
  const ref = useRef<HTMLDivElement>(null);

  // Focus the search box on open; Escape closes the editor.
  useEffect(() => {
    ref.current?.querySelector("input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="selection-editor" id="selection-place" ref={ref}>
      <PlaceSearch onSelect={(r) => onChoose({ ...makePlace(r.lat, r.lon, undefined, r.name), name: r.name, region: r.region })} />
      {saved.places.length > 0 && (
        <div className="chips" aria-label="Saved places">
          {saved.places.map((p) => (
            <button
              key={`${p.lat},${p.lon}`}
              type="button"
              className="chip"
              title={[p.region, p.tag].filter(Boolean).join(" · ")}
              aria-pressed={samePlace(p, current)}
              onClick={() => onChoose(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="link" onClick={onMap}>Pick on the globe, by coordinates or with your location →</button>
    </div>
  );
}
