import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRESETS } from "../../config/catalog";
import { formatCoord } from "../../lib/format";
import { isLand } from "../../lib/geo";
import type { LatLon } from "../../lib/mapView";
import { makePlace, placeFromPreset, samePlace } from "../../lib/places";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useInvestigation } from "../../state/InvestigationContext";
import type { Place } from "../../types";
import { GeoMap, type MapMarker } from "../charts/GeoMap";
import { SectionHeading } from "../ui/SectionHeading";
import "./PlacePicker.css";

const MY_LOCATION = "Your location";

interface Props {
  /** Called after a successful investigation started from the “Investigate” button. */
  onInvestigated(): void;
}

/** Step 2: choose a place on the globe, from the presets, by coordinates or with the browser location. */
export function PlacePicker({ onInvestigated }: Props) {
  const { state, actions } = useInvestigation();
  const { place } = state;

  // The globe flies to the chosen place, except when the user picked it on the globe itself.
  const pickedOnMap = useRef(false);
  const [flyTo, setFlyTo] = useState<(LatLon & { key: number }) | null>(null);
  useEffect(() => {
    if (pickedOnMap.current) pickedOnMap.current = false;
    else setFlyTo((f) => ({ lat: place.lat, lon: place.lon, key: (f?.key ?? 0) + 1 }));
  }, [place]);

  const choose = useCallback((p: Place) => actions.setPlace(p), [actions]);
  const geo = useGeolocation(useCallback((lat, lon) => choose(makePlace(lat, lon, undefined, MY_LOCATION)), [choose]));

  // Any other choice clears the location message.
  useEffect(() => {
    if (place.name !== MY_LOCATION) geo.reset();
  }, [place, geo.reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const markers = useMemo<MapMarker[]>(
    () => [
      ...PRESETS.map((p) => ({
        key: p.name,
        lat: p.lat,
        lon: p.lon,
        onClick: () => choose(placeFromPreset(p)),
        content: (
          <circle className="preset-dot" r={4.5}>
            <title>{`${p.name} — ${p.tag}`}</title>
          </circle>
        ),
      })),
      {
        key: "selected",
        lat: place.lat,
        lon: place.lon,
        content: (
          <g pointerEvents="none">
            <circle r={11} fill="rgba(127,168,204,.18)" stroke="#fff" strokeWidth={1.8} />
            <circle r={3} fill="#fff" />
          </g>
        ),
      },
    ],
    [place, choose],
  );

  const investigate = async () => {
    if (await actions.investigate()) onInvestigated();
  };

  const description = formatCoord(place.lat, place.lon) + " — " + (place.tag ?? (isLand(place.lat, place.lon) ? "land" : "ocean"));

  return (
    <section className="card" id="q-place">
      <SectionHeading step={2} title="Where?" aside="spin the globe, click a spot or pick a place" />

      <GeoMap
        label="World map for choosing the location"
        initialMode="globe"
        markers={markers}
        flyTo={flyTo}
        home={place}
        onPick={(g) => {
          pickedOnMap.current = true;
          choose(makePlace(g.lat, g.lon));
        }}
      />

      <div className="chips" style={{ marginTop: 10 }}>
        {PRESETS.map((p) => (
          <button key={p.name} type="button" className="chip" aria-pressed={samePlace(p, place) && place.name === p.name} onClick={() => choose(placeFromPreset(p))}>
            {p.name}
            <small>{p.tag}</small>
          </button>
        ))}
      </div>

      <div className="place-now">
        <div className="row spread">
          <div>
            <b>
              {place.name}
              {place.region && ` · ${place.region}`}
            </b>
            <div className="muted">{description}</div>
            <GeolocationMessage status={geo.status} onRetry={geo.locate} />
          </div>
          <div className="row">
            <button
              type="button"
              disabled={geo.status.kind === "asking"}
              onClick={geo.locate}
              title="Your browser will ask for permission first. The position is rounded to 0.1° (about 11 km) and is only used to query NASA data."
            >
              {geo.status.kind === "asking" ? "📍 Locating…" : "📍 Use my location"}
            </button>
            <CoordinateInputs lat={place.lat} lon={place.lon} onChange={(lat, lon) => choose(makePlace(lat, lon))} />
            <button type="button" className="primary" disabled={state.loading} onClick={investigate}>
              Investigate 🔍
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function GeolocationMessage({ status, onRetry }: { status: ReturnType<typeof useGeolocation>["status"]; onRetry(): void }) {
  if (status.kind === "idle") return null;
  if (status.kind === "asking") return <div className="muted geo-message" role="status">Your browser will ask whether to share your location.</div>;
  if (status.kind === "found") {
    return (
      <div className="muted geo-message" role="status">
        Found you (rounded to 0.1°, about 11 km). Press <b className="hl">Investigate</b> to see the trends here.
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
function CoordinateInputs({ lat, lon, onChange }: { lat: number; lon: number; onChange(lat: number, lon: number): void }) {
  const [draft, setDraft] = useState({ lat: String(lat), lon: String(lon) });
  useEffect(() => setDraft({ lat: String(lat), lon: String(lon) }), [lat, lon]);

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
