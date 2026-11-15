import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCoord } from "../../lib/format";
import { isLand } from "../../lib/geo";
import type { LatLon } from "../../lib/mapView";
import { reverseGeocode } from "../../lib/geocode";
import { DEFAULT_PLACE_LABEL, makePlace, samePlace } from "../../lib/places";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useSavedPlaces } from "../../hooks/useSavedPlaces";
import { useInvestigation } from "../../state/InvestigationContext";
import type { Place } from "../../types";
import { GeoMap, type MapMarker } from "../charts/GeoMap";
import { PlaceSearch } from "./PlaceSearch";
import { SectionHeading } from "../ui/SectionHeading";
import "./PlacePicker.css";

const MY_LOCATION = "Your location";

interface Props {
  /** Called after a successful investigation started from the “Investigate” button. */
  onInvestigated(): void;
  onBack(): void;
}

/** Step 1: choose a place by name, on the globe, from the saved places, by coordinates or with the browser location. */
export function PlacePicker({ onInvestigated, onBack }: Props) {
  const { state, actions } = useInvestigation();
  const { place } = state;

  // The globe flies to the chosen place, except when the user picked it on the globe itself.
  const pickedOnMap = useRef(false);
  const [flyTo, setFlyTo] = useState<(LatLon & { key: number }) | null>(null);
  useEffect(() => {
    if (!place) return;
    if (pickedOnMap.current) pickedOnMap.current = false;
    else setFlyTo((f) => ({ lat: place.lat, lon: place.lon, key: (f?.key ?? 0) + 1 }));
  }, [place?.lat, place?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  const lookingUp = usePlaceName(place, actions.setPlace);
  const saved = useSavedPlaces();
  const [editing, setEditing] = useState(false);
  const [coordsOpen, setCoordsOpen] = useState(false);
  const isSaved = !!place && saved.has(place);

  const choose = useCallback((p: Place) => actions.setPlace(p), [actions]);
  const geo = useGeolocation(useCallback((lat, lon) => choose(makePlace(lat, lon, undefined, MY_LOCATION)), [choose]));

  // Any other choice clears the location message.
  useEffect(() => {
    if (place?.name !== MY_LOCATION) geo.reset();
  }, [place, geo.reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const markers = useMemo<MapMarker[]>(
    () => [
      ...saved.places.map((p) => ({
        key: `${p.lat},${p.lon}`,
        lat: p.lat,
        lon: p.lon,
        onClick: () => choose(p),
        content: (
          <circle className="preset-dot" r={4.5}>
            <title>{p.name + (p.tag ? ` — ${p.tag}` : "")}</title>
          </circle>
        ),
      })),
      ...(place
        ? [
            {
              key: "selected",
              lat: place.lat,
              lon: place.lon,
              content: (
                <g pointerEvents="none">
                  <circle r={11} fill="none" stroke="var(--red)" strokeWidth={2.5} />
                  <circle r={3.5} fill="var(--red)" />
                </g>
              ),
            },
          ]
        : []),
    ],
    [place, choose, saved.places],
  );

  const investigate = async () => {
    if (await actions.investigate()) onInvestigated();
  };

  const description = place && formatCoord(place.lat, place.lon) + " · " + (place.tag ?? (isLand(place.lat, place.lon) ? "land" : "ocean"));

  return (
    <section id="q-place">
      <SectionHeading title="Where?" />
      <p className="lead">Search for any city, state or country, click anywhere on the globe, or pick one of your saved places.</p>

      <div className="cols place-cols">
        <GeoMap
          label="World map for choosing the location"
          initialMode="globe"
          markers={markers}
          flyTo={flyTo}
          home={place ?? undefined}
          onPick={(g) => {
            pickedOnMap.current = true;
            choose(makePlace(g.lat, g.lon));
          }}
        />

        <div className="place-panel">
          <div className="place-find">
            <PlaceSearch onSelect={(r) => choose({ ...makePlace(r.lat, r.lon, undefined, r.name), name: r.name, region: r.region })} />
            <div className="place-find-row">
              <button
                type="button"
                className="find-btn"
                disabled={geo.status.kind === "asking"}
                onClick={geo.locate}
                title="Your browser will ask for permission first. The position is rounded to 0.1° (about 11 km) and is only used to query NASA data."
              >
                <span aria-hidden="true">📍</span>
                {geo.status.kind === "asking" ? "Locating…" : "My location"}
              </button>
              <button type="button" className="find-btn" aria-expanded={coordsOpen} aria-controls="place-coords" onClick={() => setCoordsOpen((o) => !o)}>
                <span aria-hidden="true">⌖</span>
                Coordinates
              </button>
            </div>
            {coordsOpen && (
              <div id="place-coords" className="row place-coords">
                <CoordinateInputs lat={place?.lat} lon={place?.lon} onChange={(lat, lon) => choose(makePlace(lat, lon))} />
              </div>
            )}
            <GeolocationMessage status={geo.status} onRetry={geo.locate} />
          </div>

          <div className="place-now">
            <div className="place-now-head">
              <h3>Selected place</h3>
              {place && (
                <button
                  type="button"
                  className="save-toggle"
                  aria-pressed={isSaved}
                  disabled={!isSaved && (saved.isFull || lookingUp)}
                  title={isSaved ? "Remove from saved places" : saved.isFull ? "Your list is full — remove a place first" : "Add to saved places"}
                  onClick={() => (isSaved ? saved.remove(place) : saved.add(place))}
                >
                  <span aria-hidden="true">{isSaved ? "★" : "☆"}</span>
                  {isSaved ? "Saved" : "Save"}
                </button>
              )}
            </div>
            {place ? (
              <>
                <b>{lookingUp ? <span className="place-lookup">Finding place name…</span> : place.name}</b>
                <div className="muted">
                  {place.region && `${place.region} · `}
                  {description}
                </div>
              </>
            ) : (
              <div className="muted">No place chosen yet: search, click the globe or pick a saved place.</div>
            )}
            <button type="button" className="primary big" disabled={state.loading || !place} onClick={investigate}>
              {state.loading ? "Fetching NASA data…" : "Investigate this place →"}
            </button>
          </div>

          <div className="saved-places">
            <div className="saved-places-head">
              <h3>Saved places <span className="muted">· {saved.places.length}</span></h3>
              {saved.places.length > 0 && (
                <button type="button" className="link" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
                  {editing ? "Done" : "Edit"}
                </button>
              )}
            </div>
            {saved.places.length > 0 ? (
              <div className={`chips${editing ? " editing" : ""}`}>
                {saved.places.map((p) =>
                  editing ? (
                    <button key={`${p.lat},${p.lon}`} type="button" className="chip removable" aria-label={`Remove ${p.name}`} onClick={() => saved.remove(p)}>
                      {p.name} <span aria-hidden="true">×</span>
                    </button>
                  ) : (
                    <button
                      key={`${p.lat},${p.lon}`}
                      type="button"
                      className="chip"
                      title={[p.region, p.tag].filter(Boolean).join(" · ")}
                      aria-pressed={!!place && samePlace(p, place)}
                      onClick={() => choose(p)}
                    >
                      {p.name}
                    </button>
                  ),
                )}
              </div>
            ) : (
              <p className="muted saved-empty">No saved places yet. Choose a place and press ☆ Save to keep it here and compare it in step 4.</p>
            )}
            <p className="muted saved-note">
              Saved in this browser. They are also compared side by side in step 4.
              {(editing || saved.places.length === 0) && (
                <>
                  {" "}
                  <button type="button" className="link" onClick={() => { saved.reset(); setEditing(false); }}>Restore the suggested list</button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="step-nav">
        <button type="button" onClick={onBack}>← Home</button>
      </div>
    </section>
  );
}

const LOOKUP_DELAY_MS = 400; // debounce: Nominatim allows at most one request per second

/**
 * Names points chosen on the map, by coordinates or by geolocation with their city/state
 * (reverse geocoding). Returns true while the lookup is pending.
 */
function usePlaceName(place: Place | null, setPlace: (p: Place) => void): boolean {
  const [lookingUp, setLookingUp] = useState(false);
  const latest = useRef(place);
  latest.current = place;

  const isMine = place?.name === MY_LOCATION;
  const unnamed = !!place && !place.tag && !place.region && (place.name === DEFAULT_PLACE_LABEL || isMine);

  useEffect(() => {
    if (!place || !unnamed) return;
    const asked = { lat: place.lat, lon: place.lon, name: place.name };
    const ctrl = new AbortController();
    setLookingUp(!isMine);
    const timer = setTimeout(() => {
      reverseGeocode(asked.lat, asked.lon, ctrl.signal)
        .then((r) => {
          const cur = latest.current;
          if (!r || !cur || !samePlace(cur, asked) || cur.name !== asked.name) return;
          // Keep “Your location” as the title and put the city in the subtitle.
          setPlace(isMine ? { ...cur, region: [r.name, r.region].filter(Boolean).join(", ") } : { ...cur, name: r.name, region: r.region });
        })
        .catch(() => {}) // offline or ocean: keep the generic label
        .finally(() => {
          if (!ctrl.signal.aborted) setLookingUp(false);
        });
    }, LOOKUP_DELAY_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
      setLookingUp(false);
    };
  }, [unnamed, isMine, place?.lat, place?.lon, setPlace]); // eslint-disable-line react-hooks/exhaustive-deps

  return lookingUp;
}

function GeolocationMessage({ status, onRetry }: { status: ReturnType<typeof useGeolocation>["status"]; onRetry(): void }) {
  if (status.kind === "idle") return null;
  if (status.kind === "asking") return <div className="muted geo-message" role="status">Your browser will ask whether to share your location.</div>;
  if (status.kind === "found") {
    return (
      <div className="muted geo-message" role="status">
        Found you (rounded to 0.1°, about 11 km).
      </div>
    );
  }
  return (
    <div className="geo-message error" role="status">
      {status.message}{" "}
      {status.canRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/** Lat/lon inputs that commit on change (blur/enter), like the original form. */
function CoordinateInputs({ lat, lon, onChange }: { lat?: number; lon?: number; onChange(lat: number, lon: number): void }) {
  const [draft, setDraft] = useState({ lat: String(lat ?? ""), lon: String(lon ?? "") });
  useEffect(() => setDraft({ lat: String(lat ?? ""), lon: String(lon ?? "") }), [lat, lon]);

  const commit = () => {
    const la = parseFloat(draft.lat);
    const lo = parseFloat(draft.lon);
    if (isFinite(la) && isFinite(lo)) onChange(la, lo);
  };

  return (
    <>
      {(["lat", "lon"] as const).map((k) => (
        <label key={k} className="field">
          {k === "lat" ? "Lat" : "Lon"}
          <input
            type="number"
            min={k === "lat" ? -90 : -180}
            max={k === "lat" ? 90 : 180}
            step={0.1}
            value={draft[k]}
            onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
          />
        </label>
      ))}
    </>
  );
}
