import type { Variable } from "../types";

export const WARM = "var(--warm)";
export const COOL = "var(--cool)";

/** Colour for an increase / a decrease of this variable. */
export const increaseColor = (v: Variable): string => (v.increase === "red" ? WARM : COOL);
export const decreaseColor = (v: Variable): string => (v.increase === "red" ? COOL : WARM);
export const directionColor = (v: Variable, value: number): string => (value >= 0 ? increaseColor(v) : decreaseColor(v));

/** +1 if an increase maps to the warm pole of the diverging scale, −1 otherwise. */
export const warmPoleSign = (v: Variable): 1 | -1 => (v.increase === "red" ? 1 : -1);

/** Diverging colour for t ∈ [−1, 1]: cold pole ← neutral → warm pole. Built from CSS tokens so it follows the colour scheme. */
export function divergingColor(t: number): string {
  const k = Math.round(Math.pow(Math.min(1, Math.abs(t)), 0.8) * 100);
  return `color-mix(in srgb, var(${t < 0 ? "--cool" : "--warm"}) ${k}%, var(--neutral))`;
}
