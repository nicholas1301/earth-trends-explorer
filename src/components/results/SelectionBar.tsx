import { useCallback, useEffect, useRef, useState } from "react";
import { THEMES, VARIABLES } from "../../config/catalog";
import { useSavedPlaces } from "../../hooks/useSavedPlaces";
import { makePlace, samePlace } from "../../lib/places";
import { useInvestigation } from "../../state/InvestigationContext";
import type { Place } from "../../types";
import { PlaceSearch } from "../setup/PlaceSearch";
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

/** The investigated place (and, where relevant, variable), visible and editable on every result step. */
export function SelectionBar({ showVariable }: Props) {
  const { state, actions } = useInvestigation();
  const place = state.investigation?.place ?? state.place;
  const [editing, setEditing] = useState(false);
  const close = useCallback(() => setEditing(false), []);

  const choose = (p: Place) => {
    setEditing(false);
    if (state.investigation && samePlace(p, state.investigation.place)) return;
    actions.setPlace(p);
    void actions.investigate({ place: p, variable: state.variable });
  };

  return (
    <div className="selection-bar" id="selection">
      <div className="selection-row">
        <div className="selection-item">
          <span className="selection-label">Place</span>
          <span className="selection-value">
            <b>{place.name}</b>
            {place.region && <span className="muted"> · {place.region}</span>}
          </span>
          <button type="button" className="link" aria-expanded={editing} aria-controls="selection-place" onClick={() => setEditing((e) => !e)}>
            {editing ? "Cancel" : "Change"}
          </button>
        </div>

        {showVariable && (
          <label className="selection-item">
            <span className="selection-label">Variable</span>
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
      </div>

      {editing && <PlaceEditor current={place} onChoose={choose} onMap={() => { setEditing(false); actions.goTo("place"); }} onClose={close} />}
    </div>
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
