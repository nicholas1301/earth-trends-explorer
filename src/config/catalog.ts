import type { Preset, Season, Theme, ThemeId, Variable } from "../types";

export const FIRST_YEAR = 1981;
export const LAST_YEAR = new Date().getFullYear() - 1;
/** Minimum span (in years, inclusive difference) allowed between start and end year. */
export const MIN_SPAN = 9;

export const THEMES: Theme[] = [
  { id: "heat", icon: "🌡️", name: "Heat and cold", description: "Air and surface temperatures, nights, days and frosts." },
  { id: "water", icon: "🌧️", name: "Rain and drought", description: "Rainfall, soil moisture and evaporation — the water cycle on land." },
  { id: "ice", icon: "❄️", name: "Snow and ice", description: "Accumulated snow, frost days and the cold that sustains them." },
  { id: "sun", icon: "☀️", name: "Sun and clouds", description: "How much sunlight reaches the ground, and what blocks it: clouds and particles." },
  { id: "wind", icon: "💨", name: "Wind and pressure", description: "Air circulation near the surface." },
  { id: "air", icon: "🫧", name: "Air composition", description: "Water vapor, suspended particles and the ozone layer." },
];

export const themeById = (id: ThemeId): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0];

/** The 20 NASA POWER parameters tested at every investigation. */
export const VARIABLES: Variable[] = [
  { id: "T2M", name: "Air temperature", unit: "°C", themes: ["heat"], increase: "red", digits: 2, source: "MERRA-2", definition: "Mean air temperature 2 m above the ground — the one we feel on our skin." },
  { id: "T2M_MAX", name: "Maximum temperature", unit: "°C", themes: ["heat"], increase: "red", digits: 2, source: "MERRA-2", definition: "The highest temperature recorded in the month, 2 m above the ground. Shows heat extremes." },
  { id: "T2M_MIN", name: "Minimum temperature", unit: "°C", themes: ["heat", "ice"], increase: "red", digits: 2, source: "MERRA-2", definition: "The lowest temperature of the month — usually before dawn. Sensitive to urban heat islands." },
  { id: "TS", name: "Surface temperature", unit: "°C", themes: ["heat", "ice"], increase: "red", digits: 2, source: "MERRA-2", definition: "Temperature of the planet’s “skin”: of the ground, the ice or the sea surface." },
  { id: "FROST_DAYS", name: "Frost days", unit: "days/month", themes: ["ice", "heat"], increase: "blue", digits: 2, source: "MERRA-2", definition: "Number of days in the month when the temperature drops below 0 °C." },
  { id: "SNODP", name: "Snow depth", unit: "cm", themes: ["ice"], increase: "blue", digits: 2, source: "MERRA-2", definition: "Mean thickness of the snow layer on the ground." },
  { id: "PRECTOTCORR", name: "Rain (precipitation)", unit: "mm/day", themes: ["water"], increase: "blue", digits: 2, source: "MERRA-2", definition: "How much water falls from the sky (rain and snow), in millimeters per day, on average." },
  { id: "GWETTOP", name: "Soil moisture (surface)", unit: "0–1", themes: ["water"], increase: "blue", digits: 3, source: "MERRA-2", definition: "How wet the top 5 cm of soil are: 0 is completely dry, 1 is saturated." },
  { id: "GWETROOT", name: "Soil moisture (roots)", unit: "0–1", themes: ["water"], increase: "blue", digits: 3, source: "MERRA-2", definition: "Water available in the first meter of soil, where plants drink: 0 is dry, 1 is saturated." },
  { id: "EVLAND", name: "Evaporation on land", unit: "mm/day", themes: ["water"], increase: "blue", digits: 2, source: "MERRA-2", definition: "Water that returns to the air from the soil and plants. Depends on the availability of water and energy." },
  { id: "RH2M", name: "Relative humidity", unit: "%", themes: ["water", "air"], increase: "blue", digits: 2, source: "MERRA-2", definition: "How much vapor the air carries relative to the maximum it can hold at that temperature." },
  { id: "QV2M", name: "Specific humidity", unit: "g/kg", themes: ["air"], increase: "blue", digits: 2, source: "MERRA-2", definition: "Grams of water vapor in each kilogram of air near the ground. Warmer air holds more vapor." },
  { id: "TQV", name: "Column water vapor", unit: "kg/m²", themes: ["air", "water"], increase: "blue", digits: 2, source: "MERRA-2", definition: "All the water vapor from the ground to the top of the atmosphere — the “fuel” available for rain." },
  { id: "WS10M", name: "Wind speed", unit: "m/s", themes: ["wind"], increase: "red", digits: 2, source: "MERRA-2", definition: "Mean wind speed at 10 m height." },
  { id: "PS", name: "Surface pressure", unit: "kPa", themes: ["wind"], increase: "red", digits: 3, source: "MERRA-2", definition: "The weight of the air over the location. Persistent changes indicate shifts in atmospheric circulation." },
  { id: "ALLSKY_SFC_SW_DWN", name: "Sunlight at the surface", unit: "MJ/m²/day", themes: ["sun"], increase: "red", digits: 2, source: "CERES/SRB", definition: "Energy from the Sun that actually reaches the ground, after passing through clouds and pollution." },
  { id: "ALLSKY_SFC_LW_DWN", name: "Heat radiated by the sky", unit: "MJ/m²/day", themes: ["sun", "heat"], increase: "red", digits: 2, source: "CERES/SRB", definition: "Infrared radiation that the atmosphere sends back to the ground — the signature of the greenhouse effect, clouds and vapor." },
  { id: "CLOUD_AMT", name: "Cloud cover", unit: "%", themes: ["sun"], increase: "blue", digits: 2, source: "CERES/SRB", definition: "Fraction of the sky covered by clouds during the day." },
  { id: "AOD_55", name: "Aerosols (particles in the air)", unit: "AOD", themes: ["air", "sun"], increase: "red", digits: 3, source: "CERES SYN1deg", definition: "Aerosol optical depth: how much dust, smoke and pollution cloud the air. Above 0.4 the sky already looks whitish." },
  { id: "TO3", name: "Total ozone", unit: "DU", themes: ["air"], increase: "blue", digits: 1, source: "MERRA-2", definition: "Amount of ozone in the whole air column, in Dobson units. It is the shield against ultraviolet radiation." },
];

export const VARIABLE_BY_ID: Record<string, Variable> = Object.fromEntries(VARIABLES.map((v) => [v.id, v]));
export const VARIABLE_IDS = VARIABLES.map((v) => v.id);

export const PRESETS: Preset[] = [
  { name: "Manaus", region: "Central Amazon", lat: -3.1, lon: -60.0, tag: "tropical rainforest" },
  { name: "Pantanal", region: "Brazil", lat: -17.5, lon: -57.0, tag: "wetland" },
  { name: "Petrolina", region: "Northeastern backlands", lat: -9.4, lon: -40.5, tag: "semi-arid" },
  { name: "São Paulo", region: "Brazil", lat: -23.5, lon: -46.6, tag: "megacity" },
  { name: "Niamey", region: "Sahel", lat: 13.5, lon: 2.1, tag: "desert edge" },
  { name: "Tamanrasset", region: "Sahara", lat: 22.8, lon: 5.5, tag: "desert" },
  { name: "Svalbard", region: "Arctic", lat: 78.2, lon: 15.6, tag: "polar" },
  { name: "Yakutsk", region: "Siberia", lat: 62.0, lon: 129.7, tag: "permafrost" },
  { name: "Alps", region: "Switzerland", lat: 46.5, lon: 9.8, tag: "snowy mountain" },
  { name: "Delhi", region: "India", lat: 28.6, lon: 77.2, tag: "megacity" },
  { name: "Beijing", region: "China", lat: 39.9, lon: 116.4, tag: "megacity" },
  { name: "Ganges Delta", region: "Bangladesh", lat: 22.0, lon: 89.5, tag: "estuary" },
  { name: "Aral Sea", region: "Central Asia", lat: 45.0, lon: 60.0, tag: "shrinking lake" },
  { name: "Central Valley", region: "California", lat: 36.6, lon: -119.8, tag: "irrigated farmland" },
  { name: "Murray-Darling", region: "Australia", lat: -34.0, lon: 145.0, tag: "semi-arid farmland" },
  { name: "Equatorial Pacific", region: "El Niño region", lat: 0.0, lon: -150.0, tag: "ocean" },
  { name: "Antarctic Peninsula", region: "Antarctica", lat: -64.8, lon: -62.9, tag: "polar" },
];

/** “Detective’s nose”: variables that usually yield good clues for each type of place. */
export const HINTS: Record<string, string[]> = {
  polar: ["T2M", "T2M_MIN", "TS", "SNODP", "FROST_DAYS", "ALLSKY_SFC_LW_DWN"],
  cold: ["T2M_MIN", "SNODP", "FROST_DAYS", "T2M", "TS"],
  desert: ["T2M_MAX", "AOD_55", "PRECTOTCORR", "GWETTOP", "WS10M"],
  "semi-arid": ["PRECTOTCORR", "GWETROOT", "GWETTOP", "EVLAND", "T2M_MAX"],
  "humid tropical": ["PRECTOTCORR", "GWETROOT", "EVLAND", "T2M_MAX", "CLOUD_AMT", "RH2M"],
  temperate: ["T2M", "PRECTOTCORR", "GWETROOT", "FROST_DAYS", "ALLSKY_SFC_SW_DWN"],
  ocean: ["TS", "WS10M", "TQV", "PRECTOTCORR", "CLOUD_AMT"],
  megacity: ["AOD_55", "T2M_MIN", "ALLSKY_SFC_SW_DWN"],
  estuary: ["PRECTOTCORR", "GWETROOT", "EVLAND", "WS10M"],
  wetland: ["GWETROOT", "EVLAND", "PRECTOTCORR"],
  "shrinking lake": ["T2M_MAX", "EVLAND", "GWETTOP", "AOD_55", "RH2M"],
  "irrigated farmland": ["GWETROOT", "EVLAND", "PRECTOTCORR", "T2M_MAX"],
  "semi-arid farmland": ["GWETROOT", "EVLAND", "PRECTOTCORR", "T2M_MAX"],
  "snowy mountain": ["SNODP", "FROST_DAYS", "T2M_MIN"],
  permafrost: ["TS", "T2M_MIN", "SNODP", "FROST_DAYS"],
  "tropical rainforest": ["PRECTOTCORR", "GWETROOT", "EVLAND", "T2M_MAX"],
  "desert edge": ["PRECTOTCORR", "GWETROOT", "AOD_55"],
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ALL_MONTHS = MONTHS.map((_, i) => i);

export const SEASONS: Season[] = [
  { id: "year", name: "Whole year", months: ALL_MONTHS },
  { id: "djf", name: "Dec–Feb", months: [11, 0, 1] },
  { id: "mam", name: "Mar–May", months: [2, 3, 4] },
  { id: "jja", name: "Jun–Aug", months: [5, 6, 7] },
  { id: "son", name: "Sep–Nov", months: [8, 9, 10] },
  ...MONTHS.map((name, i) => ({ id: `m${i + 1}`, name: `Only ${name}`, months: [i] })),
];

export const seasonById = (id: string): Season => SEASONS.find((s) => s.id === id) ?? SEASONS[0];

export function presetAt(lat: number, lon: number): Preset | undefined {
  return PRESETS.find((p) => p.lat === lat && p.lon === lon);
}
