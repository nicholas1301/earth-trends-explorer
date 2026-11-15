// Pure helpers for scripts/fetch-extras.mjs: parsing the files NASA AppEEARS and the Giovanni time-series API return,
// and reducing them to the monthly grids the app stores. No network or file access here, so it can be unit-tested.

/** File name the app looks for: one JSON per featured place, keyed by its coordinates. */
export const placeFileName = (p) => `${p.lat}_${p.lon}.json`;

/** Sample points around a place: (2·halfSteps + 1)² points spaced `step` degrees apart. */
export function samplePoints(place, sampler) {
  const pts = [];
  for (let i = -sampler.halfSteps; i <= sampler.halfSteps; i++) {
    for (let j = -sampler.halfSteps; j <= sampler.halfSteps; j++) {
      pts.push({ latitude: round(place.lat + i * sampler.step, 4), longitude: round(place.lon + j * sampler.step, 4) });
    }
  }
  return pts;
}

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

/** Splits one CSV line, honouring double quotes. */
export function splitCsv(line) {
  const out = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(field); field = ""; }
    else field += c;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/** AppEEARS names a layer's column `<PRODUCT>_<VERSION>_<layer>`, e.g. MOD13Q1_061__250m_16_days_NDVI. */
export const appeearsColumn = (product, layer) => `${product.replace(".", "_")}_${layer}`;

/**
 * Reads an AppEEARS point-sample CSV. Returns, per category (our place key), the samples of the requested layer
 * as { date: "YYYY-MM-DD", value, qa }. `qaLayer` (optional) is read from the same row.
 */
export function parseAppeearsCsv(text, product, layer, qaLayer) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return {};
  const header = splitCsv(lines[0]);
  const col = header.indexOf(appeearsColumn(product, layer));
  if (col < 0) throw new Error(`Column ${appeearsColumn(product, layer)} not found in the ${product} file`);
  const qaCol = qaLayer ? header.indexOf(appeearsColumn(product, qaLayer)) : -1;
  if (qaLayer && qaCol < 0) throw new Error(`QA column ${appeearsColumn(product, qaLayer)} not found`);
  const catCol = header.indexOf("Category");
  const dateCol = header.indexOf("Date");
  if (catCol < 0 || dateCol < 0) throw new Error("Not an AppEEARS point-sample file (no Category/Date columns)");

  const out = {};
  for (const line of lines.slice(1)) {
    const f = splitCsv(line);
    const value = Number(f[col]);
    if (f[col] === "" || !Number.isFinite(value)) continue;
    const qa = qaCol >= 0 ? Number(f[qaCol]) : null;
    (out[f[catCol]] ??= []).push({ date: f[dateCol].slice(0, 10), value, qa });
  }
  return out;
}

/**
 * Reads the CSV of the Giovanni time-series API: `key,value` metadata lines, then a `Timestamp (UTC),Data` header and
 * the rows. Returns { meta, samples }. Fill values (declared in the metadata, or conventional ones) are dropped.
 */
export function parseGiovanniCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const meta = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const [k, ...rest] = splitCsv(lines[i]);
    if (/^timestamp/i.test(k)) break;
    meta[k] = rest.join(",");
  }
  if (i >= lines.length) {
    const hint = text.trim().slice(0, 200);
    throw new Error(`No data table in the Giovanni answer${hint ? `: ${hint}` : ""}`);
  }
  const fills = ["undef", "fill_value", "_FillValue", "missing_value"].map((k) => Number(meta[k])).filter(Number.isFinite);
  const samples = [];
  for (const line of lines.slice(i + 1)) {
    const [t, v] = splitCsv(line);
    const value = Number(v);
    if (!t || v === "" || !Number.isFinite(value)) continue;
    if (isFill(value, fills)) continue;
    samples.push({ date: t.slice(0, 10), value });
  }
  return { meta, samples };
}

/** Declared fill values (compared with a relative tolerance, as they are often printed rounded) and conventional ones. */
export function isFill(value, fills = []) {
  if (Math.abs(value) >= 1e29) return true;
  if (value === -9999 || value === -9999.9 || value === -999 || value === -999.9) return true;
  return fills.some((f) => value === f || (f !== 0 && Math.abs((value - f) / f) < 1e-6));
}

const inRanges = (x, ranges) => ranges.some(([a, b]) => x >= a && x <= b);

/**
 * Turns raw samples into the values that are averaged per month, following a variable's spec:
 * - `qa.keep`: keep only samples whose QA value is listed;
 * - `valid`: keep values within [min, max] (drops fill and special codes);
 * - `transform.share`: categorical layers become 100 (hit) or 0 (other valid class), so the monthly mean is a percentage;
 * - `transform.multiply` / `transform.add`: unit conversion;
 * - `kelvinIfAbove`: converts to °C values that are clearly in kelvin;
 * - `ppbIfBelow`: converts to parts per billion values given as a fraction (mol/mol).
 */
export function cleanSamples(samples, spec) {
  const out = [];
  for (const s of samples) {
    if (spec.qa && !spec.qa.keep.includes(s.qa)) continue;
    let v = s.value;
    const share = spec.transform?.share;
    if (share) {
      if (!inRanges(v, share.valid)) continue;
      v = inRanges(v, share.hit) ? 100 : 0;
    } else if (spec.valid && (v < spec.valid[0] || v > spec.valid[1])) continue;
    if (spec.transform?.multiply != null) v *= spec.transform.multiply;
    if (spec.transform?.add != null) v += spec.transform.add;
    if (spec.kelvinIfAbove != null && v > spec.kelvinIfAbove) v -= 273.15;
    if (spec.ppbIfBelow != null && Math.abs(v) < spec.ppbIfBelow) v *= 1e9;
    out.push({ date: s.date, value: v });
  }
  return out;
}

/**
 * Monthly means as { origin, values }, values[yearIndex][month] (null = no data), origin = first year with data.
 * With `annual`, each yearly value is copied to the 12 months of its year (yearly products such as tree cover).
 */
export function monthlyGrid(samples, { annual = false, lastYear } = {}) {
  const acc = new Map();
  for (const s of samples) {
    const y = +s.date.slice(0, 4);
    const m = +s.date.slice(5, 7) - 1;
    if (!(y >= 1900) || !(m >= 0 && m <= 11) || (lastYear && y > lastYear)) continue;
    const key = annual ? `${y}` : `${y}-${m}`;
    const a = acc.get(key) ?? { y, m, sum: 0, n: 0 };
    a.sum += s.value;
    a.n++;
    acc.set(key, a);
  }
  if (!acc.size) return null;
  const years = [...acc.values()].map((a) => a.y);
  const origin = Math.min(...years);
  const last = Math.max(...years);
  const values = Array.from({ length: last - origin + 1 }, () => new Array(12).fill(null));
  for (const a of acc.values()) {
    const mean = a.sum / a.n;
    if (annual) values[a.y - origin].fill(mean);
    else values[a.y - origin][a.m] = mean;
  }
  return { origin, values: values.map((row) => row.map((v) => (v == null ? null : significant(v)))) };
}

/** Keeps 5 significant digits, which is far beyond the precision of any of these records, to keep the files small. */
const significant = (v) => (v === 0 ? 0 : Number(v.toPrecision(5)));

/** Adds aligned monthly grids (with weights); a month is kept only when every component has it. */
export function sumGrids(grids, weights = grids.map(() => 1)) {
  if (grids.some((g) => !g)) return null;
  const origin = Math.max(...grids.map((g) => g.origin));
  const last = Math.min(...grids.map((g) => g.origin + g.values.length - 1));
  if (last < origin) return null;
  const values = [];
  for (let y = origin; y <= last; y++) {
    const row = [];
    for (let m = 0; m < 12; m++) {
      let sum = 0;
      let ok = true;
      grids.forEach((g, k) => {
        const v = g.values[y - g.origin]?.[m];
        if (v == null) ok = false;
        else sum += v * weights[k];
      });
      row.push(ok ? significant(sum) : null);
    }
    values.push(row);
  }
  return { origin, values };
}

/** Same as monthlyGrid's output, with a unit conversion applied to every value. */
export function transformGrid(grid, transform) {
  if (!grid || !transform) return grid;
  const f = (v) => {
    if (v == null) return null;
    let x = v;
    if (transform.multiply != null) x *= transform.multiply;
    if (transform.add != null) x += transform.add;
    return significant(x);
  };
  return { origin: grid.origin, values: grid.values.map((row) => row.map(f)) };
}

/** Writes a monthly grid in the layout parseGiovanniCsv reads (metadata lines, then `Timestamp (UTC),Data`). */
export function gridToCsv(grid, meta = {}) {
  const lines = Object.entries(meta).map(([k, v]) => `${k},${v}`);
  lines.push("Timestamp (UTC),Data");
  grid?.values.forEach((row, i) =>
    row.forEach((v, m) => v != null && lines.push(`${grid.origin + i}-${String(m + 1).padStart(2, "0")}-01T00:00:00,${v}`)),
  );
  return lines.join("\n") + "\n";
}

/**
 * Years the app can use, with its own rule (lib/trend.ts): a month counts when it has data in at least 3 years, and a
 * year counts when it has at least 75% of those months. So a polar record with no winter data still counts.
 */
export function usableYears(grid) {
  if (!grid) return 0;
  const months = [...Array(12).keys()].filter((m) => grid.values.filter((row) => row[m] != null).length >= 3);
  if (!months.length) return 0;
  return grid.values.filter((row) => months.filter((m) => row[m] != null).length >= 0.75 * months.length).length;
}

/** Reads `machine <host> login <user> password <pass>` from a .netrc file's text. */
export function readNetrc(text, host) {
  const tokens = text.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== "machine" || tokens[i + 1] !== host) continue;
    const entry = {};
    for (let j = i + 2; j < tokens.length && tokens[j] !== "machine"; j += 2) entry[tokens[j]] = tokens[j + 1];
    if (entry.login && entry.password) return { username: entry.login, password: entry.password };
  }
  return null;
}
