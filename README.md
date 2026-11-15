# Earth Trends Nexus

Submission for NASA's Space Apps Challenge 2026. Theme: "Be An Earth System Trend Detective!".

**Earth Trends Nexus** downloads decades of monthly NASA POWER data (MERRA-2 reanalysis and CERES satellite
products, 1981 to today) for any point on Earth, tests 20 variables for statistically significant trends
(Mann-Kendall + Sen's slope, and OLS with an autocorrelation-corrected t-test) and helps you explore where and
when the change happens.

To go beyond NASA POWER, each variable links to NASA **Giovanni** pre-filled for the same place and period (MODIS, OMI,
AIRS, GPM IMERG, GLDAS…), and any time series exported from Giovanni, AppEEARS, KNMI Climate Explorer or NOAA Climate
Data Online can be dropped into the app to run the same tests. At the 17 featured places, records that NASA POWER does
not have are stored in the repository and tested like the others. Stored so far: OMI NO₂, SO₂ and UV index; AIRS
outgoing long-wave radiation and cloud-top temperature; GLDAS runoff, deep soil water and snow water; MERRA-2 fine
particles (PM2.5), dust and soot (`src/data/extras-index.json` lists them per place). See [docs/resources-assessment.md](docs/resources-assessment.md)
for how each recommended resource was evaluated.

**Live app:** https://nicholas1301.github.io/earth-trends-explorer/

## Running locally

Requires Node.js 18+.

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm test         # unit tests (Vitest)
npm run build    # typecheck + production build into dist/
```

### Updating the featured places' extra records

The records in `src/data/extras/` are downloaded once by a script, because NASA AppEEARS and Giovanni need a login
and cannot be queried from the browser. It needs a free [NASA Earthdata](https://urs.earthdata.nasa.gov) account,
read from `EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD` or from `~/.netrc`
(`machine urs.earthdata.nasa.gov login <user> password <password>`):

```bash
node scripts/fetch-extras.mjs              # Giovanni series + AppEEARS tasks; re-run to resume while AppEEARS works
node scripts/fetch-extras.mjs --build      # rebuild the JSON files from the download cache only
```

What is downloaded, and how it is converted, is in `scripts/extras/datasets.json`; the labels the app shows are in
`src/config/extraVariables.ts`. Downloads are cached in `scripts/extras/.cache/` (git-ignored).

Pushing to `main` deploys to GitHub Pages via `.github/workflows/pages.yml`
(enable *Settings → Pages → Source: GitHub Actions* once).

## Project structure

React 18 + TypeScript + Vite. No UI or chart libraries: charts are plain SVG rendered by React components;
[d3-geo](https://d3js.org/d3-geo) provides the map projections (orthographic globe and Equal Earth).

```
src/
├── config/         Static catalog: themes, the 20 variables, preset places, seasons, guided demos,
│                   Giovanni cross-check datasets and external tools (externalSources.ts)
├── lib/            Framework-free logic (unit tested)
│   ├── stats.ts      OLS, Mann-Kendall, Sen's slope, t/normal distributions
│   ├── trend.ts      Annual series from monthly anomalies, trend verdicts, evidence levels
│   ├── powerApi.ts   NASA POWER client (point + regional), cached by URL
│   ├── geo.ts        Natural Earth land outlines, land/ocean test, climate profile
│   ├── mapView.ts    Globe / Equal Earth view math: pan, zoom, fly-to, projection switch
│   ├── clues.ts      Scans and ranks every variable for the clue board
│   ├── importSeries.ts Reads Giovanni / AppEEARS / CDO / KNMI / Data Rods files into a monthly grid
│   └── ...           formatting, colors, axis ticks, CSV export, shareable URL hash
├── state/
│   ├── reducer.ts              App state and transitions (pure)
│   ├── InvestigationContext.tsx Provider: async actions + derived analysis
│   └── TooltipContext.tsx      Single floating tooltip shared by charts
├── hooks/          useAsync, useElementWidth, useMapView (animations), useGeolocation
└── components/
    ├── layout/     Header (logo, light/dark toggle), stepper, home with demo cases, help dialog
    ├── setup/      Step 1 (place picker map)
    ├── results/    Filters, step 2 (clues, filterable by topic), step 3 (verdict + evidence + Giovanni cross-check),
    │               step 4 (“where is it changing?”), “analyze your own time series” (import screen)
    ├── charts/     Interactive GeoMap, time series, monthly bars, regional grid map, world comparison, sparkline
    ├── tour/       Guided case walkthrough
    └── ui/         Small shared pieces (segmented control, legend, status, …)
```

The app shows one screen per step (home → place → clues → verdict → compare); the current step lives in
the reducer (`state.step`). The visual identity follows the NASA Space Apps Challenge logo (`src/assets/`): black on
white with a dark mode, Bebas Neue + Fira Sans (self-hosted via `@fontsource`), colours defined as CSS tokens in
`src/styles/global.css`.

Data flow: the user picks a place → `investigate()` fetches all variables once → the provider derives the
trend of every variable for the current filters (`useMemo`) → components only render. Changing the topic filter,
period or season never refetches.

## Data sources

- [NASA POWER](https://power.larc.nasa.gov) monthly API (MERRA-2, CERES/SRB, CERES SYN1deg)
- User-imported files from [NASA Giovanni](https://giovanni.gsfc.nasa.gov/giovanni/),
  [NASA AppEEARS](https://appeears.earthdatacloud.nasa.gov/), [KNMI Climate Explorer](https://climexp.knmi.nl/) and
  [NOAA Climate Data Online](https://www.ncei.noaa.gov/cdo-web/) (read in the browser, never uploaded)
- Featured places only, stored in `src/data/extras/`: OMI (OMNO2d, OMSO2e, OMUVBd), AIRS (AIRS3STM), GLDAS Noah 2.1
  and MERRA-2 hourly aerosols (M2T1NXAER, averaged per month) via the
  [NASA Giovanni](https://giovanni.gsfc.nasa.gov/giovanni/) time-series API. The download script also covers MODIS land
  products via [NASA AppEEARS](https://appeears.earthdatacloud.nasa.gov/), added once that download completes
- Coastlines: [Natural Earth](https://www.naturalearthdata.com) 1:110m, via the `world-atlas` package (public domain)
