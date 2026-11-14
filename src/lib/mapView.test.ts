import { describe, expect, it } from "vitest";
import { MAP_H, MAP_W, centeredOn, homeView, initialView, invert, isVisible, makeProjection, pan, switchMode, zoomAt, wrapLon } from "./mapView";

const MID = [MAP_W / 2, MAP_H / 2] as const;

describe("projection round trip", () => {
  it.each(["globe", "flat"] as const)("%s: invert(project(p)) ≈ p", (mode) => {
    const v = initialView(mode, { lat: 10, lon: 20 });
    const proj = makeProjection(v);
    for (const [lon, lat] of [[20, 10], [40, -20], [0, 45]]) {
      const [x, y] = proj([lon, lat])!;
      const g = invert(v, x, y)!;
      expect(g.lon).toBeCloseTo(lon, 6);
      expect(g.lat).toBeCloseTo(lat, 6);
    }
  });

  it("returns null off the globe", () => {
    expect(invert(initialView("globe"), 2, 2)).toBeNull();
  });
});

describe("view operations", () => {
  it("centres the globe on a point", () => {
    const v = centeredOn(initialView("globe"), { lat: -3.1, lon: -60 });
    const g = invert(v, ...MID)!;
    expect(g.lat).toBeCloseTo(-3.1, 6);
    expect(g.lon).toBeCloseTo(-60, 6);
  });

  it("centres the flat map on a point when zoomed", () => {
    const v = centeredOn(initialView("flat"), { lat: 40, lon: 116 }, 4);
    const g = invert(v, ...MID)!;
    expect(g.lat).toBeCloseTo(40, 4);
    expect(g.lon).toBeCloseTo(116, 4);
  });

  it("zooms around the cursor, keeping the point under it", () => {
    for (const mode of ["globe", "flat"] as const) {
      const v = initialView(mode, { lat: 0, lon: 0 });
      const before = invert(v, 360, 120)!;
      const after = invert(zoomAt(v, 3, 360, 120), 360, 120)!;
      expect(after.lat).toBeCloseTo(before.lat, 2);
      expect(after.lon).toBeCloseTo(before.lon, 2);
    }
  });

  it("limits zoom to [1, 12]", () => {
    expect(zoomAt(initialView("globe"), 0.5)).toEqual(initialView("globe"));
    expect(zoomAt(initialView("globe"), 100).k).toBe(12);
  });

  it("rotates the globe when dragging and hides the far side", () => {
    const v = pan(initialView("globe", { lat: 0, lon: 0 }), 100, 0);
    expect(v.lon0).toBeLessThan(0);
    expect(isVisible(v, { lat: 0, lon: v.lon0 + 180 })).toBe(false);
    expect(isVisible(v, { lat: 0, lon: v.lon0 })).toBe(true);
  });

  it("does not pan the unzoomed flat map off screen (only a small margin)", () => {
    const v = pan(initialView("flat"), 500, 500);
    expect(Math.abs(v.px)).toBeLessThanOrEqual(30);
    expect(Math.abs(v.py)).toBeLessThanOrEqual(30);
  });

  it("keeps the centre when switching from flat to globe, and resets home", () => {
    const flat = centeredOn(initialView("flat"), { lat: 20, lon: 80 }, 3);
    const globe = switchMode(flat, "globe");
    expect(globe).toMatchObject({ mode: "globe", k: 1 });
    expect(globe.lon0).toBeCloseTo(80, 3);
    expect(homeView({ ...globe, k: 5 }, { lat: -10, lon: 30 })).toMatchObject({ k: 1, lon0: 30, lat0: -10 });
  });

  it("wraps longitudes", () => {
    expect(wrapLon(190)).toBe(-170);
    expect(wrapLon(-181)).toBe(179);
  });
});
