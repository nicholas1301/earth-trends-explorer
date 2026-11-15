import { describe, expect, it } from "vitest";
import { MAX_SAVED_PLACES, defaultSavedPlaces, parseSavedPlaces, withName, withPlace, withoutPlace } from "./savedPlaces";
import { isRenamable } from "./places";

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

  it("numbers repeated names and keeps custom names", () => {
    const raw = JSON.stringify([{ ...recife, customName: true }, { ...recife, lat: 1 }]);
    expect(parseSavedPlaces(raw)!.map((p) => [p.name, p.customName])).toEqual([["Recife", true], ["Recife 2", undefined]]);
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

describe("unique names", () => {
  const point = (lat: number, name = "Selected point") => ({ lat, lon: 0, name, region: "", tag: null });

  it("numbers a new place whose name is already saved", () => {
    const list = withPlace(withPlace(withPlace([], point(1)), point(2)), point(3, "selected POINT"));
    expect(list.map((p) => p.name)).toEqual(["Selected point", "Selected point 2", "selected POINT 3"]);
  });

  it("renames a place and refuses empty or repeated names", () => {
    const list = [point(1), point(2, "Your location"), recife];
    const next = withName(list, point(1), "  My   farm ");
    expect(next).toEqual([{ ...point(1, "My farm"), customName: true }, list[1], recife]);
    expect(withName(list, point(1), "   ")).toBe("empty");
    expect(withName(list, point(1), "recife")).toBe("taken");
    expect(withName(list, recife, "Recife")).not.toBe("taken"); // its own name
  });

  it("only offers renaming for unnamed or already renamed places", () => {
    expect(isRenamable(point(1))).toBe(true);
    expect(isRenamable(point(1, "Your location 2"))).toBe(true);
    expect(isRenamable(recife)).toBe(false);
    expect(isRenamable({ ...recife, customName: true })).toBe(true);
  });
});
