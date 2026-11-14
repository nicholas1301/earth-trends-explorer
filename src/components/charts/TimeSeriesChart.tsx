import { useMemo, useState, type PointerEvent } from "react";
import { FIRST_YEAR, MONTHS } from "../../config/catalog";
import { formatNumber } from "../../lib/format";
import { formatTick, niceTicks } from "../../lib/ticks";
import type { TrendOk } from "../../lib/trend";
import { useElementWidth } from "../../hooks/useElementWidth";
import { useTooltip } from "../../state/TooltipContext";
import type { ChartView, MonthlyGrid, Variable } from "../../types";
import { LegendKey } from "../ui/Legend";

interface Props {
  variable: Variable;
  result: TrendOk;
  grid: MonthlyGrid;
  months: number[];
  y0: number;
  y1: number;
  view: ChartView;
  /** Name of the plotted series (e.g. “Annual mean”). */
  seriesLabel: string;
  /** Calendar year of grid row 0 (defaults to FIRST_YEAR). */
  origin?: number;
}

interface Point {
  x: number;
  y: number;
  label: string;
}

const MARGIN = { left: 52, right: 12, top: 12, bottom: 26 };

/** Builds the plotted points. Years are placed at mid-year (x + 0.5), months at mid-month. */
function buildPoints({ result: r, grid, months, y0, y1, view, origin = FIRST_YEAR }: Props): { points: Point[]; offset: number } {
  if (view === "annual") {
    return { points: r.years.map((x, i) => ({ x: x + 0.5, y: r.values[i], label: String(x) })), offset: 0 };
  }
  const points: Point[] = [];
  const sorted = [...months].sort((a, b) => a - b);
  for (let yr = y0; yr <= y1; yr++) {
    for (const m of sorted) {
      const val = grid[yr - origin]?.[m];
      if (val == null || r.climatology[m] == null) continue;
      points.push({ x: yr + (m + 0.5) / 12, y: view === "anomaly" ? val - r.climatology[m] : val, label: `${MONTHS[m]} ${yr}` });
    }
  }
  return { points, offset: view === "anomaly" ? r.base : 0 };
}

/** Annual / monthly / anomaly series with the regression line, its 95% band and Sen's slope. */
export function TimeSeriesChart(props: Props) {
  const { variable: v, result: r, months, y0, y1, view, seriesLabel } = props;
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const tooltip = useTooltip();
  const [hover, setHover] = useState<Point | null>(null);

  const { points, offset } = useMemo(() => buildPoints(props), [props.result, props.grid, props.months, props.y0, props.y1, props.view, props.origin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trend lines are fitted on annual means (x = year); shift by 0.5 to the plotted mid-year.
  const o = r.ols;
  const fit = (x: number) => o.intercept + o.slope * (x - 0.5) - offset;
  const sen = (x: number) => r.mk.senIntercept + r.mk.sen * (x - 0.5) - offset;
  const band = (x: number) => o.tCrit * o.residualSe * Math.sqrt(1 / o.n + (x - 0.5 - o.meanX) ** 2 / o.sxx);

  const W = Math.max(300, width);
  const H = W < 520 ? 250 : 330;
  const { left: L, right: R, top: T, bottom: B } = MARGIN;
  const xa = y0;
  const xb = y1 + 1;
  const tx0 = r.years[0] + 0.5;
  const tx1 = r.years[r.years.length - 1] + 0.5;

  let lo = Math.min(...points.map((p) => p.y), fit(tx0) - band(tx0), fit(tx1) - band(tx1));
  let hi = Math.max(...points.map((p) => p.y), fit(tx0) + band(tx0), fit(tx1) + band(tx1));
  const pad = (hi - lo || 1) * 0.06;
  lo -= pad;
  hi += pad;

  const X = (x: number) => L + ((x - xa) / (xb - xa)) * (W - L - R);
  const Y = (y: number) => T + ((hi - y) / (hi - lo)) * (H - T - B);
  const yTicks = niceTicks(lo, hi, 5);
  const xStep = xb - xa > 30 ? 10 : xb - xa > 12 ? 5 : 2;
  const xTicks: number[] = [];
  for (let yr = Math.ceil(xa / xStep) * xStep; yr <= y1; yr += xStep) xTicks.push(yr);

  // Confidence band polygon (upper edge forward, lower edge backward).
  const bandXs = Array.from({ length: 25 }, (_, i) => tx0 + ((tx1 - tx0) * i) / 24);
  const bandPath =
    "M" + bandXs.map((x) => `${X(x).toFixed(1)} ${Y(fit(x) + band(x)).toFixed(1)}`).join("L") +
    "L" + [...bandXs].reverse().map((x) => `${X(x).toFixed(1)} ${Y(fit(x) - band(x)).toFixed(1)}`).join("L") + "Z";

  // Series path, broken where data are missing.
  const maxGap = view === "annual" ? 1.01 : months.length === 12 ? 1.5 / 12 : 1.01;
  let seriesPath = "";
  points.forEach((p, i) => {
    const joined = i > 0 && p.x - points[i - 1].x <= maxGap + 1e-6;
    seriesPath += (joined ? "L" : "M") + `${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`;
  });

  const onPointerMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - box.left) * W) / box.width;
    let best = points[0];
    for (const p of points) if (Math.abs(X(p.x) - px) < Math.abs(X(best.x) - px)) best = p;
    setHover(best);
    tooltip.show(e, (
      <>
        <div className="tooltip-title">{best.label}</div>
        <LegendKey color="var(--s1)" /> <b>{formatNumber(best.y, v.digits)}</b> {v.unit} · {seriesLabel.toLowerCase()}
        <br />
        <LegendKey color="var(--s2)" /> <b>{formatNumber(fit(best.x), v.digits)}</b> {v.unit} · trend
      </>
    ));
  };

  const onPointerLeave = () => {
    setHover(null);
    tooltip.hide();
  };

  return (
    <div className="chart" ref={ref} id="chart">
      <svg viewBox={`0 0 ${W} ${H}`} height={H} role="img" aria-label={`${v.name} time series`}>
        {yTicks.values.map((t) => (
          <g key={t}>
            <line className="gridline" x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} />
            <text x={L - 6} y={Y(t) + 4} textAnchor="end">{formatTick(t, yTicks.step)}</text>
          </g>
        ))}
        {xTicks.map((yr) => (
          <g key={yr}>
            <line className="axis" x1={X(yr)} x2={X(yr)} y1={H - B} y2={H - B + 4} />
            <text x={X(yr)} y={H - 8} textAnchor="middle">{yr}</text>
          </g>
        ))}
        <line className="axis" x1={L} x2={W - R} y1={H - B} y2={H - B} />
        {view === "anomaly" && lo < 0 && hi > 0 && <line className="axis" x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} />}

        <path d={bandPath} fill="var(--s2)" opacity={0.14} />
        <path d={seriesPath} fill="none" stroke="var(--s1)" strokeWidth={view === "annual" ? 2 : 1.25} strokeLinejoin="round" />
        {view === "annual" &&
          points.map((p) => <circle key={p.x} cx={X(p.x)} cy={Y(p.y)} r={4} fill="var(--s1)" stroke="var(--card)" strokeWidth={2} />)}
        <line x1={X(tx0)} y1={Y(sen(tx0))} x2={X(tx1)} y2={Y(sen(tx1))} stroke="var(--s3)" strokeWidth={2} strokeDasharray="6 4" />
        <line x1={X(tx0)} y1={Y(fit(tx0))} x2={X(tx1)} y2={Y(fit(tx1))} stroke="var(--s2)" strokeWidth={2} />
        <text x={L} y={T - 2} style={{ fontSize: 10.5 }}>{v.unit}</text>

        {hover && (
          <>
            <line className="axis" x1={X(hover.x)} x2={X(hover.x)} y1={T} y2={H - B} />
            <circle cx={X(hover.x)} cy={Y(hover.y)} r={5} fill="var(--red)" stroke="var(--bg)" strokeWidth={1.5} />
          </>
        )}
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} />
      </svg>
    </div>
  );
}
