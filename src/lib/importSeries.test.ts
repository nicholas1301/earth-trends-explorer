import { describe, expect, it } from "vitest";
import IMERG_CSV from "./fixtures/giovanni_imerg_manaus.csv?raw";
import MODIS_AOD_CSV from "./fixtures/giovanni_modis_aod_manaus.csv?raw";
import { analyzeTrend } from "./trend";
import { ImportError, parseDate, parseTable, suggestDigits, toMonthlyGrid } from "./importSeries";

// Small synthetic files that mimic the layout of each tool's export (values are made up for the tests).

const GIOVANNI = `Title:,"Time Series, Area-Averaged of Merged satellite-gauge precipitation estimate - Final Run (recommended for general use) monthly 0.1 deg. [GPM GPM_3IMERGM v07] mm/day over 2001-01 - 2002-12, Region 60.5W, 3.6S, 59.5W, 2.6S"
User Start Date:,2001-01-01T00:00:00Z
User End Date:,2002-12-31T23:59:59Z
Bounding Box:,"-60.5,-3.6,-59.5,-2.6"
Fill Value (GPM_3IMERGM_07_precipitation):,-9999.9

time,mean_GPM_3IMERGM_07_precipitation
${Array.from({ length: 24 }, (_, i) => `${2001 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01 00:00:00,${i === 5 ? "-9999.9" : (5 + i * 0.01).toFixed(3)}`).join("\n")}
`;

const APPEEARS = `ID,Category,Latitude,Longitude,Date,MODIS_Tile,MOD13Q1_061_Line_Y_250m,MOD13Q1_061_Sample_X_250m,MOD13Q1_061__250m_16_days_NDVI,MOD13Q1_061__250m_16_days_pixel_reliability
1,amazon,-3.1,-60.0,2001-01-01,h11v09,100,200,0.81,0
1,amazon,-3.1,-60.0,2001-01-17,h11v09,100,200,0.85,0
1,amazon,-3.1,-60.0,2001-02-02,h11v09,100,200,0.79,1
1,amazon,-3.1,-60.0,2001-02-18,h11v09,100,200,0.83,0
1,amazon,-3.1,-60.0,2001-03-06,h11v09,100,200,0.80,0
1,amazon,-3.1,-60.0,2001-03-22,h11v09,100,200,0.82,0
`;

const CDO = `"STATION","NAME","DATE","PRCP","TAVG"
"BR000082331","MANAUS, BR","1979-01","300.1","26.1"
"BR000082331","MANAUS, BR","1979-02","310.4","26.0"
"BR000082331","MANAUS, BR","1979-03","330.0","26.2"
"BR000082332","OTHER, BR","1979-01","100.0","20.0"
"BR000082332","OTHER, BR","1979-02","110.0","20.5"
"BR000082332","OTHER, BR","1979-03","120.0","",
`;

const KNMI = `# made with climexp.knmi.nl
# Tmean [Celsius] mean temperature
${Array.from({ length: 12 }, (_, y) => [1960 + y, ...Array.from({ length: 12 }, (_, m) => (20 + m * 0.1 + y * 0.05).toFixed(2))].join("  ")).join("\n")}
1972  20.1 -999.9 ${Array.from({ length: 10 }, () => "-999.9").join(" ")}
`;

const DATA_RODS = `prod_name=GLDAS_NOAH025_M_v2.1
param_short_name=SoilMoi0_10cm_inst
unit=kg/m^2
location=GEOM:POINT(-60.0, -3.1)
Date&Time Data
2000-01-01T00:00:00\t31.5
2000-02-01T00:00:00\t32.0
2000-03-01T00:00:00\t33.1
2000-04-01T00:00:00\t32.7
`;

describe("parseDate", () => {
  it("reads the date styles of the supported tools", () => {
    expect(parseDate("2001-03-01 00:00:00")).toEqual({ year: 2001, month: 2 });
    expect(parseDate("2001-03-01T00:00:00Z")).toEqual({ year: 2001, month: 2 });
    expect(parseDate("1979-12")).toEqual({ year: 1979, month: 11 });
    expect(parseDate("20010315")).toEqual({ year: 2001, month: 2 });
    expect(parseDate("2001/3/15")).toEqual({ year: 2001, month: 2 });
  });

  it("rejects numbers that are not dates", () => {
    expect(parseDate("25.3")).toBeNull();
    expect(parseDate("2001")).toBeNull();
    expect(parseDate("2001-13")).toBeNull();
  });
});

describe("parseTable", () => {
  it("reads a Giovanni area-averaged time series with its metadata", () => {
    const t = parseTable(GIOVANNI);
    expect(t.source).toBe("giovanni");
    expect(t.columns).toEqual(["mean_GPM_3IMERGM_07_precipitation"]);
    expect(t.rows).toHaveLength(24);
    expect(t.fillValues).toContain(-9999.9);
    expect(t.unit).toBe("mm/day");
    expect(t.region).toBe("60.5W, 3.6S, 59.5W, 2.6S");
    expect(t.title).toMatch(/^Merged satellite-gauge precipitation estimate/);
    const s = toMonthlyGrid(t, { column: 0 });
    expect(s.origin).toBe(2001);
    expect(s.grid[0]![5]).toBeNull(); // fill value
    expect(s.months).toBe(23);
  });

  it("reads an AppEEARS point sample, picking the data layer and averaging 16-day composites", () => {
    const t = parseTable(APPEEARS);
    expect(t.source).toBe("appeears");
    expect(t.columns[t.defaultColumn]).toBe("MOD13Q1_061__250m_16_days_NDVI");
    expect(t.subMonthly).toBe(true);
    const s = toMonthlyGrid(t, { column: t.defaultColumn });
    expect(s.grid[0]![0]).toBeCloseTo(0.83, 6);
    expect(s.grid[0]![1]).toBeCloseTo(0.81, 6);
  });

  it("reads NOAA CDO monthly summaries and splits them by station", () => {
    const t = parseTable(CDO);
    expect(t.source).toBe("cdo");
    expect(t.groupColumn).toBe("STATION");
    expect(t.groups).toEqual(["BR000082331", "BR000082332"]);
    expect(t.columns).toEqual(["PRCP", "TAVG"]);
    const s = toMonthlyGrid(t, { column: 1, group: "BR000082332" });
    expect(s.origin).toBe(1979);
    expect(s.grid[0]!.slice(0, 3)).toEqual([20, 20.5, null]);
  });

  it("reads a KNMI Climate Explorer year × 12 months table, before 1981 too", () => {
    const t = parseTable(KNMI);
    expect(t.source).toBe("knmi");
    expect(t.unit).toBe("Celsius");
    expect(t.title).toBe("mean temperature");
    const s = toMonthlyGrid(t, { column: 0 });
    expect(s.origin).toBe(1960);
    expect(s.lastYear).toBe(1972);
    expect(s.grid[12]![1]).toBeNull();
    const r = analyzeTrend(s.grid, 1960, 1971, Array.from({ length: 12 }, (_, i) => i), s.origin);
    if (!r.ok) throw new Error("expected ok");
    expect(r.years[0]).toBe(1960);
    expect(r.mk.sen).toBeCloseTo(0.05, 6);
  });

  it("reads the legacy Data Rods ASCII format", () => {
    const t = parseTable(DATA_RODS);
    expect(t.source).toBe("datarods");
    expect(t.unit).toBe("kg/m^2");
    expect(t.rows).toHaveLength(4);
    expect(toMonthlyGrid(t, { column: 0 }).grid[0]![2]).toBe(33.1);
  });

  it("reads a plain year, month, value table", () => {
    const t = parseTable("year month value\n1990 1 3.5\n1990 2 3.7\n1990 3 3.9\n1990 4 4.1\n");
    expect(t.columns).toEqual(["value"]);
    expect(toMonthlyGrid(t, { column: 0 }).grid[0]!.slice(0, 4)).toEqual([3.5, 3.7, 3.9, 4.1]);
  });

  it("explains what is missing when no dates are found", () => {
    expect(() => parseTable("a,b\n1,2\n3,4\n")).toThrow(ImportError);
  });
});

// Real exports downloaded from Giovanni (November 2026): monthly GPM IMERG rain and MODIS-Terra AOD around Manaus.

describe("real Giovanni exports", () => {
  it("reads the GPM IMERG CSV", () => {
    const t = parseTable(IMERG_CSV);
    expect(t.source).toBe("giovanni");
    expect(t.columns).toEqual(["mean_GPM_3IMERGM_07_precipitation"]);
    expect(t.title).toBe("Merged satellite-gauge precipitation estimate - Final Run (recommended for general use)");
    expect(t.region).toBe("3.6°S–2.6°S, 60.5°W–59.5°W");
    expect(t.fillValues).toEqual([-9999.9]);
    const s = toMonthlyGrid(t, { column: 0 });
    expect([s.firstYear, s.lastYear, s.months]).toEqual([2001, 2024, 288]);
    expect(s.grid[0]![0]).toBeCloseTo(0.506976664, 9);
  });

  it("drops the fill values of the MODIS AOD CSV (cloudy months)", () => {
    const t = parseTable(MODIS_AOD_CSV);
    expect(t.fillValues).toEqual([-9999]);
    const s = toMonthlyGrid(t, { column: 0 });
    expect(s.months).toBe(264 - 41);
    expect(s.grid[0]![2]).toBeNull();
  });
});

describe("toMonthlyGrid", () => {
  it("drops months with too few daily observations", () => {
    const days = Array.from({ length: 31 }, (_, d) => `2001-01-${String(d + 1).padStart(2, "0")},1`);
    const text = ["date,v", ...days, "2001-02-01,5", ...Array.from({ length: 28 }, (_, d) => `2001-03-${String(d + 1).padStart(2, "0")},2`)].join("\n");
    const s = toMonthlyGrid(parseTable(text), { column: 0 });
    expect(s.grid[0]!.slice(0, 3)).toEqual([1, null, 2]);
  });

  it("treats user-given codes as missing", () => {
    const t = parseTable("date,v\n2001-01,1\n2001-02,-1\n2001-03,3\n");
    expect(toMonthlyGrid(t, { column: 0, missing: [-1] }).grid[0]!.slice(0, 3)).toEqual([1, null, 3]);
  });
});

describe("suggestDigits", () => {
  it("shows more decimals for smaller variations", () => {
    expect(suggestDigits([[0.81, 0.83, 0.8, 0.85]])).toBe(4);
    expect(suggestDigits([[250, 310, 280, 330]])).toBe(1);
  });
});
