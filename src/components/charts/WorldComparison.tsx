import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { seasonById } from "../../config/catalog";
import { directionColor, divergingColor, warmPoleSign } from "../../lib/colors";
import { publishCompare } from "../../lib/compareResults";
import { formatSigned } from "../../lib/format";
import { loadExtras, placesWithExtras } from "../../lib/extras";
import { samePlace } from "../../lib/places";
import { fetchPoint } from "../../lib/powerApi";
import { clamp } from "../../lib/stats";
import { analyzeTrend, isSignificant, perDecade, type TrendOk } from "../../lib/trend";
import { useAsync } from "../../hooks/useAsync";
import { useSavedPlaces } from "../../hooks/useSavedPlaces";
import { useInvestigation } from "../../state/InvestigationContext";
import { useTooltip } from "../../state/TooltipContext";
import type { MonthlyGrid, Variable } from "../../types";
import { DivergingScale } from "../ui/DivergingScale";
import { GeoMap, type MapMarker } from "./GeoMap";
import { ErrorMessage, Loading } from "../ui/Status";
import { TrendTooltip } from "../ui/TrendTooltip";
import "./WorldComparison.css";

const CONCURRENCY = 4;
/** Map dots get extra contrast; the scale legend is divided by the same factor. */
const MAP_BOOST = 1.4;

interface ComparisonPlace {
  name: string;
  tag: string;
  lat: number;
  lon: number;
  /** The investigated place. */
  isCurrent: boolean;
  grid: MonthlyGrid | null;
}

/** Downloads one variable for many places with a small worker pool, reporting progress. Extra records are read from the
 * files stored for the featured places instead of NASA POWER. */
async function loadPlaces(places: ComparisonPlace[], v: Variable, onProgress: (done: number) => void) {
  const queue = places.filter((p) => !p.grid);
  let done = places.length - queue.length;
  onProgress(done);
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      try {
        p.grid = v.extra ? (await loadExtras(p.lat, p.lon))?.data[v.id] ?? null : (await fetchPoint(p.lat, p.lon, [v.id]))[v.id];
      } catch {
        p.grid = null;
      }
      onProgress(++done);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return places;
}

export function WorldComparison({ variable: v }: { variable: Variable }) {
  const { state, actions } = useInvestigation();
  const tooltip = useTooltip();
  const investigation = state.investigation!;
  const current = investigation.place;
  const [progress, setProgress] = useState(0);
  const saved = useSavedPlaces();
  const savedKey = saved.places.map((p) => `${p.lat},${p.lon}`).join(";");

  // Extra records exist only at the featured places, so those are the comparison; otherwise, the saved places.
  const sources = v.extra ? placesWithExtras() : saved.places;
  const initialPlaces = (): ComparisonPlace[] => {
    const list: ComparisonPlace[] = sources.map((p) => ({ name: p.name, tag: p.tag ?? "", lat: p.lat, lon: p.lon, isCurrent: samePlace(p, current), grid: null }));
    if (!list.some((p) => p.isCurrent)) list.push({ name: current.name, tag: current.tag ?? "", lat: current.lat, lon: current.lon, isCurrent: true, grid: null });
    for (const p of list) if (p.isCurrent) p.grid = investigation.data[v.id];
    return list;
  };

  const total = sources.length + (sources.some((p) => samePlace(p, current)) ? 0 : 1);
  const { data: places, retry } = useAsync(() => loadPlaces(initialPlaces(), v, setProgress), [v.id, investigation.id, savedKey]);

  const comparison = useMemo(() => {
    if (!places) return null;
    const months = seasonById(state.filters.season).months;
    const ok: Array<ComparisonPlace & { result: TrendOk }> = [];
    const missing: ComparisonPlace[] = [];
    for (const p of places) {
      const result = p.grid ? analyzeTrend(p.grid, state.filters.y0, state.filters.y1, months) : null;
      if (result?.ok) ok.push({ ...p, result });
      else missing.push(p);
    }
    ok.sort((a, b) => b.result.mk.sen - a.result.mk.sen);
    const max = Math.max(...ok.map((p) => Math.abs(perDecade(p.result)))) || 1;
    return { ok, missing, max };
  }, [places, state.filters]);

  // Shared with the challenge card, which can ask about the ranking.
  useEffect(() => {
    if (!comparison) return;
    publishCompare("world", {
      investigationId: investigation.id,
      variable: v.id,
      filters: state.filters,
      places: comparison.ok.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon, perDecade: perDecade(p.result), significant: isSignificant(p.result), isCurrent: p.isCurrent })),
    });
  }, [comparison, investigation.id, v.id, state.filters]);
  useEffect(() => () => publishCompare("world", null), []);

  if (!comparison) return <Loading>Querying {progress} of {total} places…</Loading>;

  const { ok, missing, max } = comparison;
  const savePrompt = !saved.has(current) && !saved.isFull && (
    <button type="button" className="link" onClick={() => saved.add(current)}>☆ Save {current.name}</button>
  );
  if (!v.extra && (saved.places.length === 0 || (saved.places.length === 1 && saved.has(current)))) {
    return (
      <p className="muted">
        There is nothing to compare with yet: your saved places list {saved.places.length ? "only has this place" : "is empty"}. Add places with ☆ Save on
        step 1 (Place), and they will show up here. {savePrompt}
      </p>
    );
  }
  if (!ok.length) return <ErrorMessage onRetry={retry}>Could not get data for comparison.</ErrorMessage>;

  const sign = warmPoleSign(v);
  const rising = ok.filter((p) => p.result.direction > 0 && isSignificant(p.result));
  const falling = ok.filter((p) => p.result.direction < 0 && isSignificant(p.result));
  const names = (list: typeof ok) => list.slice(0, 4).map((p) => p.name).join(", ") + (list.length > 4 ? "…" : "");

  const hoverHandlers = (p: (typeof ok)[number]) => ({
    onPointerMove: (e: PointerEvent) =>
      tooltip.show(e, <TrendTooltip title={p.name + (p.tag ? ` — ${p.tag}` : "")} result={p.result} variable={v} />),
    onPointerLeave: tooltip.hide,
    onClick: () => { tooltip.hide(); void actions.investigateAt(p.lat, p.lon); },
  });

  const markers: MapMarker[] = ok.map((p) => {
    const significant = isSignificant(p.result);
    return {
      key: `${p.lat},${p.lon}`,
      lat: p.lat,
      lon: p.lon,
      ...hoverHandlers(p),
      content: (
        <>
          <circle
            r={significant ? 9 : 7}
            fill={divergingColor(clamp((perDecade(p.result) / max) * sign * MAP_BOOST, -1, 1))}
            stroke={p.isCurrent ? "var(--text)" : "var(--bg)"}
            strokeWidth={p.isCurrent ? 2.5 : 1.3}
          />
          {significant && <circle r={2.4} fill="var(--text)" pointerEvents="none" />}
        </>
      ),
    };
  });

  return (
    <>
      <div className="cols">
        <div>
          <GeoMap
            label="World map with the trends of each place"
            initialMode="flat"
            initialCenter={current}
            home={current}
            markers={markers}
          />
          <DivergingScale variable={v} max={max / MAP_BOOST} />
        </div>
        <div>
          <h3>{v.name} · {v.unit} per decade · {state.filters.y0}–{state.filters.y1}</h3>
          <div className="comparison-bars">
            {ok.map((p) => {
              const value = perDecade(p.result);
              const width = (Math.abs(value) / max) * 50;
              const color = directionColor(v, value);
              const significant = isSignificant(p.result);
              return (
                <div key={`${p.lat},${p.lon}`} className={`bar-row clickable${p.isCurrent ? " current" : ""}`} {...hoverHandlers(p)}>
                  <span className="bar-name">{p.isCurrent && "➤ "}{p.name}</span>
                  <span className="bar-track">
                    <div
                      style={{
                        left: `${value >= 0 ? 50 : 50 - width}%`,
                        width: `${Math.max(width, 0.6)}%`,
                        ...(significant ? { background: color } : { border: `1.5px solid ${color}` }),
                      }}
                    />
                  </span>
                  <span className="bar-value">{formatSigned(value, v.digits)}{significant && " ●"}</span>
                </div>
              );
            })}
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Filled bar and ● = significant (p &lt; 0.05); hollow bar = not significant. Click a place to investigate it.
          </p>
          <p className="muted" style={{ marginTop: 4 }}>
            {v.extra
              ? "These are the featured places: the only ones where this record is stored."
              : <>These are your saved places; edit the list on step 1 (Place). {savePrompt}</>}
          </p>
        </div>
      </div>
      <p style={{ marginTop: 10 }}>
        Of the {ok.length} places, <b className="hl">{rising.length}</b> show a significant increase{rising.length > 0 && ` (${names(rising)})`} and{" "}
        <b className="hl">{falling.length}</b> show a significant decrease{falling.length > 0 && ` (${names(falling)})`}.
        {rising.length > 0 && falling.length > 0 && " The same variable moves in opposite directions in different places."}
        {missing.length > 0 && <span className="muted"> Not enough data: {missing.map((p) => p.name).join(", ")}.</span>}
      </p>
    </>
  );
}
