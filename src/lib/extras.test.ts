import { describe, expect, it } from "vitest";
import spec from "../../scripts/extras/datasets.json";
import { ALL_VARIABLES, FIRST_YEAR, HINTS, THEMES, VARIABLES, VARIABLE_BY_ID } from "../config/catalog";
import { EXTRA_VARIABLES } from "../config/extraVariables";
import { rankVariables, scanVariables } from "./clues";
import { fromFile, hasExtras, toGrid, type ExtrasFile } from "./extras";

const FULL = { y0: FIRST_YEAR, y1: 2024, season: "year" };

describe("extra variables catalog", () => {
  it("matches the download spec one to one", () => {
    expect(EXTRA_VARIABLES.map((v) => v.id).sort()).toEqual(Object.keys(spec.variables).sort());
  });

  it("does not reuse a NASA POWER id, and every variable has a known theme", () => {
    const power = new Set(VARIABLES.map((v) => v.id));
    for (const v of EXTRA_VARIABLES) {
      expect(power.has(v.id), v.id).toBe(false);
      for (const t of v.themes) expect(THEMES.some((x) => x.id === t), `${v.id} → ${t}`).toBe(true);
    }
    expect(new Set(ALL_VARIABLES.map((v) => v.id)).size).toBe(ALL_VARIABLES.length);
  });

  it("hints only name variables that exist", () => {
    for (const ids of Object.values(HINTS)) for (const id of ids) expect(VARIABLE_BY_ID[id], id).toBeDefined();
  });
});

describe("stored files", () => {
  const file: ExtrasFile = {
    place: "Manaus",
    lat: -3.1,
    lon: -60,
    generated: "2026-11-15",
    series: {
      NDVI: {
        origin: 2001,
        // A slow greening with a seasonal cycle, 2001–2024.
        values: Array.from({ length: 24 }, (_, y) => Array.from({ length: 12 }, (_, m) => 0.7 + y * 0.004 + 0.05 * Math.sin(m))),
        source: "MOD13Q1.061 _250m_16_days_NDVI via NASA AppEEARS",
      },
      OLD: { origin: 1970, values: [[1], [2]], source: null },
    },
    missing: { CHLOR_A: "ocean variable" },
  };

  it("aligns the series with the NASA POWER grid (row 0 = FIRST_YEAR) and drops years before it", () => {
    const grid = toGrid(file.series.NDVI);
    expect(grid[2001 - FIRST_YEAR]?.[0]).toBeCloseTo(0.7, 6);
    expect(grid[0]).toBeUndefined();
    expect(toGrid(file.series.OLD).filter(Boolean)).toHaveLength(0);
  });

  it("goes through the same trend analysis as the other variables", () => {
    const { data, sources } = fromFile(file);
    expect(sources.NDVI).toMatch(/AppEEARS/);
    const variables = [...VARIABLES, VARIABLE_BY_ID.NDVI];
    const scan = scanVariables(data, FULL, variables);
    const ndvi = scan.NDVI;
    expect(ndvi.ok && ndvi.years[0]).toBe(2001);
    expect(ndvi.ok && ndvi.direction).toBe(1);
    expect(rankVariables(scan, variables)[0].id).toBe("NDVI");
  });

  it("is only looked up for the featured places", () => {
    expect(hasExtras(-3.2, -60)).toBe(false);
  });
});

describe("stored index", () => {
  it("only names catalog variables, and every listed place has its file", async () => {
    const index = (await import("../data/extras-index.json")).default.places as Record<string, string[]>;
    const files = import.meta.glob("../data/extras/*.json");
    for (const [key, ids] of Object.entries(index)) {
      if (ids.length) expect(files[`../data/extras/${key}.json`], key).toBeDefined();
      for (const id of ids) expect(EXTRA_VARIABLES.some((v) => v.id === id), id).toBe(true);
    }
  });
});
