import { describe, expect, it } from "vitest";
import spec from "./datasets.json";
import presets from "../../src/config/presets.json";
import {
  cleanSamples,
  gridToCsv,
  isFill,
  monthlyGrid,
  parseAppeearsCsv,
  parseGiovanniCsv,
  placeFileName,
  readNetrc,
  samplePoints,
  sumGrids,
  transformGrid,
  usableYears,
} from "./lib.mjs";

// Synthetic files that mimic each service's layout (values are made up).
const APPEEARS = `ID,Category,Latitude,Longitude,Date,MODIS_Tile,MOD13Q1_061_Line_Y_250m,MOD13Q1_061_Sample_X_250m,MOD13Q1_061__250m_16_days_NDVI,MOD13Q1_061__250m_16_days_pixel_reliability
-3.1_-60#0,-3.1_-60,-3.105,-60.005,2001-01-01,h12v09,10,20,0.8,0
-3.1_-60#1,-3.1_-60,-3.105,-60.0,2001-01-01,h12v09,10,21,0.6,1
-3.1_-60#2,-3.1_-60,-3.105,-59.995,2001-01-17,h12v09,10,22,0.2,3
13.5_2.1#0,13.5_2.1,13.495,2.095,2001-01-01,h18v07,1,2,-0.3,-1
13.5_2.1#0,13.5_2.1,13.495,2.095,2001-02-02,h18v07,1,2,0.3,0
`;

const GIOVANNI = `prod_name,OMNO2d_003
param_name,ColumnAmountNO2TropCloudScreened
unit_of_measure,1/cm2
begin_time,2005-01-01T00:00:00
end_time,2005-02-28T23:59:59
lat,28.6
lon,77.2
undef,-1.2676506E30
Timestamp (UTC),Data
2005-01-01T00:00:00,1.0e15
2005-01-02T00:00:00,3.0e15
2005-01-03T00:00:00,-1.2676506E30
2005-02-01T00:00:00,
2005-02-02T00:00:00,2.0e15
`;

describe("AppEEARS point files", () => {
  it("groups samples by place and keeps the QA value", () => {
    const out = parseAppeearsCsv(APPEEARS, "MOD13Q1.061", "_250m_16_days_NDVI", "_250m_16_days_pixel_reliability");
    expect(Object.keys(out)).toEqual(["-3.1_-60", "13.5_2.1"]);
    expect(out["-3.1_-60"]).toHaveLength(3);
    expect(out["-3.1_-60"][2]).toEqual({ date: "2001-01-17", value: 0.2, qa: 3 });
  });

  it("drops cloudy pixels and fill values, then averages per month", () => {
    const v = spec.variables.NDVI;
    const raw = parseAppeearsCsv(APPEEARS, v.product, v.layer, v.qa.layer);
    const manaus = monthlyGrid(cleanSamples(raw["-3.1_-60"], v));
    expect(manaus).toEqual({ origin: 2001, values: [[0.7, null, null, null, null, null, null, null, null, null, null, null]] });
    const niamey = monthlyGrid(cleanSamples(raw["13.5_2.1"], v));
    expect(niamey.values[0].slice(0, 2)).toEqual([null, 0.3]);
  });

  it("fails clearly when the layer is not in the file", () => {
    expect(() => parseAppeearsCsv(APPEEARS, "MOD13Q1.061", "_250m_16_days_EVI")).toThrow(/EVI/);
  });
});

describe("Giovanni time-series answers", () => {
  it("reads the metadata and the rows, dropping the declared fill value and blanks", () => {
    const { meta, samples } = parseGiovanniCsv(GIOVANNI);
    expect(meta.unit_of_measure).toBe("1/cm2");
    expect(samples.map((s) => s.date)).toEqual(["2005-01-01", "2005-01-02", "2005-02-02"]);
  });

  it("averages daily values into months with the unit conversion", () => {
    const { samples } = parseGiovanniCsv(GIOVANNI);
    const grid = monthlyGrid(cleanSamples(samples, spec.variables.NO2));
    expect(grid.values[0].slice(0, 2)).toEqual([2, 2]);
  });

  it("reports an answer without a data table", () => {
    expect(() => parseGiovanniCsv('{"code":"","message":""}')).toThrow(/No data table/);
  });

  it("recognises fill values written with rounding", () => {
    expect(isFill(-1.26765e30, [-1.2676506e30])).toBe(true);
    expect(isFill(-9999)).toBe(true);
    expect(isFill(-0.5e14)).toBe(false);
  });
});

describe("categorical layers become percentages", () => {
  it("burned area: share of valid samples that burned", () => {
    const samples = [0, 0, 120, -1, -2].map((value) => ({ date: "2010-09-01", value }));
    const grid = monthlyGrid(cleanSamples(samples, spec.variables.BURNED_AREA));
    expect(grid.values[0][8]).toBeCloseTo(33.333, 2);
  });

  it("snow: clouds and night are ignored", () => {
    const samples = [25, 200, 200, 50, 11].map((value) => ({ date: "2010-01-09", value }));
    const grid = monthlyGrid(cleanSamples(samples, spec.variables.SNOW_COVER));
    expect(grid.values[0][0]).toBeCloseTo(66.667, 2);
  });

  it("land surface temperature in °C, cloud-top temperature only converted when in kelvin", () => {
    expect(cleanSamples([{ date: "2010-01-01", value: 300 }], spec.variables.LST_DAY)[0].value).toBeCloseTo(26.85, 5);
    expect(cleanSamples([{ date: "2010-01-01", value: 0 }], spec.variables.LST_DAY)).toEqual([]);
    expect(cleanSamples([{ date: "2010-01-01", value: 250 }], spec.variables.CLOUD_TOP_T)[0].value).toBeCloseTo(-23.15, 5);
    expect(cleanSamples([{ date: "2010-01-01", value: -23 }], spec.variables.CLOUD_TOP_T)[0].value).toBe(-23);
    const ppb = { ppbIfBelow: 0.001 };
    expect(cleanSamples([{ date: "2010-01-01", value: 1.9e-6 }], ppb)[0].value).toBeCloseTo(1900, 6);
    expect(cleanSamples([{ date: "2010-01-01", value: 1900 }], ppb)[0].value).toBe(1900);
  });
});

describe("grids", () => {
  it("copies yearly products to every month", () => {
    const grid = monthlyGrid([{ date: "2003-03-06", value: 80 }, { date: "2004-03-06", value: 78 }], { annual: true });
    expect(grid.origin).toBe(2003);
    expect(grid.values[1]).toEqual(new Array(12).fill(78));
  });

  it("ignores years after the last complete one", () => {
    expect(monthlyGrid([{ date: "2030-01-01", value: 1 }], { lastYear: 2025 })).toBeNull();
  });

  it("adds components with weights, only where all of them have data", () => {
    const a = { origin: 2000, values: [[1, 1, null, ...new Array(9).fill(1)], new Array(12).fill(1)] };
    const b = { origin: 2001, values: [new Array(12).fill(2)] };
    const sum = sumGrids([a, b], [1, 0.5]);
    expect(sum).toEqual({ origin: 2001, values: [new Array(12).fill(2)] });
    expect(transformGrid(sum, { multiply: 1e9 }).values[0][0]).toBe(2e9);
    expect(sumGrids([a, null])).toBeNull();
  });

  it("writes monthly means that read back as the same grid", () => {
    const hourly = [1, 3, 5].map((value, h) => ({ date: `2011-02-0${h + 1}`, value }));
    const grid = monthlyGrid(hourly);
    const back = monthlyGrid(parseGiovanniCsv(gridToCsv(grid, { unit: "kg m-3" })).samples);
    expect(back).toEqual(grid);
    expect(back.values[0][1]).toBe(3);
  });

  it("counts usable years like the app does", () => {
    const full = new Array(12).fill(1);
    expect(usableYears({ origin: 2000, values: [full, full, full, [1, 1, 1, ...new Array(9).fill(null)]] })).toBe(3);
    // No winter data at all (polar night): the summer months alone make a year usable.
    const summer = [null, null, null, 1, 1, 1, 1, 1, 1, null, null, null];
    expect(usableYears({ origin: 2000, values: [summer, summer, summer, summer] })).toBe(4);
  });

  it("keeps tiny values such as mass concentrations in kg/m³", () => {
    expect(monthlyGrid([{ date: "2010-01-01", value: 2.345e-9 }]).values[0][0]).toBe(2.345e-9);
  });
});

describe("places and credentials", () => {
  it("samples a square around the place", () => {
    const pts = samplePoints({ lat: -3.1, lon: -60 }, spec.samplers.local);
    expect(pts).toHaveLength(9);
    expect(pts[4]).toEqual({ latitude: -3.1, longitude: -60 });
    expect(samplePoints({ lat: 0, lon: 0 }, spec.samplers.regional)).toHaveLength(25);
  });

  it("names the files by coordinates, one per featured place", () => {
    expect(placeFileName(presets[0])).toBe("-3.1_-60.json");
    expect(new Set(presets.map(placeFileName)).size).toBe(presets.length);
  });

  it("reads Earthdata credentials from a .netrc", () => {
    const text = "machine example.org login a password b\nmachine urs.earthdata.nasa.gov\n  login me\n  password secret\n";
    expect(readNetrc(text, "urs.earthdata.nasa.gov")).toEqual({ username: "me", password: "secret" });
    expect(readNetrc(text, "other.host")).toBeNull();
  });
});
