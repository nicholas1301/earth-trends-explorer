import { useState } from "react";
import { formatNumber, formatSigned } from "../../lib/format";
import { downloadText, trendCsv } from "../../lib/exporters";
import type { TrendOk } from "../../lib/trend";
import { useInvestigation, type Analysis } from "../../state/InvestigationContext";
import type { ChartView, Season, Variable } from "../../types";
import { MonthlyTrendBars } from "../charts/MonthlyTrendBars";
import { TimeSeriesChart } from "../charts/TimeSeriesChart";
import { Legend } from "../ui/Legend";
import { SectionHeading } from "../ui/SectionHeading";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Notice } from "../ui/Status";
import { VerdictPanel } from "./VerdictPanel";

const VIEWS: { value: ChartView; label: string }[] = [
  { value: "annual", label: "Annual means" },
  { value: "monthly", label: "Monthly" },
  { value: "anomaly", label: "Anomalies" },
];

function seriesLabel(view: ChartView, season: Season): string {
  if (view === "annual") return season.id === "year" ? "Annual mean" : `Mean for ${season.name}`;
  return view === "anomaly" ? "Monthly anomaly" : "Monthly value";
}

function viewNote(view: ChartView, season: Season): string {
  if (view === "annual") {
    return `Each point is the mean of one year${season.id === "year" ? "" : ` (${season.name})`}. The lines and tests use these points.`;
  }
  if (view === "anomaly") {
    return "Anomaly = the month’s value minus the typical mean for that month in the period. The seasonal ups and downs disappear, and the underlying change shows.";
  }
  return "Month-by-month values, with the seasonal cycle. The trend lines come from the annual means.";
}

/** Step 4: detailed look at the selected variable. */
export function AnalysisSection({ analysis }: { analysis: Analysis }) {
  const { state, actions } = useInvestigation();
  const { variable: v, result: r, season } = analysis;
  const investigation = state.investigation!;
  if (!v || !r) return null;

  return (
    <section className="card" id="sec-chart">
      <SectionHeading
        step={4}
        title={`${v.name} in ${investigation.place.name}`}
        aside={<SegmentedControl label="Chart view" options={VIEWS} value={state.view} onChange={actions.setView} />}
      />
      <p className="muted">
        {v.definition} <span className="tag">{v.source}</span>
        <span className="tag">{v.unit}</span>
      </p>

      {!r.ok ? (
        <Notice>
          There is not enough data for this variable in this period (at least 8 valid years are required
          {v.id === "AOD_55" && "; aerosols only have data from 2001 onward"}). Widen the period or choose another time of year.
        </Notice>
      ) : (
        <>
          <Legend
            items={[
              { color: "var(--s1)", label: seriesLabel(state.view, season) },
              { color: "var(--s2)", label: "Regression line" },
              { shape: "box", color: "var(--s2)", opacity: 0.35, label: "95% confidence band" },
              { shape: "dash", color: "var(--s3)", label: "Sen’s slope" },
            ]}
          />
          <TimeSeriesChart
            variable={v}
            result={r}
            grid={investigation.data[v.id]}
            months={season.months}
            y0={state.filters.y0}
            y1={state.filters.y1}
            view={state.view}
            seriesLabel={seriesLabel(state.view, season)}
          />
          <p className="muted" style={{ marginTop: 6 }}>{viewNote(state.view, season)}</p>

          <VerdictPanel variable={v} result={r} place={investigation.place} season={season} />

          <div style={{ marginTop: 18 }}>
            <h3>In which months does the change happen?</h3>
            <p className="muted">Trend calculated separately for each month of the year (Sen’s slope, per decade).</p>
            <MonthlyTrendBars variable={v} grid={investigation.data[v.id]} y0={state.filters.y0} y1={state.filters.y1} />
          </div>

          <ExportActions variable={v} result={r} />
          <details>
            <summary>View data as a table</summary>
            <DataTable variable={v} result={r} />
          </details>
        </>
      )}
    </section>
  );
}

function ExportActions({ variable: v, result: r }: { variable: Variable; result: TrendOk }) {
  const { state } = useInvestigation();
  const [message, setMessage] = useState("");
  const place = state.investigation!.place;

  const downloadCsv = () => downloadText(trendCsv(v, r, place, state.filters), `trend_${v.id}_${place.lat}_${place.lon}.csv`);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setMessage("Link copied!");
    } catch {
      setMessage("Copy the address from the browser bar.");
    }
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <div className="row" style={{ marginTop: 14 }}>
      <button type="button" onClick={downloadCsv}>⬇ Download CSV</button>
      <button type="button" onClick={copyLink}>🔗 Copy link to this investigation</button>
      <span className="muted" role="status">{message}</span>
    </div>
  );
}

function DataTable({ variable: v, result: r }: { variable: Variable; result: TrendOk }) {
  return (
    <div className="table-scroll" style={{ maxHeight: 320, overflow: "auto", marginTop: 8 }}>
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th className="num">{v.name} ({v.unit})</th>
            <th className="num">Regression line</th>
            <th className="num">Difference</th>
          </tr>
        </thead>
        <tbody>
          {r.years.map((year, i) => {
            const fitted = r.ols.intercept + r.ols.slope * year;
            return (
              <tr key={year}>
                <td>{year}</td>
                <td className="num">{formatNumber(r.values[i], v.digits)}</td>
                <td className="num">{formatNumber(fitted, v.digits)}</td>
                <td className="num">{formatSigned(r.values[i] - fitted, v.digits)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
