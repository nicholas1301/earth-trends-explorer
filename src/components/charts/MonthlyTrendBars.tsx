import { useMemo } from "react";
import { MONTHS } from "../../config/catalog";
import { decreaseColor, directionColor, increaseColor } from "../../lib/colors";
import { formatTick, niceTicks } from "../../lib/ticks";
import { analyzeTrend, isSignificant, perDecade } from "../../lib/trend";
import { useElementWidth } from "../../hooks/useElementWidth";
import { useTooltip } from "../../state/TooltipContext";
import type { MonthlyGrid, Variable } from "../../types";
import { Legend } from "../ui/Legend";
import { TrendTooltip } from "../ui/TrendTooltip";

const H = 170;
const MARGIN = { left: 52, right: 12, top: 10, bottom: 22 };

interface Props {
  variable: Variable;
  grid: MonthlyGrid;
  y0: number;
  y1: number;
  /** Calendar year of grid row 0 (defaults to the NASA POWER first year). */
  origin?: number;
}

/** Sen's slope per decade computed separately for each calendar month. Filled bars are significant. */
export function MonthlyTrendBars({ variable: v, grid, y0, y1, origin }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const tooltip = useTooltip();
  const results = useMemo(() => MONTHS.map((_, m) => analyzeTrend(grid, y0, y1, [m], origin)), [grid, y0, y1, origin]);
  const values = results.map((r) => (r.ok ? perDecade(r) : 0));

  const W = Math.max(300, width);
  const { left: L, right: R, top: T, bottom: B } = MARGIN;
  const dataLo = Math.min(0, ...values) * 1.1;
  const dataHi = Math.max(0, ...values) * 1.1;
  const ticks = niceTicks(dataLo, dataHi, 4);
  const maxAbs = Math.max(...values.map(Math.abs)) || 1;
  const lo = Math.min(ticks.values[0], dataLo);
  const hi = Math.max(ticks.values[ticks.values.length - 1], dataHi) || maxAbs;
  const Y = (y: number) => T + ((hi - y) / (hi - lo || 1)) * (H - T - B);
  const slot = (W - L - R) / 12;

  return (
    <>
      <Legend
        items={[
          { shape: "box", color: increaseColor(v), label: "Significant increase" },
          { shape: "box", color: decreaseColor(v), label: "Significant decrease" },
          { shape: "hollow", color: "var(--muted)", label: "Hollow bar: not significant (p ≥ 0.05)" },
        ]}
      />
      <div className="chart" ref={ref} id="mbars">
        <svg viewBox={`0 0 ${W} ${H}`} height={H} role="img" aria-label="Trend by month">
          {ticks.values.map((t) => (
            <g key={t}>
              <line className="gridline" x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} />
              <text x={L - 6} y={Y(t) + 4} textAnchor="end">{formatTick(t, ticks.step)}</text>
            </g>
          ))}
          {results.map((r, m) => {
            const cx = L + (m + 0.5) * slot;
            const barW = Math.min(slot - 2, 46);
            const color = directionColor(v, values[m]);
            return (
              <g key={m}>
                {r.ok && (
                  <rect
                    x={cx - barW / 2}
                    y={Y(Math.max(0, values[m]))}
                    width={barW}
                    height={Math.max(1, Math.abs(Y(values[m]) - Y(0)))}
                    rx={2}
                    fill={isSignificant(r) ? color : "transparent"}
                    stroke={color}
                    strokeWidth={1.5}
                  />
                )}
                <text x={cx} y={H - 6} textAnchor="middle">{MONTHS[m]}</text>
                <rect
                  x={L + m * slot + 1}
                  y={T}
                  width={slot - 2}
                  height={H - T - B}
                  fill="transparent"
                  onPointerMove={(e) => tooltip.show(e, <TrendTooltip title={MONTHS[m]} result={r} variable={v} />)}
                  onPointerLeave={tooltip.hide}
                />
              </g>
            );
          })}
          <line className="axis" x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} />
        </svg>
      </div>
    </>
  );
}
