import type { TrendOk } from "../../lib/trend";

const W = 110;
const H = 26;

/** Thumbnail of the annual series with Sen's trend line. */
export function Sparkline({ result: r }: { result: TrendOk }) {
  const lo = Math.min(...r.values);
  const hi = Math.max(...r.values);
  const x0 = r.years[0];
  const x1 = r.years[r.years.length - 1];
  const X = (x: number) => 2 + ((x - x0) / Math.max(1, r.span)) * (W - 4);
  const Y = (y: number) => (hi === lo ? H / 2 : 3 + ((hi - y) / (hi - lo)) * (H - 6));
  const sen = (x: number) => r.mk.senIntercept + r.mk.sen * x;
  const points = r.years.map((x, i) => `${X(x).toFixed(1)},${Y(r.values[i]).toFixed(1)}`).join(" ");

  return (
    <svg width={W} height={H} aria-hidden="true">
      <polyline points={points} fill="none" stroke="var(--s1)" strokeWidth={1.25} />
      <line x1={X(x0)} y1={Y(sen(x0))} x2={X(x1)} y2={Y(sen(x1))} stroke="var(--s2)" strokeWidth={1.5} />
    </svg>
  );
}
