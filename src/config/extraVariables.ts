// Records that NASA POWER does not have, downloaded in advance from NASA AppEEARS and NASA Giovanni for the featured
// places only (scripts/fetch-extras.mjs → src/data/extras/). Both tools need an Earthdata login and cannot be queried
// from the browser, so other places do not get these variables.
// How each one is downloaded and converted lives in scripts/extras/datasets.json (same IDs; a test keeps them in sync).

import type { Variable } from "../types";

type Extra = Omit<Variable, "extra"> & { extra: NonNullable<Variable["extra"]> };

const modis = (product: string, scope: string, since = 2000) => ({ tool: "AppEEARS" as const, product, since, scope });
const giovanni = (product: string, since: number, scope: string) => ({ tool: "Giovanni" as const, product, since, scope });

const PIXELS = "mean of 9 points over about 1 km around the place";
const AREA = "share of 25 points over a box of about 22 km around the place";
const cell = (size: string) => `value of the ${size} grid cell that contains the place`;

export const EXTRA_VARIABLES: Extra[] = [
  // Living Earth
  { id: "NDVI", name: "Vegetation greenness (NDVI)", unit: "index", themes: ["life"], increase: "blue", digits: 3, source: "MODIS Terra (MOD13Q1)", extra: modis("MOD13Q1", PIXELS), definition: "How green and dense the plants are, from −0.2 (water, bare ground) to 1 (thick forest). Cloudy pixels are left out." },
  { id: "EVI", name: "Enhanced vegetation index (EVI)", unit: "index", themes: ["life"], increase: "blue", digits: 3, source: "MODIS Terra (MOD13Q1)", extra: modis("MOD13Q1", PIXELS), definition: "Like NDVI, but it keeps responding in very dense forests, where NDVI saturates." },
  { id: "LAI", name: "Leaf area", unit: "m²/m²", themes: ["life"], increase: "blue", digits: 2, source: "MODIS Terra (MOD15A2H)", extra: modis("MOD15A2H", PIXELS), definition: "Square meters of leaves above each square meter of ground." },
  { id: "GPP", name: "Plant growth (photosynthesis)", unit: "gC/m²/day", themes: ["life"], increase: "blue", digits: 2, source: "MODIS Terra (MOD17A2HGF)", extra: modis("MOD17A2HGF", PIXELS), definition: "Carbon taken from the air by plants each day: gross primary productivity." },
  { id: "TREE_COVER", name: "Tree cover", unit: "%", themes: ["life"], increase: "blue", digits: 1, source: "MODIS Terra (MOD44B, yearly)", extra: modis("MOD44B", PIXELS), definition: "Share of the ground under tree canopy. One value per year, so the time-of-year filter does not change it. A fall can mean deforestation." },
  { id: "BURNED_AREA", name: "Burned area", unit: "%", themes: ["life"], increase: "red", digits: 2, source: "MODIS Terra + Aqua (MCD64A1)", extra: modis("MCD64A1", AREA), definition: "Share of the surroundings that burned in the month." },
  { id: "FIRE_FREQ", name: "Active fires", unit: "%", themes: ["life"], increase: "red", digits: 2, source: "MODIS Terra (MOD14A2)", extra: modis("MOD14A2", AREA), definition: "How often the satellite saw a fire burning in the surroundings: share of clear observations with a fire." },

  // Heat
  { id: "LST_DAY", name: "Ground temperature by day (satellite)", unit: "°C", themes: ["heat"], increase: "red", digits: 2, source: "MODIS Terra (MOD11A2)", extra: modis("MOD11A2", PIXELS), definition: "Temperature of the ground surface at about 10:30, measured from space on clear days. Shows heat islands and dry soils." },
  { id: "LST_NIGHT", name: "Ground temperature at night (satellite)", unit: "°C", themes: ["heat"], increase: "red", digits: 2, source: "MODIS Terra (MOD11A2)", extra: modis("MOD11A2", PIXELS), definition: "The same, at about 22:30. Cities stay warmer than the countryside at night." },

  // Water
  { id: "ET_MODIS", name: "Evaporation by plants and soil (satellite)", unit: "mm/day", themes: ["water"], increase: "blue", digits: 2, source: "MODIS Terra (MOD16A2GF)", extra: modis("MOD16A2GF", PIXELS), definition: "Water returned to the air by plants and soil, estimated from satellite images. Not given over water, cities or bare desert." },
  { id: "RUNOFF", name: "Runoff (water that flows away)", unit: "mm/day", themes: ["water"], increase: "blue", digits: 3, source: "GLDAS Noah 2.1 model", extra: giovanni("GLDAS_NOAH025_M 2.1", 2000, cell("0.25° (about 28 km)")), definition: "Rain that does not soak in or evaporate, and feeds streams and rivers (surface plus underground runoff)." },
  { id: "SOILM_DEEP", name: "Deep soil water (1–2 m)", unit: "kg/m²", themes: ["water"], increase: "blue", digits: 1, source: "GLDAS Noah 2.1 model", extra: giovanni("GLDAS_NOAH025_M 2.1", 2000, cell("0.25° (about 28 km)")), definition: "Water stored between 1 and 2 m deep (1 kg/m² = 1 mm of water). Reacts slowly, to years of rain or drought." },

  // Snow and ice
  { id: "SNOW_COVER", name: "Snow cover (satellite)", unit: "%", themes: ["ice"], increase: "blue", digits: 1, source: "MODIS Terra (MOD10A2)", extra: modis("MOD10A2", PIXELS), definition: "Share of clear-sky observations in which the ground was covered by snow." },
  { id: "SWE", name: "Water stored in snow", unit: "kg/m²", themes: ["ice"], increase: "blue", digits: 1, source: "GLDAS Noah 2.1 model", extra: giovanni("GLDAS_NOAH025_M 2.1", 2000, cell("0.25° (about 28 km)")), definition: "How much water the snowpack would give if it melted (1 kg/m² = 1 mm of water)." },

  // Sun and clouds
  { id: "OLR", name: "Heat escaping to space", unit: "W/m²", themes: ["sun"], increase: "red", digits: 1, source: "AIRS (Aqua)", extra: giovanni("AIRS3STM 7.0", 2002, cell("1° (about 110 km)")), definition: "Infrared energy leaving the top of the atmosphere (outgoing long-wave radiation). Low values mean high, cold cloud tops or a moist air column." },
  { id: "CLOUD_TOP_T", name: "Cloud top temperature", unit: "°C", themes: ["sun"], increase: "red", digits: 1, source: "AIRS (Aqua)", extra: giovanni("AIRS3STM 7.0", 2002, cell("1° (about 110 km)")), definition: "Temperature at the top of the clouds: the colder, the higher (and often stormier) the clouds." },

  // Air composition
  { id: "NO2", name: "Nitrogen dioxide (NO₂)", unit: "10¹⁵ molec/cm²", themes: ["air"], increase: "red", digits: 2, source: "OMI (Aura)", extra: giovanni("OMNO2d 003", 2004, cell("0.25° (about 28 km)")), definition: "A gas from car engines, power plants and fires, measured in the lower atmosphere. A direct sign of traffic and industry." },
  { id: "SO2", name: "Sulfur dioxide (SO₂)", unit: "DU", themes: ["air"], increase: "red", digits: 3, source: "OMI (Aura)", extra: giovanni("OMSO2e 003", 2004, cell("0.25° (about 28 km)")), definition: "A gas from burning coal and from volcanoes, near the ground (Dobson units). Very noisy away from big sources." },
  { id: "PM25", name: "Fine particles (PM2.5)", unit: "µg/m³", themes: ["air"], increase: "red", digits: 1, source: "MERRA-2 aerosol model", extra: giovanni("M2TMNXAER 5.12.4", 1980, cell("0.5° × 0.625° (about 60 km)")), definition: "Particles small enough to reach the lungs, near the ground: dust, sea salt, soot, organic matter and sulfate added up." },
  { id: "DUST", name: "Dust near the ground", unit: "µg/m³", themes: ["air"], increase: "red", digits: 1, source: "MERRA-2 aerosol model", extra: giovanni("M2TMNXAER 5.12.4", 1980, cell("0.5° × 0.625° (about 60 km)")), definition: "Fine mineral dust in the air near the surface, lifted from deserts and dry soils." },
  { id: "BLACK_CARBON", name: "Soot (black carbon)", unit: "µg/m³", themes: ["air"], increase: "red", digits: 2, source: "MERRA-2 aerosol model", extra: giovanni("M2TMNXAER 5.12.4", 1980, cell("0.5° × 0.625° (about 60 km)")), definition: "Dark particles from fires, diesel engines and cooking stoves, near the surface." },
  { id: "UV_INDEX", name: "UV index", unit: "index", themes: ["air", "sun"], increase: "red", digits: 2, source: "OMI (Aura)", extra: giovanni("OMUVBd 003", 2004, cell("1° (about 110 km)")), definition: "Strength of the sunburn-causing ultraviolet light at local noon. Rises when the ozone layer or clouds thin out." },
];

export const EXTRA_VARIABLE_IDS = EXTRA_VARIABLES.map((v) => v.id);
