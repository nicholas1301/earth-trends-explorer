import type { Challenge, ChallengeView, Task } from "../lib/challenges";
import { formatNumber, formatSigned } from "../lib/format";
import { distanceKm, placeFromPreset } from "../lib/places";
import { LEVEL_LABELS, analyzeTrend, isSignificant, perDecade, type TrendOk, type TrendResult } from "../lib/trend";
import type { Place, Preset } from "../types";
import { FIRST_YEAR, LAST_YEAR, MONTHS, VARIABLE_BY_ID, presetAt, seasonById } from "./catalog";

/** Rate (°C per decade) that counts as “fast warming” in the record hunt. */
export const FAST_WARMING = 0.5;
/** Last year of the “early” period in the Sahel challenge. */
const EARLY_END = 2000;

const FULL_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ---- Building blocks ----

/**
 * Places the challenges ask for. They live here, not in the saved places, so every challenge keeps working
 * when the user edits or empties that list.
 */
const PLACES = {
  svalbard: { name: "Svalbard", region: "Arctic", lat: 78.2, lon: 15.6, tag: "polar" },
  aral: { name: "Aral Sea", region: "Central Asia", lat: 45.0, lon: 60.0, tag: "shrinking lake" },
  saoPaulo: { name: "São Paulo", region: "Brazil", lat: -23.5, lon: -46.6, tag: "megacity" },
  niamey: { name: "Niamey", region: "Sahel", lat: 13.5, lon: 2.1, tag: "desert edge" },
  yakutsk: { name: "Yakutsk", region: "Siberia", lat: 62.0, lon: 129.7, tag: "permafrost" },
  antarctic: { name: "Antarctic Peninsula", region: "Antarctica", lat: -64.8, lon: -62.9, tag: "polar" },
  pacific: { name: "Equatorial Pacific", region: "El Niño region", lat: 0.0, lon: -150.0, tag: "ocean" },
  manaus: { name: "Manaus", region: "Central Amazon", lat: -3.1, lon: -60.0, tag: "tropical rainforest" },
} satisfies Record<string, Preset>;

/** A point this close (km) counts as the place, however it was chosen (search, globe, coordinates or saved list). */
export const NEAR_KM = 150;
/** A point named after the place (e.g. a search result or a reverse-geocoded click) may be this far away. */
const NAMED_KM = 400;

/** Lower case without accents, so “Sao Paulo” matches “São Paulo”. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** True when the investigated place is the one a challenge asks for. */
export function isPlace(target: Place, place: Place): boolean {
  const d = distanceKm(target, place);
  return d <= NEAR_KM || (d <= NAMED_KM && fold(`${place.name} ${place.region}`).includes(fold(target.name)));
}

// Each task waits for its own screen, so nothing ticks early from a previous investigation still in memory.

/** The investigation is on screen (past the Place step). */
const onResults = (v: ChallengeView) => v.step === "clues" || v.step === "verdict" || v.step === "compare";

const investigate = (preset: Preset): Task => {
  const place = placeFromPreset(preset);
  return { label: `Investigate ${preset.name}`, done: (v) => onResults(v) && isPlace(place, v.place), place };
};

/** Ticks once the variable’s verdict is shown (picked on the clue board), not while it is only remembered. */
const open = (variableId: string): Task => ({
  label: `Open “${VARIABLE_BY_ID[variableId].name}”`,
  done: (v) => (v.step === "verdict" || v.step === "compare") && v.variable === variableId,
});

const ok = (r: TrendResult | undefined): TrendOk | null => (r?.ok ? r : null);
const rate = (r: TrendOk, variableId: string) => `${formatSigned(perDecade(r), VARIABLE_BY_ID[variableId].digits)} ${VARIABLE_BY_ID[variableId].unit} per decade`;
const period = (v: ChallengeView) => `${v.filters.y0}–${v.filters.y1}`;

/** “a significant increase” / “no significant trend” / “a significant decrease”, as an option index. */
const verdictIndex = (r: TrendOk) => (!isSignificant(r) ? 1 : r.direction > 0 ? 0 : 2);

const compareTab = (tab: "region" | "world"): Task => ({
  label: tab === "region" ? "Compare with the area around it (step 4, “Around here”)" : "Compare with your saved places (step 4, “Across the world”)",
  done: (v) => v.step === "compare" && v.whereTab === tab && (tab === "region" ? !!v.region : !!v.world),
});

/** The places of a world comparison that are the given preset (matched by position, so renamed saved places still count). */
const findInWorld = (v: ChallengeView, preset: Preset) => {
  const target = placeFromPreset(preset);
  return v.world?.places.find((p) => isPlace(target, { name: p.name, region: "", lat: p.lat, lon: p.lon, tag: null })) ?? null;
};

/** The pole-to-pole line-up: investigated first, the others must be in the saved places. */
const POLE_TO_POLE = [PLACES.yakutsk, PLACES.antarctic, PLACES.pacific, PLACES.manaus];

/** A point whose change is this many times the area mean counts as a local story. */
const LOCAL_RATIO = 1.5;

// ---- The challenges ----

export const CHALLENGES: Challenge[] = [
  {
    id: "arctic-rate",
    level: "rookie",
    theme: "heat",
    title: "How fast is the Arctic warming?",
    summary: "Read a verdict: find the rate of change in Svalbard.",
    tasks: [investigate(PLACES.svalbard), open("T2M")],
    hint: "Choose Svalbard on the Place step, then pick “Air temperature” on the clue board. The verdict states the change per decade.",
    quiz(v) {
      const r = ok(v.scan.T2M);
      if (!r) return null;
      const x = perDecade(r);
      return {
        question: "How much is the air temperature changing here?",
        options: ["Less than 0.3 °C per decade", "0.3 to 0.6 °C per decade", "0.6 to 1.0 °C per decade", "More than 1.0 °C per decade"],
        correct: x < 0.3 ? 0 : x < 0.6 ? 1 : x <= 1 ? 2 : 3,
        explain:
          `Over ${period(v)} the verdict is ${rate(r, "T2M")}, with ${LEVEL_LABELS[r.level]} evidence. ` +
          "The Arctic warms faster than the planet as a whole: as snow and sea ice shrink, the darker ground and ocean absorb more sunlight.",
      };
    },
  },
  {
    id: "top-clue",
    level: "rookie",
    theme: "water",
    title: "The strongest clue at the Aral Sea",
    summary: "Use the clue board: which of the 20 variables changed most clearly?",
    tasks: [investigate(PLACES.aral)],
    hint: "The clue board lists all 20 variables with the strongest evidence first. Make sure the topic filter shows all topics.",
    quiz(v) {
      const top = v.ranked[0];
      if (!ok(v.scan[top.id])) return null;
      const options = [0, 5, 10, 15].map((i) => v.ranked[i].name).sort();
      return {
        question: "Which variable is at the top of the clue board?",
        options,
        correct: options.indexOf(top.name),
        explain:
          `“${top.name}” shows the most consistent change here (${rate(v.scan[top.id] as TrendOk, top.id)}). ` +
          "The board tests every variable and sorts them by strength of evidence, so the first row is where a detective starts — and it is often not the variable you expected.",
      };
    },
  },
  {
    id: "day-or-night",
    level: "rookie",
    theme: "heat",
    title: "Hot days or warm nights in São Paulo?",
    summary: "Compare two variables in the same place.",
    tasks: [investigate(PLACES.saoPaulo)],
    hint: "Open “Maximum temperature” and “Minimum temperature” one after the other and compare the change per decade in each verdict.",
    quiz(v) {
      const max = ok(v.scan.T2M_MAX);
      const min = ok(v.scan.T2M_MIN);
      if (!max || !min || perDecade(max) === perDecade(min)) return null;
      return {
        question: "Which one is rising faster?",
        options: ["The hottest days (maximum temperature)", "The coldest nights (minimum temperature)"],
        correct: perDecade(max) > perDecade(min) ? 0 : 1,
        explain:
          `Maximum temperature: ${rate(max, "T2M_MAX")}. Minimum temperature: ${rate(min, "T2M_MIN")}. ` +
          "One place can warm at different speeds by day and by night, because clouds, humidity, pollution and city surfaces affect each of them differently.",
      };
    },
  },
  {
    id: "month-that-changed",
    level: "detective",
    theme: "ice",
    title: "The month that changed the most",
    summary: "Look inside the year: when is Svalbard warming fastest?",
    tasks: [investigate(PLACES.svalbard), open("T2M")],
    hint: "Below the main chart of the verdict, the “trend by month” bars show the change of each calendar month. Look for the tallest bar.",
    quiz(v) {
      const rates = MONTHS.map((_, m) => ok(analyzeTrend(v.data.T2M ?? [], v.filters.y0, v.filters.y1, [m])));
      let best = -1;
      rates.forEach((r, m) => {
        if (r && (best < 0 || perDecade(r) > perDecade(rates[best]!))) best = m;
      });
      if (best < 0) return null;
      const months = [0, 3, 6, 9].map((k) => (best + k) % 12).sort((a, b) => a - b);
      const year = ok(analyzeTrend(v.data.T2M ?? [], v.filters.y0, v.filters.y1, seasonById("year").months));
      const winter = best >= 9 || best <= 2;
      return {
        question: "In which month is the air temperature rising fastest?",
        options: months.map((m) => FULL_MONTH_NAMES[m]),
        correct: months.indexOf(best),
        explain:
          `${FULL_MONTH_NAMES[best]}: ${rate(rates[best]!, "T2M")}` +
          (year ? `, against ${rate(year, "T2M")} for the whole year. ` : ". ") +
          (winter ? "Arctic warming is strongest in the dark, cold months: with less sea ice, the ocean releases heat into the air. " : "") +
          "An annual average can hide when the change really happens.",
      };
    },
  },
  {
    id: "sahel-rain",
    level: "detective",
    theme: "water",
    title: "Was the Sahel’s rain already back in 2000?",
    summary: "Change the period: how many years does a trend need to show up?",
    tasks: [
      investigate(PLACES.niamey),
      open("PRECTOTCORR"),
      { label: `Set the period to end in ${EARLY_END} or earlier`, done: (v) => v.filters.y1 <= EARLY_END },
    ],
    hint: "After the droughts of the 1980s the rain slowly returned. Use the period filter above the results to keep only the first two decades, and read the verdict again.",
    quiz(v) {
      const r = ok(v.scan.PRECTOTCORR);
      if (!r) return null;
      const full = ok(analyzeTrend(v.data.PRECTOTCORR ?? [], FIRST_YEAR, LAST_YEAR, seasonById(v.filters.season).months));
      const words = ["a significant increase", "no significant trend", "a significant decrease"];
      return {
        question: `With only the years ${period(v)}, what does the verdict say about rain?`,
        options: ["A significant increase", "No significant trend yet", "A significant decrease"],
        correct: verdictIndex(r),
        explain:
          `With ${period(v)} alone the test finds ${words[verdictIndex(r)]} (${rate(r, "PRECTOTCORR")}). ` +
          (full ? `With the whole record, ${FIRST_YEAR}–${LAST_YEAR}, it finds ${words[verdictIndex(full)]} (${rate(full, "PRECTOTCORR")}). ` : "") +
          "Rain varies a lot from year to year, so a real change can stay hidden until enough years of data pile up. Set the period back to the full record and compare.",
      };
    },
  },
  {
    id: "aral-around",
    level: "detective",
    theme: "sun",
    title: "Local or regional at the Aral Sea?",
    summary: "Zoom out: is the change at the point stronger than in the area around it?",
    tasks: [investigate(PLACES.aral), open("ALLSKY_SFC_SW_DWN"), compareTab("region")],
    hint:
      "The verdict gives the change at the point (hover the ringed cell to see it again). On the Compare step, “Around here” maps the " +
      "10° box around the point, and the sentence beside the map gives the mean of the whole area. Minimize this card to read it.",
    quiz(v) {
      const here = ok(v.scan.ALLSKY_SFC_SW_DWN);
      const area = v.region?.areaMean;
      if (!here || area == null) return null;
      const point = perDecade(here);
      const ratio = area === 0 ? Infinity : point / area;
      // Opposite directions: compare sizes only.
      const correct = ratio < 0 ? (Math.abs(point) > Math.abs(area) ? 0 : 2) : ratio > LOCAL_RATIO ? 0 : ratio >= 1 / LOCAL_RATIO ? 1 : 2;
      const unit = VARIABLE_BY_ID.ALLSKY_SFC_SW_DWN;
      return {
        question: "Compared with the area around it, how big is the change in sunlight at the Aral Sea?",
        options: ["Much bigger than the area average", "About the same as the area average", "Smaller than the area average"],
        correct,
        explain:
          `At the point: ${rate(here, "ALLSKY_SFC_SW_DWN")}. Mean of the whole area: ${formatSigned(area, unit.digits)} ${unit.unit} per decade. ` +
          (correct === 0
            ? "The change is concentrated where the lake used to be — a local story, so look for a local cause: the lake bed dried out, and the clouds and dust above it changed. "
            : "The point changes like its surroundings — a regional story, so the cause is probably bigger than the lake. ") +
          "Comparing a point with the area around it is how a detective tells local causes from regional ones.",
      };
    },
  },
  {
    id: "pole-to-pole",
    level: "master",
    theme: "heat",
    title: "Pole to pole: who warms fastest?",
    summary: "Rank Siberia, Antarctica, the open Pacific and the Amazon by how fast they warm.",
    tasks: [
      investigate(PLACES.yakutsk),
      open("T2M"),
      compareTab("world"),
      {
        label: `Have ${POLE_TO_POLE.slice(1).map((p) => p.name).join(", ").replace(/, ([^,]*)$/, " and $1")} in the comparison`,
        done: (v) => POLE_TO_POLE.every((p) => findInWorld(v, p)),
      },
    ],
    hint:
      "“Across the world” ranks your saved places with the fastest rise at the top of the bars. If one of the four is missing, " +
      "go back to step 1 (Place), choose it and press ☆ Save, then investigate Yakutsk again. Only these four count: read their order, ignore the others.",
    quiz(v) {
      const found = POLE_TO_POLE.map((p) => findInWorld(v, p));
      if (found.some((p) => !p)) return null;
      // Under the names the bars show, which may be the user's own for a renamed saved place.
      const ranked = found.map((p) => p!).sort((a, b) => b.perDecade - a.perDecade);
      if (ranked.some((p, i) => i > 0 && p.perDecade === ranked[i - 1].perDecade)) return null;
      const order = (ix: number[]) => ix.map((i) => ranked[i].name).join(" › ");
      // Near misses (one neighbouring pair swapped) and the reverse, so the bars have to be read carefully.
      const right = order([0, 1, 2, 3]);
      const options = [right, order([1, 0, 2, 3]), order([0, 1, 3, 2]), order([3, 2, 1, 0])].sort();
      const fmt = (p: (typeof ranked)[number]) =>
        `${p.name} ${formatSigned(p.perDecade, VARIABLE_BY_ID.T2M.digits)} °C${p.significant ? "" : " (not significant)"}`;
      return {
        question: "From fastest to slowest, how does the air temperature of these four places rise?",
        options,
        correct: options.indexOf(right),
        explain:
          `Per decade, over ${period(v)}: ${ranked.map(fmt).join("; ")}. ` +
          "Warming is global but uneven. Land far from the sea, like Siberia, heats up fastest, helped by thawing snow and permafrost; " +
          "the open ocean stores heat in its depths and warms slowly, with El Niño years shaking its record; " +
          "and Antarctica, ringed by the cold Southern Ocean, does not mirror the Arctic — its peninsula warmed fast, then paused.",
      };
    },
  },
  {
    id: "record-hunt",
    level: "master",
    theme: "heat",
    title: "Record hunt: the fastest-warming place",
    summary: "Explore the globe on your own and try to beat your record.",
    tasks: [
      { label: "Pick your own point on the globe (not a preset place)", done: (v) => onResults(v) && !presetAt(v.place.lat, v.place.lon) },
      open("T2M"),
      {
        label: `Find significant warming of at least ${formatNumber(FAST_WARMING, 1)} °C per decade`,
        done: (v) => {
          const r = ok(v.scan.T2M);
          return !!r && isSignificant(r) && perDecade(r) >= FAST_WARMING;
        },
      },
    ],
    hint: "Land warms faster than the ocean, and high latitudes faster than the tropics. Click a point on the globe, read the verdict, then try another one.",
    explain:
      "You found a fast-warming place. Keep exploring: this card stays open and keeps your best rate. " +
      "Notice where the fast places tend to be: far north and over land, where snow and ice are retreating.",
    score: {
      label: "Your record",
      unit: "°C per decade",
      digits: 2,
      value: (v) => {
        const r = ok(v.scan.T2M);
        return r && isSignificant(r) ? perDecade(r) : null;
      },
    },
  },
];
