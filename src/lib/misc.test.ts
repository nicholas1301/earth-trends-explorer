import { describe, expect, it } from "vitest";
import { FIRST_YEAR, LAST_YEAR } from "../config/catalog";
import { initialState, reducer } from "../state/reducer";
import { isLand } from "./geo";
import { niceTicks } from "./ticks";
import { readHash } from "./urlHash";

describe("isLand", () => {
  it.each([
    ["Manaus", -3.1, -60.0, true],
    ["Sahara", 22.8, 5.5, true],
    ["Svalbard", 78.2, 15.6, true],
    ["Equatorial Pacific", 0, -150, false],
    ["South Atlantic", -30, -20, false],
    ["Antarctic interior", -85, 0, true],
    ["Chukotka (east of 180°)", 66, -175, true],
    ["Bering Sea", 58, -178, false],
  ])("%s", (_, lat, lon, expected) => expect(isLand(lat as number, lon as number)).toBe(expected));
});

describe("niceTicks", () => {
  it("produces round steps", () => {
    expect(niceTicks(0, 10, 5)).toEqual({ values: [0, 2, 4, 6, 8, 10], step: 2 });
  });
});

describe("readHash", () => {
  it("parses a shared link and validates fields", () => {
    const s = readHash("#lat=-3.1&lon=-60&v=T2M&t=water&y0=1990&y1=2010&s=djf");
    expect(s).toMatchObject({ lat: -3.1, lon: -60, variable: "T2M", theme: "water", filters: { y0: 1990, y1: 2010, season: "djf" } });
  });

  it("ignores invalid values", () => {
    const s = readHash("#lat=1&lon=2&v=NOPE&t=nope&y0=2000&y1=2003");
    expect(s).toMatchObject({ variable: null, theme: null, filters: {} });
    expect(readHash("#foo=1")).toBeNull();
  });
});

describe("reducer filters", () => {
  it("keeps at least a 10-year window when editing one bound", () => {
    const s = reducer(initialState, { type: "setFilters", filters: { y0: LAST_YEAR } });
    expect(s.filters.y0).toBe(LAST_YEAR - 9);
    const t = reducer(initialState, { type: "setFilters", filters: { y1: FIRST_YEAR } });
    expect(t.filters.y1).toBe(FIRST_YEAR + 9);
  });

  it("resets the neighbourhood/world panels when the variable changes", () => {
    let s = reducer({ ...initialState, variable: "T2M" }, { type: "request", what: "region" });
    expect(s.regionRequested).toBe(true);
    s = reducer(s, { type: "selectVariable", variable: "T2M" });
    expect(s.regionRequested).toBe(true);
    s = reducer(s, { type: "selectVariable", variable: "TS" });
    expect(s.regionRequested).toBe(false);
  });
});
