import type { Variable } from "../types";

export const WARM = "var(--warm)";
export const COOL = "var(--cool)";

/** Colour for an increase / a decrease of this variable. */
export const increaseColor = (v: Variable): string => (v.increase === "red" ? WARM : COOL);
export const decreaseColor = (v: Variable): string => (v.increase === "red" ? COOL : WARM);
export const directionColor = (v: Variable, value: number): string => (value >= 0 ? increaseColor(v) : decreaseColor(v));

/** +1 if an increase maps to the warm pole of the diverging scale, −1 otherwise. */
export const warmPoleSign = (v: Variable): 1 | -1 => (v.increase === "red" ? 1 : -1);

const NEUTRAL = [56, 56, 53];
const COLD_POLE = [57, 135, 229];
const WARM_POLE = [230, 103, 103];

/** Diverging colour for t ∈ [−1, 1]: cold pole ← neutral grey → warm pole. */
export function divergingColor(t: number): string {
  const k = Math.pow(Math.min(1, Math.abs(t)), 0.8);
  const target = t < 0 ? COLD_POLE : WARM_POLE;
  const rgb = NEUTRAL.map((c, i) => Math.round(c + (target[i] - c) * k));
  return `rgb(${rgb.join(",")})`;
}
