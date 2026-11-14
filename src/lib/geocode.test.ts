import { describe, expect, it } from "vitest";
import { parseNominatimReverse, parsePhoton } from "./geocode";

const feature = (name: string, lon: number, lat: number, extra: Record<string, unknown> = {}) => ({
  geometry: { coordinates: [lon, lat] as [number, number] },
  properties: { name, osm_type: "R", osm_id: Math.round(lat * 1000), ...extra },
});

describe("parsePhoton", () => {
  it("labels results with state and country and removes duplicates", () => {
    const r = parsePhoton({
      features: [
        feature("Campinas", -47.06, -22.9, { osm_value: "city", city: "Campinas", state: "São Paulo", country: "Brazil" }),
        feature("Campinas", -47.06, -22.9, { osm_value: "municipality", state: "São Paulo", country: "Brazil" }),
        feature("Campinas", -38.46, -12.9, { osm_value: "station", city: "Salvador", state: "Bahia", country: "Brazil" }),
      ],
    });
    expect(r.map((x) => [x.name, x.region])).toEqual([
      ["Campinas", "São Paulo, Brazil"],
      ["Campinas", "Bahia, Brazil"],
    ]);
    expect(r[0]).toMatchObject({ lat: -22.9, lon: -47.06, kind: "city" });
  });

  it("uses the admin type for states and countries and skips nameless features", () => {
    const r = parsePhoton({
      features: [
        feature("Minas Gerais", -44.5, -18.5, { osm_value: "administrative", type: "state", country: "Brazil" }),
        { geometry: { coordinates: [0, 0] as [number, number] }, properties: {} },
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: "state", region: "Brazil" });
  });
});

describe("parseNominatimReverse", () => {
  it("names the municipality with state and country", () => {
    expect(
      parseNominatimReverse({ name: "Curvelo", address: { town: "Curvelo", state: "Minas Gerais", region: "Southeast Region", country: "Brazil" } }),
    ).toEqual({ name: "Curvelo", region: "Minas Gerais, Brazil" });
  });

  it("returns null over the ocean", () => {
    expect(parseNominatimReverse({ error: "Unable to geocode" })).toBeNull();
  });
});
