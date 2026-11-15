#!/usr/bin/env node
// Downloads the extra records (vegetation, fire, pollution, hydrology…) for the 17 featured places and writes one JSON
// per place to src/data/extras/, which the app loads when one of those places is investigated.
//
//   node scripts/fetch-extras.mjs                 # everything (AppEEARS tasks may take a few hours: re-run to resume)
//   node scripts/fetch-extras.mjs --only giovanni # or --only appeears
//   node scripts/fetch-extras.mjs --build         # only rebuild the JSON files from what is already downloaded
//   node scripts/fetch-extras.mjs --build --except PM25,DUST   # leave variables out (e.g. a download in progress)
//
// Needs a free NASA Earthdata login (https://urs.earthdata.nasa.gov). The script reads it from, in this order:
//   - EARTHDATA_USERNAME and EARTHDATA_PASSWORD environment variables;
//   - a ~/.netrc (or ~/_netrc on Windows) line: machine urs.earthdata.nasa.gov login <user> password <pass>.
// EARTHDATA_TOKEN (a token generated on the Earthdata profile page) is used for Giovanni when set.
// Downloads are cached in scripts/extras/.cache/ (git-ignored), so re-running never asks NASA for the same file twice.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanSamples,
  gridToCsv,
  monthlyGrid,
  parseAppeearsCsv,
  parseGiovanniCsv,
  placeFileName,
  readNetrc,
  samplePoints,
  sumGrids,
  transformGrid,
  usableYears,
} from "./extras/lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "scripts/extras/.cache");
const OUT = join(ROOT, "src/data/extras");
/** Which variables each place has, read eagerly by the app (the per-place files are loaded on demand). */
const INDEX = join(ROOT, "src/data/extras-index.json");
const PRESETS = JSON.parse(readFileSync(join(ROOT, "src/config/presets.json"), "utf8"));
const SPEC = JSON.parse(readFileSync(join(ROOT, "scripts/extras/datasets.json"), "utf8"));
const LAST_YEAR = new Date().getFullYear() - 1;

const APPEEARS = "https://appeears.earthdatacloud.nasa.gov/api";
const GIOVANNI = "https://api.giovanni.earthdata.nasa.gov/timeseries";
const EDL = "urs.earthdata.nasa.gov";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const buildOnly = args.includes("--build");
const noWait = args.includes("--no-wait");
/** Variables left out of the app's files (e.g. while their download is still incomplete): --except PM25,DUST */
const except = new Set(args.includes("--except") ? args[args.indexOf("--except") + 1].split(",") : []);

const placeKey = (p) => `${p.lat}_${p.lon}`;
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(CACHE, { recursive: true });

// ---------- Credentials ----------

function credentials() {
  const { EARTHDATA_USERNAME: username, EARTHDATA_PASSWORD: password } = process.env;
  if (username && password) return { username, password };
  for (const name of [".netrc", "_netrc"]) {
    const path = join(homedir(), name);
    if (existsSync(path)) {
      const found = readNetrc(readFileSync(path, "utf8"), EDL);
      if (found) return found;
    }
  }
  throw new Error(
    "No NASA Earthdata login found. Set EARTHDATA_USERNAME and EARTHDATA_PASSWORD, or add to ~/.netrc:\n" +
      `  machine ${EDL} login <user> password <password>`,
  );
}

const basic = ({ username, password }) => "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

/** Earthdata bearer token for Giovanni: EARTHDATA_TOKEN, or an existing/new token of the account. */
async function earthdataToken() {
  if (process.env.EARTHDATA_TOKEN) return process.env.EARTHDATA_TOKEN;
  const auth = { Authorization: basic(credentials()) };
  const list = await fetch(`https://${EDL}/api/users/tokens`, { headers: auth });
  if (list.ok) {
    const tokens = await list.json();
    if (Array.isArray(tokens) && tokens[0]?.access_token) return tokens[0].access_token;
  }
  const made = await fetch(`https://${EDL}/api/users/token`, { method: "POST", headers: auth });
  if (!made.ok) throw new Error(`Earthdata refused to issue a token (${made.status}): ${await made.text()}`);
  return (await made.json()).access_token;
}

// ---------- AppEEARS ----------

const TASKS_FILE = join(CACHE, "appeears-tasks.json");
const readTasks = () => (existsSync(TASKS_FILE) ? JSON.parse(readFileSync(TASKS_FILE, "utf8")) : {});

async function appeearsLogin() {
  const res = await fetch(`${APPEEARS}/login`, { method: "POST", headers: { Authorization: basic(credentials()), "Content-Length": "0" } });
  if (!res.ok) throw new Error(`AppEEARS login failed (${res.status}): ${await res.text()}`);
  return (await res.json()).token;
}

/** Layers (plus the QA layers they need) requested from each sampler's task. */
function layersBySampler() {
  const out = {};
  for (const v of Object.values(SPEC.variables)) {
    if (v.tool !== "appeears") continue;
    const list = (out[v.sampler] ??= []);
    const add = (layer) => list.some((l) => l.product === v.product && l.layer === layer) || list.push({ product: v.product, layer });
    add(v.layer);
    if (v.qa) add(v.qa.layer);
  }
  return out;
}

async function runAppeears() {
  const token = await appeearsLogin();
  const auth = { Authorization: `Bearer ${token}` };
  const tasks = readTasks();

  for (const [sampler, layers] of Object.entries(layersBySampler())) {
    if (tasks[sampler]?.downloaded) continue;
    if (!tasks[sampler]) {
      const coordinates = PRESETS.flatMap((p) =>
        samplePoints(p, SPEC.samplers[sampler]).map((pt, i) => ({ id: `${placeKey(p)}#${i}`, category: placeKey(p), ...pt })),
      );
      const body = {
        task_type: "point",
        task_name: `earth-trends-extras-${sampler}`,
        params: { dates: [{ startDate: "01-01-2000", endDate: `12-31-${LAST_YEAR}` }], layers, coordinates },
      };
      const res = await fetch(`${APPEEARS}/task`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`AppEEARS refused the ${sampler} task (${res.status}): ${await res.text()}`);
      tasks[sampler] = { id: (await res.json()).task_id };
      writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
      log(`AppEEARS: submitted the ${sampler} task (${coordinates.length} points, ${layers.length} layers): ${tasks[sampler].id}`);
    }
  }

  for (const [sampler, task] of Object.entries(tasks)) {
    if (task.downloaded) continue;
    for (;;) {
      const res = await fetch(`${APPEEARS}/task/${task.id}`, { headers: auth });
      if (!res.ok) throw new Error(`AppEEARS status check failed (${res.status})`);
      const { status } = await res.json();
      if (status === "done") break;
      if (status === "error") throw new Error(`AppEEARS task ${task.id} (${sampler}) failed; see https://appeears.earthdatacloud.nasa.gov/explore`);
      if (noWait) {
        log(`AppEEARS: ${sampler} task is "${status}". Run the script again later to download it.`);
        return false;
      }
      log(`AppEEARS: ${sampler} task is "${status}"; checking again in 2 minutes (Ctrl+C is safe: re-running resumes).`);
      await sleep(120_000);
    }
    const bundle = await (await fetch(`${APPEEARS}/bundle/${task.id}`, { headers: auth })).json();
    const dir = join(CACHE, "appeears", sampler);
    mkdirSync(dir, { recursive: true });
    for (const f of bundle.files.filter((x) => x.file_name.endsWith(".csv"))) {
      const res = await fetch(`${APPEEARS}/bundle/${task.id}/${f.file_id}`, { headers: auth });
      if (!res.ok) throw new Error(`Download of ${f.file_name} failed (${res.status})`);
      writeFileSync(join(dir, f.file_name.split("/").pop()), Buffer.from(await res.arrayBuffer()));
      log(`AppEEARS: downloaded ${f.file_name}`);
    }
    task.downloaded = true;
    writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  }
  return true;
}

/** Text of the downloaded AppEEARS file for a product (e.g. …-MOD13Q1-061-results.csv). */
function appeearsFile(sampler, product) {
  const dir = join(CACHE, "appeears", sampler);
  if (!existsSync(dir)) return null;
  const tag = `-${product.replace(".", "-")}-results.csv`;
  const name = readdirSync(dir).find((f) => f.endsWith(tag));
  return name ? readFileSync(join(dir, name), "utf8") : null;
}

// ---------- Giovanni ----------

const giovanniCachePath = (id, p) => join(CACHE, "giovanni", id.replace(/[^\w.-]+/g, "_"), `${placeKey(p)}.csv`);
const giovanniErrors = {};

/** One request to the Giovanni time-series API, retried on server errors. */
async function giovanniRequest(token, id, p, from, to) {
  const params = new URLSearchParams({ data: id, location: `[${p.lat},${p.lon}]`, time: `${from}T00:00:00/${to}T23:59:59` });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${GIOVANNI}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text();
    if (res.ok && /timestamp/i.test(text)) return text;
    if (attempt >= 3 || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
      throw new Error(`${res.status} ${text.slice(0, 160).replace(/\s+/g, " ")}`);
    }
    await sleep(5000 * attempt);
  }
}

/**
 * Series of one dataset at one place, cached. With `chunkYears`, the period is requested in pieces (hourly MERRA-2
 * exceeds the API's size limit otherwise) and only the monthly means are kept, so the cache stays small.
 */
async function giovanniFetch(token, id, p, start, chunkYears) {
  const path = giovanniCachePath(id, p);
  if (existsSync(path)) return readFileSync(path, "utf8");
  let text;
  if (!chunkYears) {
    text = await giovanniRequest(token, id, p, start, `${LAST_YEAR}-12-31`);
  } else {
    const samples = [];
    let unit = "";
    for (let y = +start.slice(0, 4); y <= LAST_YEAR; y += chunkYears) {
      const from = y === +start.slice(0, 4) ? start : `${y}-01-01`;
      const part = parseGiovanniCsv(await giovanniRequest(token, id, p, from, `${Math.min(y + chunkYears - 1, LAST_YEAR)}-12-31`));
      unit = part.meta.unit ?? unit;
      samples.push(...part.samples);
    }
    text = gridToCsv(monthlyGrid(samples), { prod_name: id, unit, note: "monthly means of the hourly values" });
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return text;
}

/** Every (dataset id, place) pair needed, trying each variable's candidates until one works for the first place. */
async function runGiovanni() {
  const token = await earthdataToken();
  const jobs = [];
  for (const [vid, v] of Object.entries(SPEC.variables)) {
    if (v.tool !== "giovanni") continue;
    const groups = v.sum ?? [v.candidates];
    for (const candidates of groups) {
      const places = v.oceanOnly ? PRESETS.filter((p) => p.tag === "ocean") : PRESETS;
      const chosen = await pickCandidate(token, candidates, v, vid, places);
      if (!chosen) continue;
      for (const p of places) jobs.push({ vid, id: chosen, p, start: v.start, chunkYears: v.chunkYears });
    }
  }
  let done = 0;
  const worker = async () => {
    for (let j = jobs.shift(); j; j = jobs.shift()) {
      try {
        await giovanniFetch(token, j.id, j.p, j.start, j.chunkYears);
      } catch (e) {
        (giovanniErrors[j.vid] ??= []).push(`${j.p.name}: ${e.message}`);
      }
      if (++done % 25 === 0) log(`Giovanni: ${done} series downloaded`);
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  for (const [vid, errs] of Object.entries(giovanniErrors)) log(`Giovanni: ${vid} failed at ${errs.length} place(s), e.g. ${errs[0]}`);
}

/** First dataset id the API answers for (tested at the first place, and at sea), so retired versions are skipped. */
async function pickCandidate(token, candidates, v, vid, places) {
  const probes = [...new Set([places[0], places.find((p) => p.tag === "ocean") ?? places[0]])];
  for (const id of candidates) {
    for (const p of probes) {
      try {
        await giovanniFetch(token, id, p, v.start, v.chunkYears);
        return id;
      } catch (e) {
        (giovanniErrors[`${vid} (${id})`] ??= []).push(`${p.name}: ${e.message}`);
      }
    }
  }
  log(`Giovanni: none of the datasets for ${vid} answered (${candidates.join(", ")})`);
  return null;
}

/** Cached Giovanni grid of one dataset at one place, cleaned with `spec` (fills and units). */
function giovanniGrid(candidates, p, spec) {
  for (const id of candidates) {
    const path = giovanniCachePath(id, p);
    if (!existsSync(path)) continue;
    const { samples } = parseGiovanniCsv(readFileSync(path, "utf8"));
    return { grid: monthlyGrid(cleanSamples(samples, spec), { lastYear: LAST_YEAR }), id };
  }
  return { grid: null, id: null };
}

// ---------- Build the app's files ----------

function build() {
  mkdirSync(OUT, { recursive: true });
  const csvCache = {};
  const table = [];
  const index = {};
  for (const p of PRESETS) {
    const series = {};
    const missing = {};
    for (const [vid, v] of Object.entries(SPEC.variables)) {
      if (except.has(vid)) {
        missing[vid] = "left out of this build";
        continue;
      }
      let grid = null;
      let source = null;
      try {
        if (v.tool === "appeears") {
          const key = `${v.sampler}|${v.product}`;
          const text = (csvCache[key] ??= appeearsFile(v.sampler, v.product));
          if (text) {
            const samples = parseAppeearsCsv(text, v.product, v.layer, v.qa?.layer)[placeKey(p)] ?? [];
            grid = monthlyGrid(cleanSamples(samples, v), { annual: v.annual, lastYear: LAST_YEAR });
            source = `${v.product} ${v.layer} via NASA AppEEARS`;
          }
        } else if (v.oceanOnly && p.tag !== "ocean") {
          missing[vid] = "ocean variable";
          continue;
        } else if (v.sum) {
          const parts = v.sum.map((c) => giovanniGrid(c, p, {}));
          grid = transformGrid(sumGrids(parts.map((x) => x.grid), v.weights), v.transform);
          source = parts.every((x) => x.id) ? `${parts.map((x) => x.id).join(" + ")} via NASA Giovanni` : null;
        } else {
          const r = giovanniGrid(v.candidates, p, v);
          grid = r.grid;
          source = r.id && `${r.id} via NASA Giovanni`;
        }
      } catch (e) {
        missing[vid] = e.message;
        continue;
      }
      if (grid && usableYears(grid) >= 8) series[vid] = { ...grid, source };
      else if (grid) missing[vid] = `only ${usableYears(grid)} usable years`;
      else missing[vid] = source ? "no valid values at this place" : "not downloaded";
    }
    const file = { place: p.name, lat: p.lat, lon: p.lon, generated: new Date().toISOString().slice(0, 10), series, missing };
    writeFileSync(join(OUT, placeFileName(p)), JSON.stringify(file) + "\n");
    index[placeKey(p)] = Object.keys(series);
    table.push({ place: p.name, variables: Object.keys(series).length, missing: Object.keys(missing).join(" ") });
  }
  writeFileSync(INDEX, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), places: index }, null, 2) + "\n");
  console.table(table);
}

// ---------- Main ----------

try {
  let appeearsReady = true;
  if (!buildOnly) {
    if (only !== "appeears") await runGiovanni();
    if (only !== "giovanni") appeearsReady = await runAppeears();
  }
  build();
  if (!appeearsReady) log("Built with the data available so far; AppEEARS layers will be added on the next run.");
} catch (e) {
  console.error(`\n${e.message}`);
  process.exit(1);
}
