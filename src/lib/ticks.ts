import { formatNumber } from "./format";
import { clamp } from "./stats";

export interface Ticks {
  values: number[];
  step: number;
}

/** Round-numbered axis ticks (1, 2, 5 × 10ⁿ) covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count: number): Ticks {
  if (hi === lo) { hi = lo + 1; lo -= 1; }
  const raw = (hi - lo) / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
  const values: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) values.push(+v.toFixed(10));
  return { values, step };
}

export const formatTick = (v: number, step: number): string =>
  formatNumber(v, clamp(Math.ceil(-Math.log10(step) + 1e-9), 0, 4));

/** Linear scale mapping [d0, d1] → [r0, r1]. */
export const linearScale = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
