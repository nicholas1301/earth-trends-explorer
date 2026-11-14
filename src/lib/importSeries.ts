// Parser for time-series files exported by other Earth-data tools, so they can go through the same trend analysis.
//
// Supported shapes (detected, not configured):
// - NASA Giovanni "Time Series, Area-Averaged" CSV: metadata lines, then `time,mean_<variable>` rows.
// - NASA AppEEARS point-sample CSV: ID, Latitude, Longitude, Date, MODIS_Tile, <layer columns>…
// - NOAA Climate Data Online CSV: "STATION","NAME","DATE",<element columns>… (daily or monthly summaries).
// - KNMI Climate Explorer text: `#` comments, then either `year v1 … v12` rows or `yyyymmdd value` rows.
// - GES DISC Hydrology Data Rods ASCII (legacy): `key=value` header, then `date value` rows.
// - Any CSV / TSV / whitespace table with one date column (or year + month columns) and numeric columns.

import type { MonthlyGrid } from "../types";

export type SourceKind = "giovanni" | "appeears" | "cdo" | "knmi" | "datarods" | "generic";

export const SOURCE_LABELS: Record<SourceKind, string> = {
  giovanni: "NASA Giovanni",
  appeears: "NASA AppEEARS",
  cdo: "NOAA Climate Data Online",
  knmi: "KNMI Climate Explorer",
  datarods: "GES DISC Hydrology Data Rods",
  generic: "Imported file",
};

interface DateParts {
  year: number;
  month: number; // 0–11
}

export interface ParsedRow {
  date: DateParts;
  values: Array<number | null>;
  group: string | null;
}

export interface ParsedTable {
  source: SourceKind;
  /** Names of the numeric columns, aligned with ParsedRow.values. */
  columns: string[];
  /** Index (into `columns`) of the column most likely to be the variable of interest. */
  defaultColumn: number;
  rows: ParsedRow[];
  /** Name of the column used to split rows into series (e.g. STATION), if the file holds several. */
  groupColumn: string | null;
  groups: string[];
  /** Missing-value codes declared in the file (e.g. Giovanni's "Fill Value"). */
  fillValues: number[];
  /** Best-effort descriptions taken from the metadata. */
  title: string | null;
  unit: string | null;
  region: string | null;
  /** True when several observations fall in the same month (daily, 8-day, 16-day data…). */
  subMonthly: boolean;
}

export interface MonthlySeries {
  grid: MonthlyGrid;
  /** Calendar year of grid row 0. */
  origin: number;
  firstYear: number;
  lastYear: number;
  /** Number of months with a value. */
  months: number;
}

export class ImportError extends Error {}

const MIN_YEAR = 1800;
const MAX_YEAR = 2100;
const validYear = (y: number) => y >= MIN_YEAR && y <= MAX_YEAR;
/** Typical missing-value codes (−999, −9999, −9999.9…) and netCDF's default fill (9.97e36). */
const isConventionalFill = (x: number) => x <= -999 || Math.abs(x) >= 1e30;

// ---------- Tokenising ----------

/** Splits one CSV line, honouring double quotes ("a,b" stays one field). */
function splitCsv(line: string, sep: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === sep && !quoted) {
      out.push(field.trim());
      field = "";
    } else field += c;
  }
  out.push(field.trim());
  return out;
}

function splitLine(line: string): string[] {
  if (line.includes(",")) return splitCsv(line, ",");
  if (line.includes("\t")) return splitCsv(line, "\t");
  if (line.includes(";")) return splitCsv(line, ";");
  return line.trim().split(/\s+/);
}

function parseNumber(token: string | undefined): number | null {
  if (token == null) return null;
  const t = token.trim();
  if (!t || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}

/** Dates as written by the supported tools. Month is required; day and time are ignored. */
export function parseDate(token: string | undefined): DateParts | null {
  if (!token) return null;
  const t = token.trim();
  let m = /^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?(?:[T ].*)?Z?$/.exec(t); // 2001-01, 2001-01-31, 2001-01-01T00:00:00Z
  if (!m) m = /^(\d{4})(\d{2})(?:\d{2})?$/.exec(t); // 200101, 20010131
  if (!m) return null;
  const year = +m[1];
  const month = +m[2] - 1;
  return validYear(year) && month >= 0 && month <= 11 ? { year, month } : null;
}

// ---------- Metadata ----------

interface Meta {
  title: string | null;
  unit: string | null;
  region: string | null;
  fillValues: number[];
}

function readMeta(lines: string[]): Meta {
  const meta: Meta = { title: null, unit: null, region: null, fillValues: [] };
  for (const raw of lines) {
    const line = raw.replace(/^#\s*/, "").trim();
    const fill = /fill\s*value[^:=,]*[:=,\s]+"?\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/i.exec(line);
    if (fill) meta.fillValues.push(Number(fill[1]));
    const missing = /(?:missing|undefined)[ _-]?(?:value|data)?\s*[:=]\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/i.exec(line);
    if (missing) meta.fillValues.push(Number(missing[1]));

    // Giovanni CSV: "Title:,"Time Series, Area-Averaged of <name> (monthly)"" — the CSV carries no unit.
    // The plot title has more: "… of <name> monthly 0.1 deg. [GPM GPM_3IMERGM v07] mm/hr over …, Region 60.5W, 3.6S, 59.5W, 2.6S".
    const title = /^"?title"?\s*:?\s*,?\s*(.+)$/i.exec(line);
    if (title && !meta.title) {
      const text = title[1].replace(/"/g, "");
      const of = /Area-Averaged of (.+?)(?: \(?(?:monthly|daily|hourly|half-hourly|3-hourly|8-day)\b| \[|$)/i.exec(text);
      meta.title = (of ? of[1] : text).trim();
      const unit = /\]\s*([^\s].*?)\s+over\s/i.exec(text);
      if (unit) meta.unit = unit[1].trim();
      const region = /Region\s+(.+)$/i.exec(text);
      if (region) meta.region = region[1].trim();
    }
    // Giovanni CSV: "User Bounding Box:,"-60.5,-3.6,-59.5,-2.6"" (west, south, east, north).
    const box = /^"?(?:user )?bounding box"?\s*:?\s*,\s*"?\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/i.exec(line);
    if (box && !meta.region) {
      const [w, s, e, n] = box.slice(1).map(Number);
      const lon = (x: number) => `${Math.abs(x)}°${x < 0 ? "W" : "E"}`;
      const lat = (y: number) => `${Math.abs(y)}°${y < 0 ? "S" : "N"}`;
      meta.region = `${lat(s)}–${lat(n)}, ${lon(w)}–${lon(e)}`;
    }
    // Data Rods: "unit=kg/m^2", "param_short_name=SoilMoi0_10cm_inst", "location=GEOM:POINT(-60, -3)"
    const kv = /^(unit|units|param_short_name|param_name|location)\s*=\s*(.+)$/i.exec(line);
    if (kv) {
      const key = kv[1].toLowerCase();
      if (key.startsWith("unit")) meta.unit ??= kv[2].trim();
      else if (key === "location") meta.region ??= kv[2].trim();
      else meta.title ??= kv[2].trim();
    }
    // KNMI: "# Tmean [Celsius] mean temperature" or "# prcp [mm/day] precipitation"
    const knmi = /^(\w[\w.-]*)\s+\[([^\]]+)\]\s*(.*)$/.exec(line);
    if (knmi && raw.trimStart().startsWith("#") && !meta.unit) {
      meta.unit = knmi[2].trim();
      meta.title ??= knmi[3].trim() || knmi[1];
    }
  }
  return meta;
}

function detectSource(text: string, header: string[]): SourceKind {
  const h = header.map((c) => c.toUpperCase());
  if (/giovanni|area-averaged/i.test(text)) return "giovanni";
  if (h.includes("MODIS_TILE") || (h.includes("LATITUDE") && h.includes("LONGITUDE") && h.includes("DATE") && h.includes("CATEGORY"))) return "appeears";
  if (h.includes("STATION") && h.includes("DATE")) return "cdo";
  if (/climexp|KNMI|climate explorer/i.test(text)) return "knmi";
  if (/param_short_name|hydro1\.gesdisc|data ?rods/i.test(text)) return "datarods";
  return "generic";
}

/** Unit written in the column name, e.g. "Precip (mm/day)" or "SoilMoi0_10cm_inst [kg m-2]". */
const unitFromName = (name: string): string | null => /[([]\s*([^()[\]]+?)\s*[)\]]\s*$/.exec(name)?.[1] ?? null;

const NOT_A_VARIABLE = /^(lat|latitude|lon|longitude|elevation|elev|id|year|month|day|doy|hour)$|qa|quality|reliab|tile|_line_|_sample_|flag|attributes/i;
const GROUP_NAMES = /^(station|name|id|category|site|location|point)$/i;

// ---------- Main entry ----------

export function parseTable(text: string): ParsedTable {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const meta = readMeta(lines.filter((l) => !isDataLike(l)));

  // KNMI-style wide table: `year v1 … v12` (13 numbers, first is a year).
  const wide = parseWideTable(lines, meta, text);
  if (wide) return wide;

  // Tokenise every non-comment line and find the date column(s).
  const tokenised = lines
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map(splitLine);
  const layout = findDateLayout(tokenised);
  if (!layout) {
    throw new ImportError(
      "No dates were found. The file needs one column with dates such as 2001-01, 2001-01-31 or 20010131 (or a year and a month column).",
    );
  }

  const firstData = tokenised.findIndex((f) => layout.read(f) != null);
  const width = tokenised[firstData].length;
  const headerRow = [...tokenised.slice(0, firstData)].reverse().find((f) => f.length === width && layout.read(f) == null);
  const header = Array.from({ length: width }, (_, i) => headerRow?.[i]?.trim() || `Column ${i + 1}`);
  const dataRows = tokenised.filter((f) => f.length >= width - 1 && layout.read(f) != null);

  // Numeric columns: at least half of the data rows parse as numbers.
  const candidates = header.map((_, i) => i).filter((i) => !layout.columns.includes(i));
  const numeric = candidates.filter((i) => dataRows.filter((f) => parseNumber(f[i]) != null).length >= dataRows.length / 2);
  if (!numeric.length) throw new ImportError("Dates were found, but no column with numeric values.");

  // A text column such as STATION splits the file into several series.
  let groupIndex: number | null = null;
  for (const i of candidates) {
    if (!GROUP_NAMES.test(header[i])) continue;
    const distinct = new Set(dataRows.map((f) => f[i]));
    if (distinct.size > 1 && distinct.size <= 500) { groupIndex = i; break; }
  }
  const valueColumns = numeric.filter((i) => i !== groupIndex);
  if (!valueColumns.length) throw new ImportError("Dates were found, but no column with numeric values.");

  const rows: ParsedRow[] = dataRows.map((f) => ({
    date: layout.read(f)!,
    values: valueColumns.map((i) => parseNumber(f[i])),
    group: groupIndex != null ? f[groupIndex] : null,
  }));

  const columns = valueColumns.map((i) => header[i]);
  const preferred = columns.findIndex((c) => /^mean_/i.test(c));
  const firstVariable = columns.findIndex((c) => !NOT_A_VARIABLE.test(c));
  const defaultColumn = preferred >= 0 ? preferred : firstVariable >= 0 ? firstVariable : 0;
  const groups = groupIndex != null ? [...new Set(rows.map((r) => r.group!))] : [];

  return {
    source: detectSource(text, header),
    columns,
    defaultColumn,
    rows,
    groupColumn: groupIndex != null ? header[groupIndex] : null,
    groups,
    fillValues: meta.fillValues,
    title: meta.title,
    unit: meta.unit ?? unitFromName(columns[defaultColumn]),
    region: meta.region,
    subMonthly: hasSubMonthly(rows),
  };
}

function isDataLike(line: string): boolean {
  const f = splitLine(line.trim());
  return f.some((t) => parseDate(t) != null) && f.some((t, i) => i > 0 && parseNumber(t) != null);
}

interface DateLayout {
  columns: number[];
  read(fields: string[]): DateParts | null;
}

/** Finds a date column (or a year + month pair) that parses in most rows. */
function findDateLayout(rows: string[][]): DateLayout | null {
  const sample = rows.slice(0, 400);
  const maxWidth = Math.max(0, ...sample.map((r) => r.length));
  const threshold = (n: number) => n >= 3 && n >= sample.length * 0.3;

  for (let c = 0; c < maxWidth; c++) {
    const hits = sample.filter((r) => parseDate(r[c]) != null).length;
    if (threshold(hits)) return { columns: [c], read: (f) => parseDate(f[c]) };
  }
  // Separate year and month columns ("1981 1 25.3" or YEAR,MONTH,VALUE).
  const yearMonth = (f: string[]): DateParts | null => {
    const y = parseNumber(f[0]);
    const m = parseNumber(f[1]);
    if (y == null || m == null || !Number.isInteger(y) || !Number.isInteger(m) || !validYear(y) || m < 1 || m > 12) return null;
    return f.length >= 3 ? { year: y, month: m - 1 } : null;
  };
  if (threshold(sample.filter((r) => yearMonth(r) != null).length)) return { columns: [0, 1], read: yearMonth };
  return null;
}

function hasSubMonthly(rows: ParsedRow[]): boolean {
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.group}|${r.date.year}-${r.date.month}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function parseWideTable(lines: string[], meta: Meta, text: string): ParsedTable | null {
  const rows: ParsedRow[] = [];
  let candidates = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    candidates++;
    const f = splitLine(line);
    if (f.length !== 13) continue;
    const nums = f.map(parseNumber);
    const year = nums[0];
    if (year == null || !Number.isInteger(year) || !validYear(year) || nums.slice(1).every((x) => x == null)) continue;
    for (let m = 0; m < 12; m++) rows.push({ date: { year, month: m }, values: [nums[m + 1]], group: null });
  }
  if (rows.length < 36 || rows.length / 12 < candidates * 0.6) return null;
  return {
    source: detectSource(text, []) === "generic" ? "knmi" : detectSource(text, []),
    columns: [meta.title ?? "Value"],
    defaultColumn: 0,
    rows,
    groupColumn: null,
    groups: [],
    fillValues: meta.fillValues,
    title: meta.title,
    unit: meta.unit,
    region: meta.region,
    subMonthly: false,
  };
}

// ---------- To a monthly grid ----------

export interface GridOptions {
  column: number;
  group?: string | null;
  /** Extra codes to treat as missing, on top of the conventional ones. */
  missing?: number[];
}

/**
 * Averages all observations of each calendar month. With sub-monthly data, months with fewer than half the typical
 * number of observations are left empty, so a single day cannot stand for a whole month.
 */
export function toMonthlyGrid(table: ParsedTable, { column, group = null, missing = [] }: GridOptions): MonthlySeries {
  const sums = new Map<number, { sum: number; count: number }>();
  const skip = new Set([...table.fillValues, ...missing]);
  for (const row of table.rows) {
    if (group != null && row.group !== group) continue;
    const v = row.values[column];
    if (v == null || skip.has(v) || isConventionalFill(v)) continue;
    const key = row.date.year * 12 + row.date.month;
    const cell = sums.get(key) ?? { sum: 0, count: 0 };
    cell.sum += v;
    cell.count++;
    sums.set(key, cell);
  }
  if (!sums.size) throw new ImportError("The selected column has no valid values.");

  const counts = [...sums.values()].map((c) => c.count).sort((a, b) => a - b);
  const typical = counts[Math.floor(counts.length / 2)];
  const minCount = typical > 1 ? Math.ceil(typical / 2) : 1;

  const keys = [...sums.keys()];
  const origin = Math.floor(Math.min(...keys) / 12);
  const lastYear = Math.floor(Math.max(...keys) / 12);
  const grid: MonthlyGrid = Array.from({ length: lastYear - origin + 1 }, () => new Array<number | null>(12).fill(null));
  let months = 0;
  for (const [key, { sum, count }] of sums) {
    if (count < minCount) continue;
    grid[Math.floor(key / 12) - origin]![key % 12] = sum / count;
    months++;
  }
  return { grid, origin, firstYear: origin, lastYear, months };
}

/** Decimal places that show about three significant digits of the typical year-to-year variation. */
export function suggestDigits(grid: MonthlyGrid): number {
  const values = grid.flatMap((row) => (row ?? []).filter((v): v is number => v != null));
  if (values.length < 2) return 2;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)) || Math.abs(mean) || 1;
  return Math.max(0, Math.min(5, 2 - Math.floor(Math.log10(sd))));
}
