import { describe, expect, it } from "vitest";
import { MAX_SAVED_PLACES, defaultSavedPlaces, parseSavedPlaces, withPlace, withoutPlace } from "./savedPlaces";

const recife = { lat: -8.1, lon: -34.9, name: "Recife", region: "Pernambuco, Brazil", tag: null };

describe("parseSavedPlaces", () => {
  it("returns null when nothing usable is stored", () => {
    expect(parseSavedPlaces(null)).toBeNull();
    expect(parseSavedPlaces("not json")).toBeNull();
    expect(parseSavedPlaces('{"a":1}')).toBeNull();
  });

  it("keeps an empty list (the user removed everything)", () => {
    expect(parseSavedPlaces("[]")).toEqual([]);
  });

  it("drops invalid entries and duplicates", () => {
    const raw = JSON.stringify([recife, { ...recife, name: "Dup" }, { lat: 200, lon: 0, name: "x", region: "", tag: null }, { name: "no coords" }]);
    expect(parseSavedPlaces(raw)).toEqual([recife]);
  });
});

describe("withPlace / withoutPlace", () => {
  it("adds once and removes by coordinates", () => {
    const list = withPlace(withPlace([], recife), recife);
    expect(list).toHaveLength(1);
    expect(withoutPlace(list, { lat: -8.1, lon: -34.9 })).toEqual([]);
  });

  it("stops at the maximum", () => {
    const full = Array.from({ length: MAX_SAVED_PLACES }, (_, i) => ({ ...recife, lat: i }));
    expect(withPlace(full, recife)).toBe(full);
  });

  it("defaults to the presets", () => {
    expect(defaultSavedPlaces()[0].name).toBe("Manaus");
  });
});
