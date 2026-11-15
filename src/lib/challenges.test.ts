import { describe, expect, it } from "vitest";
import { FIRST_YEAR, LAST_YEAR, PRESETS, VARIABLES } from "../config/catalog";
import { CHALLENGES, FAST_WARMING } from "../config/challenges";
import type { Filters, MonthlyGrid, PointData } from "../types";
import { evaluateChallenge, parseProgress, withCompleted, withScore, type ChallengeView } from "./challenges";
import { rankVariables, scanVariables } from "./clues";
import { makePlace, placeFromPreset } from "./places";

const YEARS = LAST_YEAR - FIRST_YEAR + 1;
const FULL: Filters = { y0: FIRST_YEAR, y1: LAST_YEAR, season: "year" };

/** Deterministic noise in [-1, 1]. */
const noise = (y: number, m: number) => Math.sin(y * 12.9898 + m * 78.233) * 0.999;

/** Grid with a linear trend (units per decade, optionally per month) plus a little noise. */
const trendGrid = (perDecade: number | ((month: number) => number), amplitude = 0.05): MonthlyGrid =>
  Array.from({ length: YEARS }, (_, y) =>
    Array.from({ length: 12 }, (_, m) => ((typeof perDecade === "number" ? perDecade : perDecade(m)) * y) / 10 + amplitude * noise(y, m)),
  );

function makeView(placeName: string | null, variable: string | null, grids: Record<string, MonthlyGrid>, filters = FULL): ChallengeView {
  const data: PointData = Object.fromEntries(VARIABLES.map((v) => [v.id, grids[v.id] ?? trendGrid(0)]));
  const scan = scanVariables(data, filters);
  const place = placeName ? placeFromPreset(PRESETS.find((p) => p.name === placeName)!) : makePlace(70.3, 100.2);
  return { place, variable, filters, data, scan, ranked: rankVariables(scan), step: "verdict", whereTab: "region", region: null, world: null };
}

const byId = (id: string) => CHALLENGES.find((c) => c.id === id)!;

describe("challenge catalog", () => {
  it("has unique ids and at least one task each", () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    for (const c of CHALLENGES) {
      expect(c.tasks.length).toBeGreaterThan(0);
      expect(!!c.quiz || c.explain != null).toBe(true);
    }
  });

  it("is not ready without an investigation", () => {
    for (const c of CHALLENGES) expect(evaluateChallenge(c, null).ready).toBe(false);
  });
});

describe("arctic-rate", () => {
  const c = byId("arctic-rate");

  it("ticks the tasks one by one, in order", () => {
    expect(evaluateChallenge(c, makeView("Niamey", "T2M", {})).tasks).toEqual([false, false]);
    expect(evaluateChallenge(c, makeView("Svalbard", "TS", {})).tasks).toEqual([true, false]);
    expect(evaluateChallenge(c, makeView("Svalbard", "T2M", {})).ready).toBe(true);
  });

  it("waits for each task's own screen", () => {
    const view = makeView("Svalbard", "T2M", {});
    expect(evaluateChallenge(c, { ...view, step: "place" }).tasks).toEqual([false, false]);
    expect(evaluateChallenge(c, { ...view, step: "clues" }).tasks).toEqual([true, false]);
    expect(evaluateChallenge(c, { ...view, step: "compare" }).ready).toBe(true);
  });

  it("derives the right band from the data", () => {
    expect(c.quiz!(makeView("Svalbard", "T2M", { T2M: trendGrid(0.8) }))!.correct).toBe(2);
    expect(c.quiz!(makeView("Svalbard", "T2M", { T2M: trendGrid(0.45) }))!.correct).toBe(1);
    expect(c.quiz!(makeView("Svalbard", "T2M", { T2M: trendGrid(1.4) }))!.correct).toBe(3);
    expect(c.quiz!(makeView("Svalbard", "T2M", { T2M: trendGrid(-0.2) }))!.correct).toBe(0);
  });

  it("has no question without enough data", () => {
    expect(c.quiz!(makeView("Svalbard", "T2M", { T2M: [] }))).toBeNull();
  });
});

describe("top-clue", () => {
  it("asks for the top-ranked variable among four distinct options", () => {
    const view = makeView("Aral Sea", null, { CLOUD_AMT: trendGrid(3, 0.01), WS10M: trendGrid(0.1, 0.5) });
    const quiz = byId("top-clue").quiz!(view)!;
    expect(quiz.options[quiz.correct]).toBe("Cloud cover");
    expect(new Set(quiz.options).size).toBe(4);
  });
});

describe("day-or-night", () => {
  const c = byId("day-or-night");
  it("picks whichever rises faster", () => {
    expect(c.quiz!(makeView("São Paulo", null, { T2M_MAX: trendGrid(0.8), T2M_MIN: trendGrid(0.2) }))!.correct).toBe(0);
    expect(c.quiz!(makeView("São Paulo", null, { T2M_MAX: trendGrid(0.1), T2M_MIN: trendGrid(0.6) }))!.correct).toBe(1);
  });
});

describe("month-that-changed", () => {
  it("finds the month with the steepest trend", () => {
    const view = makeView("Svalbard", "T2M", { T2M: trendGrid((m) => (m === 11 ? 2 : 0.3)) });
    const quiz = byId("month-that-changed").quiz!(view)!;
    expect(quiz.options).toEqual(["March", "June", "September", "December"]);
    expect(quiz.options[quiz.correct]).toBe("December");
  });
});

describe("sahel-rain", () => {
  const c = byId("sahel-rain");
  // Flat until 2000, rising afterwards.
  const rain: MonthlyGrid = Array.from({ length: YEARS }, (_, y) =>
    Array.from({ length: 12 }, (_, m) => Math.max(0, FIRST_YEAR + y - 2000) * 0.05 + 0.05 * noise(y, m)),
  );

  it("needs the period to end in 2000 or earlier", () => {
    expect(evaluateChallenge(c, makeView("Niamey", "PRECTOTCORR", { PRECTOTCORR: rain })).tasks).toEqual([true, true, false]);
    expect(evaluateChallenge(c, makeView("Niamey", "PRECTOTCORR", { PRECTOTCORR: rain }, { ...FULL, y1: 2000 })).ready).toBe(true);
  });

  it("answers from the verdict of the selected period", () => {
    const early = c.quiz!(makeView("Niamey", "PRECTOTCORR", { PRECTOTCORR: rain }, { ...FULL, y1: 2000 }))!;
    expect(early.correct).toBe(1);
    expect(early.explain).toContain("a significant increase"); // the whole record
    const rising = c.quiz!(makeView("Niamey", "PRECTOTCORR", { PRECTOTCORR: trendGrid(0.5) }, { ...FULL, y1: 2000 }))!;
    expect(rising.correct).toBe(0);
  });
});

describe("aral-around", () => {
  const c = byId("aral-around");
  const SUN = "ALLSKY_SFC_SW_DWN";
  const onCompare = (point: number, areaMean: number, tab: "region" | "world" = "region") => ({
    ...makeView("Aral Sea", SUN, { [SUN]: trendGrid(point) }),
    step: "compare" as const,
    whereTab: tab,
    region: { investigationId: 1, variable: SUN, filters: FULL, n: 100, up: 20, down: 80, sigUp: 0, sigDown: 50, areaMean },
  });

  it("needs the Around here map to be open", () => {
    expect(evaluateChallenge(c, makeView("Aral Sea", SUN, {})).tasks).toEqual([true, true, false]);
    expect(evaluateChallenge(c, onCompare(-0.9, -0.2, "world")).ready).toBe(false);
    expect(evaluateChallenge(c, onCompare(-0.9, -0.2)).ready).toBe(true);
  });

  it("compares the point with the area mean", () => {
    expect(c.quiz!(onCompare(-0.9, -0.2))!.correct).toBe(0);
    expect(c.quiz!(onCompare(-0.9, -0.8))!.correct).toBe(1);
    expect(c.quiz!(onCompare(-0.2, -0.9))!.correct).toBe(2);
    expect(c.quiz!(onCompare(0.9, -0.2))!.correct).toBe(0);
  });

  it("has no question before the area has loaded", () => {
    expect(c.quiz!({ ...onCompare(-0.9, -0.2), region: null })).toBeNull();
  });
});

describe("pole-to-pole", () => {
  const c = byId("pole-to-pole");
  const preset = (name: string) => PRESETS.find((p) => p.name === name)!;
  /** Places on the comparison, as [name, rate]; sorted fastest first like the real one. */
  const world = (entries: Array<[string, number]>) => ({
    ...makeView("Yakutsk", "T2M", {}),
    step: "compare" as const,
    whereTab: "world" as const,
    world: {
      investigationId: 1,
      variable: "T2M",
      filters: FULL,
      places: entries
        .map(([name, r]) => ({ name, lat: preset(name).lat, lon: preset(name).lon, perDecade: r, significant: true, isCurrent: name === "Yakutsk" }))
        .sort((a, b) => b.perDecade - a.perDecade),
    },
  });
  const FOUR: Array<[string, number]> = [["Yakutsk", 0.6], ["Manaus", 0.3], ["Antarctic Peninsula", 0.2], ["Equatorial Pacific", 0.1]];

  it("is a Master challenge", () => {
    expect(c.level).toBe("master");
  });

  it("needs the four places on the comparison", () => {
    expect(evaluateChallenge(c, world(FOUR.slice(0, 3))).tasks).toEqual([true, true, true, false]);
    expect(evaluateChallenge(c, world([...FOUR, ["Svalbard", 0.9]])).ready).toBe(true);
    // Investigating somewhere else does not count, even with all four saved.
    expect(evaluateChallenge(c, { ...world(FOUR), place: placeFromPreset(preset("Svalbard")) }).tasks[0]).toBe(false);
  });

  it("finds renamed saved places by position", () => {
    const renamed = world(FOUR);
    renamed.world.places = renamed.world.places.map((p) => (p.name === "Manaus" ? { ...p, name: "My rainforest" } : p));
    expect(evaluateChallenge(c, renamed).ready).toBe(true);
    // Options use the name shown on the bars.
    expect(c.quiz!(renamed)!.options.join()).toContain("My rainforest");
  });

  it("asks for the order of the four, ignoring other places", () => {
    const quiz = c.quiz!(world([...FOUR, ["Svalbard", 0.9], ["Delhi", 0.25]]))!;
    expect(quiz.options).toHaveLength(4);
    expect(new Set(quiz.options).size).toBe(4);
    expect(quiz.options[quiz.correct]).toBe("Yakutsk › Manaus › Antarctic Peninsula › Equatorial Pacific");
    expect(quiz.options.join()).not.toContain("Svalbard");
  });
});

describe("record-hunt", () => {
  const c = byId("record-hunt");

  it("needs a point that is not a preset and fast, significant warming", () => {
    expect(evaluateChallenge(c, makeView("Svalbard", "T2M", { T2M: trendGrid(1) })).tasks).toEqual([false, false, false]);
    expect(evaluateChallenge(c, makeView(null, "T2M", { T2M: trendGrid(FAST_WARMING / 2) })).tasks).toEqual([true, true, false]);
    expect(evaluateChallenge(c, makeView(null, "T2M", { T2M: trendGrid(1) })).ready).toBe(true);
  });

  it("scores the warming rate", () => {
    expect(c.score!.value(makeView(null, "T2M", { T2M: trendGrid(1) }))).toBeCloseTo(1, 1);
    expect(c.score!.value(makeView(null, "T2M", { T2M: trendGrid(0, 1) }))).toBeNull();
  });
});

describe("progress", () => {
  it("parses stored progress defensively", () => {
    expect(parseProgress(null)).toEqual({ done: [], best: {}, bestAt: {} });
    expect(parseProgress("not json")).toEqual({ done: [], best: {}, bestAt: {} });
    expect(parseProgress('{"done":["a","a",3],"best":{"a":1.5,"b":"x"}}')).toEqual({ done: ["a"], best: { a: 1.5 }, bestAt: {} });
    expect(parseProgress('{"done":[],"best":{"a":1.5},"bestAt":{"a":{"name":"Yakutsk","lat":62,"lon":129.7},"b":{"name":"x","lat":0,"lon":0}}}').bestAt).toEqual({
      a: { name: "Yakutsk", lat: 62, lon: 129.7 },
    });
  });

  it("completes once and keeps the best score", () => {
    const p = withCompleted(withCompleted({ done: [], best: {}, bestAt: {} }, "a"), "a");
    expect(p.done).toEqual(["a"]);
    const yakutsk = { name: "Yakutsk", lat: 62, lon: 129.7 };
    const scored = withScore(withScore(withScore(p, "a", 0.7, yakutsk), "a", 0.5, { name: "Lima", lat: -12, lon: -77 }), "a", 0.9);
    expect(scored.best.a).toBe(0.9);
    expect(scored.bestAt.a).toBeUndefined(); // the new record has no place: don't keep the old one
    expect(withScore(p, "a", 0.7, yakutsk).bestAt.a).toEqual(yakutsk);
  });
});

describe("challenge places", () => {
  const c = byId("arctic-rate");
  const at = (lat: number, lon: number, name = "Selected point", region = "") => ({ ...makeView("Svalbard", "T2M", {}), place: { lat, lon, name, region, tag: null } });

  it("counts any nearby point, however it was chosen", () => {
    expect(evaluateChallenge(c, at(78.2, 15.7, "Longyearbyen", "Svalbard, Norway")).ready).toBe(true);
    expect(evaluateChallenge(c, at(78.9, 12.0)).ready).toBe(true);
  });

  it("counts a farther point named after the place", () => {
    expect(evaluateChallenge(c, at(79.8, 22.0)).ready).toBe(false);
    expect(evaluateChallenge(c, at(79.8, 22.0, "Nordaustlandet", "Svalbard, Norway")).ready).toBe(true);
  });

  it("does not count other places", () => {
    expect(evaluateChallenge(c, at(69.6, 18.9, "Tromsø", "Norway")).ready).toBe(false);
  });

  it("matches names without accents", () => {
    const sp = byId("day-or-night");
    expect(evaluateChallenge(sp, { ...at(-22.0, -48.5, "Sao Paulo", "Brazil") }).ready).toBe(true);
  });

  it("offers a shortcut to every place it asks for", () => {
    for (const ch of CHALLENGES) for (const t of ch.tasks) if (t.label.startsWith("Investigate")) expect(t.place).toBeTruthy();
  });
});
