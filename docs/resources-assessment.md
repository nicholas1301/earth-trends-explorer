# Assessment of the challenge resources

How each item in [resources.md](resources.md) relates to the [challenge](challenge.md), and what the app does with it.
Checked in November 2026.

## Summary

None of the resources is formally required: the challenge asks for a tool that selects variables, acquires them for a
region, plots a long time series and tests the trend (t-test, Mann-Kendall or confidence intervals). The app already
did all of that with NASA POWER (MERRA-2 + CERES). The gap was **data coverage**: the challenge names MODIS, OMI, AIRS,
GPM and GLDAS, and none of them is in NASA POWER. Giovanni is the resource that closes that gap, so we treat it as
*expected in practice*.

| Resource | Verdict | What we did |
| --- | --- | --- |
| **Giovanni** | Essential in practice | Pre-filled cross-check links for every variable + CSV import |
| Hydrology Time Series (Data Rods) | Relevant, but retired | Pointed users to the same GLDAS/NLDAS data in Giovanni; old files still import |
| AppEEARS | Optional, worth it | CSV import (MODIS/VIIRS NDVI, EVI, land surface temperature, which Giovanni lacks) |
| Climate Data Online (NOAA) | Optional, worth it | CSV import, daily or monthly, split by station (ground truth) |
| SeaWiFS chlorophyll paper (Acker et al.) | Methodological reference | Confirms our method; cited in the help dialog's reading list |
| KNMI Climate Explorer | Optional, worth it | Text import (year × 12 months tables), records before 1981 now supported |
| Trend-test article (Medium) | Educational | Further-reading link |
| Statistical significance guide (Statsig) | Educational | Further-reading link |
| CSA: RADARSAT Constellation Mission | Not worth it | Not integrated |
| CSA: Geo.ca | Not worth it | Not integrated |
| CSA: SWOT | Context only | Used as the example of a record too short for a trend (help dialog) |
| CSA: Monitoring ecosystems from space | Context only | Not integrated |
| CSA: SAR Python tutorial | Not worth it | Not integrated |

## Details

### NASA resources

**Giovanni** — The best match for the challenge: it serves the exact instruments and models named in the description
(MODIS, OMI, AIRS, GPM IMERG, MERRA-2, GLDAS), produces area-averaged time series and exports them as CSV. It does not
test significance, which is what our app adds. Constraints: downloads need a free Earthdata login, and there is no
open, CORS-enabled API a static web page could call, so the data cannot be fetched directly from the browser.
Integration:
- The *Verdict* step now has *Confirm it with another NASA record*: for each of the 20 variables, links that open Giovanni
  with the plot type (Time Series, Area-Averaged), a 1° box around the place, the selected period and the variable
  already ticked (`data=` parameter, with a search keyword as fallback) (e.g. GPM IMERG for rain, AIRS for temperature, MODIS for aerosols and clouds, OMI for ozone, GLDAS for
  soil moisture, evapotranspiration and runoff). The URL format and every search keyword were checked against Giovanni.
- The *Analyze your own time series* screen (linked from the home page and from the verdict) reads the downloaded CSV,
  including its title, region and fill value. Giovanni CSVs do not carry the unit, so the screen asks for it.

**Hydrology Time Series** — GLDAS/NLDAS point time series (Data Rods). It would have been the easiest way to add
evaporation, soil moisture and runoff (a streamflow proxy), all named in the challenge. However, the service now redirects
to a notice saying it was discontinued and moved to a new access method. The same variables are in Giovanni, so the
cross-check links use Giovanni; the importer still reads the Data Rods ASCII format for files saved earlier.

**AppEEARS** — Point or area extracts of land products from several archives (MODIS, VIIRS, Landsat, SRTM…). Not needed
for the core challenge, but it adds vegetation (NDVI/EVI) and land surface temperature, which Giovanni does not offer
and which show strong trends in places like deforestation fronts or irrigated farms. Requests are asynchronous and need a
login, so integration is by importing the point-sample CSV (the importer picks the data layer, skips QA/line/sample
columns and averages 16-day composites into months).

**Climate Data Online (NOAA)** — Station observations (GHCN daily and monthly summaries). Satellites and reanalyses can
contain artificial jumps; a nearby station is the classic independent check. The importer reads CDO CSV files, splits
multi-station files by `STATION`, and averages daily values into monthly means (months with fewer than half the usual
number of days are left empty).

**Acker et al., SeaWiFS chlorophyll time series** — A worked example of the challenge workflow: Giovanni area-averaged
series → monthly anomalies → yearly averages of anomalies → linear regression and significance (F-test), plus a note
that ordinary regression is sensitive to outliers and episodic events (they also tried robust regression). Our app
already builds yearly means from monthly anomalies exactly this way and uses Mann-Kendall + Sen's slope, which are robust
to outliers, alongside the regression t-test with autocorrelation correction. No change to the method was needed; the
paper is cited in the help dialog's reading list.

### Partner resources

**KNMI Climate Explorer** — A mature analysis tool with many gridded and station datasets. Mostly useful as another
data source with long records. The importer reads its "raw data" text files (`#` comments, `year` + 12 monthly values).
To make long records count, the analysis now accepts series that start before 1981 (the grid carries its own first year).

**Statistical articles (Medium, Statsig)** — Background on the tests the challenge asks for. The app already implements
Mann-Kendall, Sen's slope, OLS t-test and 95% confidence intervals and explains them in the help dialog; the articles are
linked as further reading.

### CSA resources

- **RADARSAT Constellation Mission data** — SAR imagery focused on Canada (ice, ships, oil spills, floods). Turning SAR
  scenes into a variable time series requires image processing far beyond this challenge; the archive starts in 2019
  (too short for trends). Not integrated.
- **Geo.ca** — Catalogue of Canadian geospatial layers, mostly static maps; no global time series. Not integrated.
- **SWOT** — Promising for lake, river and reservoir levels, but data start in 2023: too short for a trend test today.
  Mentioned in the help dialog as an example of why record length matters ("sometimes all a trend needs is a longer period").
- **Monitoring and protecting our ecosystems from space** — Narrative context about satellite monitoring; nothing to
  integrate.
- **SAR Python tutorial** — Teaches SAR image handling in Python/QGIS; not related to a browser tool that tests trends.
  Not integrated.
