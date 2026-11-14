import { describe, expect, it } from "vitest";
import { mannKendall, median, normalTwoTailedP, ols, studentTwoTailedP, tCritical95 } from "./stats";

describe("distributions", () => {
  it("matches tabulated Student t critical values", () => {
    expect(tCritical95(10)).toBeCloseTo(2.228, 3);
    expect(tCritical95(30)).toBeCloseTo(2.042, 3);
    expect(studentTwoTailedP(2.228, 10)).toBeCloseTo(0.05, 3);
  });

  it("matches the normal distribution", () => {
    expect(normalTwoTailedP(1.96)).toBeCloseTo(0.05, 3);
    expect(normalTwoTailedP(0)).toBeCloseTo(1, 6);
  });
});

describe("median", () => {
  it("handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("ols", () => {
  const x = Array.from({ length: 20 }, (_, i) => 2000 + i);

  it("recovers an exact line", () => {
    const r = ols(x, x.map((v) => 3 + 0.5 * (v - 2000)));
    expect(r.slope).toBeCloseTo(0.5, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });

  it("finds no significant slope in alternating noise", () => {
    const r = ols(x, x.map((_, i) => (i % 2 ? 1 : -1)));
    expect(r.p).toBeGreaterThan(0.05);
    expect(r.lo).toBeLessThan(0);
    expect(r.hi).toBeGreaterThan(0);
  });
});

describe("mannKendall", () => {
  it("scores a strictly increasing series", () => {
    const x = Array.from({ length: 10 }, (_, i) => i);
    const r = mannKendall(x, x.map((v) => 2 * v + 1));
    expect(r.S).toBe(45);
    expect(r.tau).toBe(1);
    expect(r.sen).toBe(2);
    expect(r.senIntercept).toBe(1);
    expect(r.p).toBeLessThan(0.001);
  });

  it("is robust to an outlier", () => {
    const x = Array.from({ length: 15 }, (_, i) => i);
    const y = x.map((v) => v * 0.1);
    y[7] = 50;
    expect(mannKendall(x, y).sen).toBeCloseTo(0.1, 6);
  });
});
