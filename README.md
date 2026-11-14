# earth-trends-explorer

Submission for NASA's Space Apps Challenge 2026. Theme: "Be An Earth System Trend Detective!".

**Earth Trends Detective** downloads decades of monthly NASA POWER data (MERRA-2 reanalysis and CERES satellite
products, 1981 to today) for any point on Earth, tests 20 variables for statistically significant trends
(Mann-Kendall + Sen's slope, and OLS with an autocorrelation-corrected t-test) and helps you explore where and
when the change happens.

## Running locally

Requires Node.js 18+.

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm test         # unit tests (Vitest)
npm run build    # typecheck + production build into dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/pages.yml`
(enable *Settings → Pages → Source: GitHub Actions* once).

## Project structure

React 18 + TypeScript + Vite. No UI or chart libraries: charts are plain SVG rendered by React components;
[d3-geo](https://d3js.org/d3-geo) provides the map projections (orthographic globe and Equal Earth).

```
src/
├── config/         Static catalog: themes, the 20 variables, preset places, seasons, guided demos
├── lib/            Framework-free logic (unit tested)
│   ├── stats.ts      OLS, Mann-Kendall, Sen's slope, t/normal distributions
│   ├── trend.ts      Annual series from monthly anomalies, trend verdicts, evidence levels
│   ├── powerApi.ts   NASA POWER client (point + regional), cached by URL
│   ├── geo.ts        Natural Earth land outlines, land/ocean test, climate profile
│   ├── mapView.ts    Globe / Equal Earth view math: pan, zoom, fly-to, projection switch
│   ├── clues.ts      Scans and ranks every variable for the clue board
│   └── ...           formatting, colors, axis ticks, CSV export, shareable URL hash
├── state/
│   ├── reducer.ts              App state and transitions (pure)
│   ├── InvestigationContext.tsx Provider: async actions + derived analysis
│   └── TooltipContext.tsx      Single floating tooltip shared by charts
├── hooks/          useAsync, useElementWidth, useMapView (animations), useGeolocation
└── components/
    ├── layout/     Header, intro with demo cases, glossary
    ├── setup/      Step 1 (theme) and step 2 (place picker map)
    ├── results/    Filters, clue board, analysis + verdict, “where is it changing?”
    ├── charts/     Interactive GeoMap, time series, monthly bars, regional grid map, world comparison, sparkline
    ├── tour/       Guided case walkthrough
    └── ui/         Small shared pieces (segmented control, legend, status, …)
```

Data flow: the user picks a place → `investigate()` fetches all variables once → the provider derives the
trend of every variable for the current filters (`useMemo`) → components only render. Changing the theme,
period or season never refetches.

## Data sources

- [NASA POWER](https://power.larc.nasa.gov) monthly API (MERRA-2, CERES/SRB, CERES SYN1deg)
- Coastlines: [Natural Earth](https://www.naturalearthdata.com) 1:110m, via the `world-atlas` package (public domain)
