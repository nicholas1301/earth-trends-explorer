// Links to other Earth-data tools whose exports the app can import, and the satellite/model datasets in NASA Giovanni
// that can cross-check each NASA POWER variable. Variable IDs and search keywords were checked against the Giovanni
// catalog (November 2026). The ID pre-selects the variable; the keyword also filters the list, so if a dataset version
// is retired the user still lands on the matching variables and only has to tick one.

export interface GiovanniDataset {
  /** What the user will find (instrument or model, and the variable). */
  label: string;
  /** Giovanni variable ID (the `data=` URL parameter), when one stable monthly product exists. */
  id?: string;
  /** Text typed into Giovanni's variable search. */
  keyword: string;
  kind: "satellite" | "model";
  /** First year of the record, so the user knows how long a trend can be tested. */
  since: number;
}

const IMERG: GiovanniDataset = { label: "GPM IMERG precipitation", id: "GPM_3IMERGM_07_precipitation", keyword: "IMERG precipitation", kind: "satellite", since: 1998 };
const GPCP: GiovanniDataset = { label: "GPCP satellite + gauge precipitation", id: "GPCPMON_3_3_satellite_precip", keyword: "GPCP precipitation", kind: "satellite", since: 1983 };
const AIRS_T: GiovanniDataset = { label: "AIRS air temperature at the surface", id: "AIRS3STM_7_0_SurfAirTemp_A", keyword: "AIRS3STM surface air temperature", kind: "satellite", since: 2002 };
const AIRS_SKIN: GiovanniDataset = { label: "AIRS surface skin temperature", id: "AIRX3STM_006_SurfSkinTemp_A", keyword: "AIRS surface skin temperature", kind: "satellite", since: 2002 };
const AIRS_RH: GiovanniDataset = { label: "AIRS relative humidity near the surface (1000 hPa)", id: "AIRS3STM_7_0_RelHum_A(z=1000)", keyword: "AIRS relative humidity", kind: "satellite", since: 2002 };
const AIRS_WV: GiovanniDataset = { label: "AIRS total column water vapor", id: "AIRS3STM_7_0_TotH2OVap_A", keyword: "AIRS water vapor", kind: "satellite", since: 2002 };
const MODIS_AOD: GiovanniDataset = { label: "MODIS-Terra aerosol optical depth", id: "MOD08_M3_6_1_AOD_550_Dark_Target_Deep_Blue_Combined_Mean_Mean", keyword: "MODIS aerosol optical depth", kind: "satellite", since: 2000 };
const MODIS_CLOUD: GiovanniDataset = { label: "MODIS-Terra cloud fraction", id: "MOD08_M3_6_1_Cloud_Fraction_Mean_Mean", keyword: "MODIS cloud fraction", kind: "satellite", since: 2000 };
const OMI_O3: GiovanniDataset = { label: "OMI total column ozone (daily)", id: "OMTO3d_003_ColumnAmountO3", keyword: "OMI ozone", kind: "satellite", since: 2004 };
const GLDAS_SM: GiovanniDataset = { label: "GLDAS soil moisture (top 10 cm)", id: "GLDAS_NOAH025_M_2_1_SoilMoi0_10cm_inst", keyword: "GLDAS soil moisture", kind: "model", since: 2000 };
const GLDAS_ET: GiovanniDataset = { label: "GLDAS evapotranspiration", id: "GLDAS_NOAH025_M_2_1_Evap_tavg", keyword: "GLDAS evapotranspiration", kind: "model", since: 2000 };
const GLDAS_RUNOFF: GiovanniDataset = { label: "GLDAS surface runoff (a streamflow proxy)", id: "GLDAS_NOAH025_M_2_1_Qs_acc", keyword: "GLDAS runoff", kind: "model", since: 2000 };
const GLDAS_SNOW: GiovanniDataset = { label: "GLDAS snow depth", id: "GLDAS_NOAH025_M_2_1_SnowDepth_inst", keyword: "GLDAS snow depth", kind: "model", since: 2000 };
const GLDAS_SKIN: GiovanniDataset = { label: "GLDAS surface skin temperature", id: "GLDAS_NOAH025_M_2_1_AvgSurfT_inst", keyword: "land surface temperature", kind: "model", since: 2000 };
// Only the GLDAS 2.0 product (1948–2014) has downward long-wave in Giovanni, so no ID: the search lists it.
const GLDAS_LW: GiovanniDataset = { label: "GLDAS downward long-wave radiation (record ends in 2014)", keyword: "downward long-wave radiation", kind: "model", since: 1948 };
const M2_T2M: GiovanniDataset = { label: "MERRA-2 2-meter air temperature (same model, averaged over the box)", id: "M2TMNXSLV_5_12_4_T2M", keyword: "2-meter air temperature", kind: "model", since: 1980 };
const M2_FROST: GiovanniDataset = { label: "MERRA-2 frost days index", id: "M2SMNXEDI_2_FD", keyword: "frost", kind: "model", since: 1980 };
const M2_QV: GiovanniDataset = { label: "MERRA-2 2-meter specific humidity", id: "M2TMNXSLV_5_12_4_QV2M", keyword: "2-meter specific humidity", kind: "model", since: 1980 };
const M2_WIND: GiovanniDataset = { label: "MERRA-2 surface wind speed", id: "M2TMNXFLX_5_12_4_SPEED", keyword: "MERRA-2 wind speed", kind: "model", since: 1980 };
const M2_PS: GiovanniDataset = { label: "MERRA-2 surface pressure", id: "M2TMNXSLV_5_12_4_PS", keyword: "MERRA-2 surface pressure", kind: "model", since: 1980 };
const M2_O3: GiovanniDataset = { label: "MERRA-2 total column ozone", id: "M2TMNXSLV_5_12_4_TO3", keyword: "MERRA-2 total column ozone", kind: "model", since: 1980 };
const SW_IN: GiovanniDataset = { label: "MERRA-2 incident shortwave at the surface", id: "M2TMNXLFO_5_12_4_SWGDN", keyword: "incident shortwave", kind: "model", since: 1980 };

/** Giovanni datasets that measure the same thing as each NASA POWER variable, satellite first. */
export const GIOVANNI_MATCHES: Record<string, GiovanniDataset[]> = {
  T2M: [AIRS_T, M2_T2M],
  T2M_MAX: [AIRS_T, M2_T2M],
  T2M_MIN: [AIRS_T, M2_T2M],
  TS: [AIRS_SKIN, GLDAS_SKIN],
  FROST_DAYS: [M2_FROST],
  SNODP: [GLDAS_SNOW],
  PRECTOTCORR: [IMERG, GPCP, GLDAS_RUNOFF],
  GWETTOP: [GLDAS_SM, IMERG],
  GWETROOT: [GLDAS_SM, GLDAS_RUNOFF],
  EVLAND: [GLDAS_ET, GLDAS_RUNOFF],
  RH2M: [AIRS_RH],
  QV2M: [AIRS_WV, M2_QV],
  TQV: [AIRS_WV],
  WS10M: [M2_WIND],
  PS: [M2_PS],
  ALLSKY_SFC_SW_DWN: [SW_IN, MODIS_CLOUD],
  ALLSKY_SFC_LW_DWN: [GLDAS_LW, AIRS_WV],
  CLOUD_AMT: [MODIS_CLOUD],
  AOD_55: [MODIS_AOD],
  TO3: [OMI_O3, M2_O3],
};

/** Half-width (degrees) of the box averaged around a point; ±0.5° ≈ one POWER/MERRA-2 cell and its neighbours. */
export const BOX_HALF_SIZE = 0.5;

const clampLat = (x: number) => Math.max(-90, Math.min(90, x));
const clampLon = (x: number) => Math.max(-180, Math.min(180, x));
const round = (x: number) => Math.round(x * 100) / 100;

/** Giovanni "Time Series, Area-Averaged" pre-filled with the box, the period, the variable and a variable search. */
export function giovanniUrl(lat: number, lon: number, y0: number, y1: number, dataset: GiovanniDataset, half = BOX_HALF_SIZE): string {
  const bbox = [clampLon(lon - half), clampLat(lat - half), clampLon(lon + half), clampLat(lat + half)].map(round).join(",");
  return (
    "https://giovanni.gsfc.nasa.gov/giovanni/#service=ArAvTs" +
    `&starttime=${y0}-01-01T00:00:00Z&endtime=${y1}-12-31T23:59:59Z` +
    `&bbox=${bbox}` +
    (dataset.id ? `&data=${encodeURIComponent(dataset.id)}` : "") +
    `&dataKeyword=${encodeURIComponent(dataset.keyword)}`
  );
}

export interface ExternalTool {
  name: string;
  url: string;
  /** What it adds to this app. */
  adds: string;
  /** How to get a file this app can read. */
  steps: string;
  login: string;
}

export const EXTERNAL_TOOLS: ExternalTool[] = [
  {
    name: "NASA Giovanni",
    url: "https://giovanni.gsfc.nasa.gov/giovanni/",
    adds: "Satellite records from MODIS, OMI, AIRS and GPM, plus GLDAS hydrology (soil moisture, evapotranspiration, runoff) and MERRA-2, averaged over any box.",
    steps: "Plot type “Time Series, Area-Averaged” → pick a variable → Plot Data → Downloads → CSV.",
    login: "Free Earthdata login needed to download (guests can only plot).",
  },
  {
    name: "NASA AppEEARS",
    url: "https://appeears.earthdatacloud.nasa.gov/task/point",
    adds: "Land products Giovanni does not offer, such as MODIS / VIIRS vegetation (NDVI, EVI) and land surface temperature, at the exact point.",
    steps: "Extract → Point Sample → add the coordinates, dates and layers (e.g. MOD13Q1 NDVI) → wait for the e-mail → download the CSV of the layer.",
    login: "Free Earthdata login; requests are processed in the background.",
  },
  {
    name: "KNMI Climate Explorer",
    url: "https://climexp.knmi.nl/start.cgi",
    adds: "Long station records and many other datasets (also non-NASA), often going back well before 1981.",
    steps: "Choose a station or a gridded field → make a time series → “raw data” → save the text file.",
    login: "Free registration recommended.",
  },
  {
    name: "NOAA Climate Data Online",
    url: "https://www.ncei.noaa.gov/cdo-web/datatools/findstation",
    adds: "Ground-truth from weather stations (GHCN), to check whether a trend seen from space also shows up on the ground.",
    steps: "Find a station → “Global Summary of the Month” or daily summaries → order as CSV (sent by e-mail).",
    login: "E-mail address needed to receive the order.",
  },
];

export const FURTHER_READING = [
  {
    title: "Acker et al. — Time-series analysis of remotely-sensed SeaWiFS chlorophyll in river-influenced coastal regions",
    url: "https://ntrs.nasa.gov/citations/20090042747",
    note: "A NASA study that does exactly this workflow: Giovanni area-averaged series → monthly anomalies → yearly means → regression and significance.",
  },
  {
    title: "Statistical test methods to detect trends in time series data",
    url: "https://medium.com/@snp.kriss/statistical-test-methods-to-detect-trends-in-time-series-data-b361a0ec530b",
    note: "Overview of the tests used here (Mann-Kendall, Sen’s slope, regression t-test) and their assumptions.",
  },
  {
    title: "A comprehensive guide to statistical significance",
    url: "https://www.statsig.com/perspectives/a-comprehensive-guide-to-statistical-significance",
    note: "What p-values and confidence intervals do and do not tell you.",
  },
];
