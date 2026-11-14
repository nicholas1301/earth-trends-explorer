import { seasonById } from "../config/catalog";
import type { Filters, Place, Variable } from "../types";
import type { TrendOk } from "./trend";

/** CSV with the annual series, the regression line and Sen's line, plus a commented header. */
export function trendCsv(v: Variable, r: TrendOk, place: Place, filters: Filters, source = `NASA POWER (${v.source})`): string {
  const where = Number.isFinite(place.lat) ? `${place.name} (lat ${place.lat}, lon ${place.lon})` : place.name;
  const meta = [
    `# ${v.name} - ${where} - ${seasonById(filters.season).name}`,
    `# Source: ${source}`,
    `# Sen: ${(r.mk.sen * 10).toFixed(5)} ${v.unit}/decade; Mann-Kendall Z=${r.mk.Z.toFixed(3)} p=${r.mk.p.toFixed(5)}; ` +
      `OLS: ${(r.ols.slope * 10).toFixed(5)}/decade, CI95 [${(r.ols.lo * 10).toFixed(5)}, ${(r.ols.hi * 10).toFixed(5)}], p=${r.ols.p.toFixed(5)}`,
  ];
  const rows = [
    ["year", `${v.id} (${v.unit})`, "regression_line", "sen_line"],
    ...r.years.map((x, i) => [
      x,
      r.values[i].toFixed(4),
      (r.ols.intercept + r.ols.slope * x).toFixed(4),
      (r.mk.senIntercept + r.mk.sen * x).toFixed(4),
    ]),
  ];
  return meta.join("\n") + "\n" + rows.map((row) => row.join(",")).join("\n");
}

export function downloadText(content: string, filename: string, type = "text/csv"): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
