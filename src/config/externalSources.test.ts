import { describe, expect, it } from "vitest";
import { VARIABLE_IDS } from "./catalog";
import { GIOVANNI_MATCHES, giovanniUrl } from "./externalSources";

describe("Giovanni cross-check links", () => {
  it("cover every NASA POWER variable", () => {
    for (const id of VARIABLE_IDS) expect(GIOVANNI_MATCHES[id]?.length, id).toBeGreaterThan(0);
  });

  it("pre-select the variable, the box and the period", () => {
    const url = giovanniUrl(-3.1, -60, 2001, 2020, GIOVANNI_MATCHES.AOD_55[0]);
    expect(url).toBe(
      "https://giovanni.gsfc.nasa.gov/giovanni/#service=ArAvTs&starttime=2001-01-01T00:00:00Z&endtime=2020-12-31T23:59:59Z" +
        "&bbox=-60.5,-3.6,-59.5,-2.6&data=MOD08_M3_6_1_AOD_550_Dark_Target_Deep_Blue_Combined_Mean_Mean" +
        "&dataKeyword=MODIS%20aerosol%20optical%20depth",
    );
  });

  it("fall back to the search alone when there is no stable ID, and clamp the box at the poles", () => {
    const lw = GIOVANNI_MATCHES.ALLSKY_SFC_LW_DWN[0];
    expect(lw.id).toBeUndefined();
    const url = giovanniUrl(89.8, 179.9, 2001, 2010, lw);
    expect(url).not.toContain("&data=");
    expect(url).toContain("&bbox=179.4,89.3,180,90&");
  });
});
