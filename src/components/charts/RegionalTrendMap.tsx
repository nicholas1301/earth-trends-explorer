import { useEffect, useMemo } from "react";
import { seasonById } from "../../config/catalog";
import { divergingColor, warmPoleSign } from "../../lib/colors";
import { formatCoord, formatNumber, formatPValue, formatSigned } from "../../lib/format";
import { publishCompare } from "../../lib/compareResults";
import { LAND_PATH } from "../../lib/geo";
import { fetchRegion, type BoundingBox, type GridCell } from "../../lib/powerApi";
import { clamp, mannKendall } from "../../lib/stats";
import { analyzeTrend, isSignificant, perDecade, type TrendOk } from "../../lib/trend";
import { useAsync } from "../../hooks/useAsync";
import { useInvestigation } from "../../state/InvestigationContext";
import { useTooltip } from "../../state/TooltipContext";
import type { Filters, Variable } from "../../types";
import { DivergingScale } from "../ui/DivergingScale";
import { ErrorMessage, Loading, Notice } from "../ui/Status";
import { TrendTooltip } from "../ui/TrendTooltip";

const HALF_SIZE = 5; // degrees around the point

function boxAround(lat: number, lon: number): BoundingBox {
  const latMin = clamp(Math.round(lat - HALF_SIZE), -90, 80);
  const lonMin = clamp(Math.round(lon - HALF_SIZE), -180, 170);
  return { latMin, latMax: latMin + 2 * HALF_SIZE, lonMin, lonMax: lonMin + 2 * HALF_SIZE };
}

interface AnalyzedCell extends GridCell {
  result: TrendOk;
}

/** Trend of every grid cell plus area statistics and an area-weighted mean series. */
function analyzeRegion(cells: GridCell[], filters: Filters) {
  const months = seasonById(filters.season).months;
  const analyzed: AnalyzedCell[] = [];
  const weighted = new Map<number, { sum: number; weight: number }>();
  let up = 0, down = 0, sigUp = 0, sigDown = 0;

  for (const c of cells) {
    const r = analyzeTrend(c.grid, filters.y0, filters.y1, months);
    if (!r.ok) continue;
    analyzed.push({ ...c, result: r });
    if (r.direction > 0) { up++; if (isSignificant(r)) sigUp++; }
    else if (r.direction < 0) { down++; if (isSignificant(r)) sigDown++; }
    const w = Math.cos((c.lat * Math.PI) / 180);
    r.years.forEach((year, i) => {
      const acc = weighted.get(year) ?? { sum: 0, weight: 0 };
      acc.sum += r.values[i] * w;
      acc.weight += w;
      weighted.set(year, acc);
    });
  }

  const years = [...weighted.keys()].sort((a, b) => a - b);
  const areaMean = years.length >= 8 ? mannKendall(years, years.map((y) => weighted.get(y)!.sum / weighted.get(y)!.weight)) : null;

  const lons = [...new Set(cells.map((c) => c.lon))].sort((a, b) => a - b);
  const lats = [...new Set(cells.map((c) => c.lat))].sort((a, b) => a - b);
  const dx = lons.length > 1 ? lons[1] - lons[0] : 1;
  const dy = lats.length > 1 ? lats[1] - lats[0] : 1;

  // Colour scale saturates at the 95th percentile so a few extreme cells don't wash out the map.
  const abs = analyzed.map((c) => Math.abs(perDecade(c.result))).sort((a, b) => a - b);
  const scaleMax = abs[Math.floor(abs.length * 0.95)] || abs[abs.length - 1] || 1;

  return { analyzed, n: analyzed.length, up, down, sigUp, sigDown, areaMean, lons, lats, dx, dy, scaleMax };
}

const formatDegrees = (x: number) => formatNumber(x, 3).replace(/0+$/, "").replace(/\.$/, "");

export function RegionalTrendMap({ variable: v }: { variable: Variable }) {
  const { state, actions } = useInvestigation();
  const tooltip = useTooltip();
  const place = state.investigation!.place;
  const box = boxAround(place.lat, place.lon);

  const { data: cells, error, loading, retry } = useAsync(() => fetchRegion(box, v.id), [v.id, box.latMin, box.lonMin]);
  const region = useMemo(() => (cells ? analyzeRegion(cells, state.filters) : null), [cells, state.filters]);
  const investigationId = state.investigation!.id;

  // Shared with the challenge card, which can ask about what the map shows.
  useEffect(() => {
    if (!region || loading) return;
    const { n, up, down, sigUp, sigDown, areaMean } = region;
    publishCompare("region", { investigationId, variable: v.id, filters: state.filters, n, up, down, sigUp, sigDown, areaMean: areaMean ? areaMean.sen * 10 : null });
  }, [region, loading, investigationId, v.id, state.filters]);
  useEffect(() => () => publishCompare("region", null), []);

  if (error) return <ErrorMessage onRetry={retry}>Could not download the grid ({error}).</ErrorMessage>;
  if (!region) {
    return (
      <Loading>
        Downloading the {v.name.toLowerCase()} grid ({formatCoord(box.latMin, box.lonMin)} to {formatCoord(box.latMax, box.lonMax)})… this may
        take a few seconds.
      </Loading>
    );
  }
  if (!region.n) return <Notice>Not enough data in this area for the chosen period.</Notice>;

  const { analyzed, n, up, down, sigUp, sigDown, areaMean, lons, lats, dx, dy, scaleMax } = region;
  const sign = warmPoleSign(v);
  const pct = (x: number) => formatNumber((x / n) * 100, 0) + "%";
  // Local equidistant scaling: shrink longitude by cos(latitude) so cells keep their true proportions.
  const kx = Math.max(0.08, Math.cos((((lats[0] + lats[lats.length - 1]) / 2) * Math.PI) / 180));
  const dotRadius = Math.min(dx * kx, dy) * 0.11;
  const viewBox = `${(lons[0] - dx / 2) * kx} ${-(lats[lats.length - 1] + dy / 2)} ${(lons[lons.length - 1] - lons[0] + dx) * kx} ${lats[lats.length - 1] - lats[0] + dy}`;

  return (
    <div className={`cols${loading ? " dimmed" : ""}`}>
      <div>
        <svg className="map" viewBox={viewBox} style={{ maxWidth: 640, maxHeight: "70vh", margin: "0 auto", background: "none" }} role="img" aria-label="Trend map around the point">
          <g transform={`scale(${kx} 1)`}>
            {analyzed.map((c) => (
              <rect
                key={`${c.lat},${c.lon}`}
                className="clickable"
                x={c.lon - dx / 2 + 0.02 / kx}
                y={-c.lat - dy / 2 + 0.02}
                width={dx - 0.04 / kx}
                height={dy - 0.04}
                fill={divergingColor(clamp((perDecade(c.result) / scaleMax) * sign, -1, 1))}
                onPointerMove={(e) => tooltip.show(e, <TrendTooltip title={formatCoord(c.lat, c.lon)} result={c.result} variable={v} />)}
                onPointerLeave={tooltip.hide}
                onClick={() => { tooltip.hide(); void actions.investigateAt(c.lat, c.lon); }}
              />
            ))}
            <path d={LAND_PATH} fill="none" fillRule="evenodd" stroke="var(--text)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" pointerEvents="none" opacity={0.7} />
          </g>
          {/* Drawn outside the scaled group so circles stay round. */}
          {analyzed.filter((c) => isSignificant(c.result)).map((c) => (
            <circle key={`s${c.lat},${c.lon}`} cx={c.lon * kx} cy={-c.lat} r={dotRadius} fill="var(--text)" opacity={0.85} pointerEvents="none" />
          ))}
          <circle cx={place.lon * kx} cy={-place.lat} r={0.28} fill="none" stroke="var(--text)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        </svg>
        <DivergingScale variable={v} max={scaleMax} />
      </div>
      <div>
        <h3>{v.name} · {state.filters.y0}–{state.filters.y1}</h3>
        <p>
          <b className="hl">{pct(up)}</b> of the area has an upward trend ({pct(sigUp)} significant) and <b className="hl">{pct(down)}</b> a
          downward trend ({pct(sigDown)} significant).
          {sigUp > 0 && sigDown > 0 && (
            <> <b className="hl">Opposite, significant signals coexist in this same region</b> — a good starting point for asking “why?”.</>
          )}
          {areaMean && <> Mean of the whole area: {formatSigned(areaMean.sen * 10, v.digits)} {v.unit}/decade ({formatPValue(areaMean.p)}).</>}
        </p>
        <p className="muted">
          Each square is a grid cell ({formatNumber(dy, dy % 1 ? 1 : 0)}° × {formatDegrees(dx)}°). The ring marks {place.name}; the thin
          lines are the coastline. Hover to see the values, click a cell to investigate it.
        </p>
      </div>
    </div>
  );
}
