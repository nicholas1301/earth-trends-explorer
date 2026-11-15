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
import { CrossCheck } from "./CrossCheck";
import { StatTiles, VerdictPanel } from "./VerdictPanel";

const VIEWS: { value: ChartView; label: string }[] = [
  { value: "annual", label: "Yearly" },
  { value: "monthly", label: "Monthly" },
  { value: "anomaly", label: "Without seasons" },
];

function seriesLabel(view: ChartView, season: Season): string {
  if (view === "annual") return season.id === "year" ? "Annual mean" : `Mean for ${season.name}`;
  return view === "anomaly" ? "Monthly anomaly" : "Monthly value";
}

function viewNote(view: ChartView, season: Season): string {
  if (view === "annual") {
    return `Each dot is the mean of one year${season.id === "year" ? "" : ` (${season.name})`}.`;
  }
  if (view === "anomaly") {
    return "Each month compared with what is normal for that month, so the seasonal ups and downs disappear.";
  }
  return "Month-by-month values, with the seasonal cycle. The trend line comes from the yearly means.";
}

interface Props {
  analysis: Analysis;
  onBack(): void;
  onNext(): void;
  onHelp(): void;
}

/** Step 4: the verdict for the selected variable, then the evidence behind it. */
export function AnalysisSection({ analysis, onBack, onNext, onHelp }: Props) {
  const { state, actions } = useInvestigation();
  const { variable: v, result: r, season } = analysis;
  const investigation = state.investigation!;
  if (!v || !r) return null;

  return (
    <section id="sec-chart" className="stack">
      <div>
        <SectionHeading title={`${v.name} in ${investigation.place.name}`} />
        <p className="muted" style={{ margin: 0 }}>{v.definition}</p>
      </div>

      {!r.ok ? (
        <Notice>
          There is not enough data for this variable in this period (at least 8 valid years are required
          {v.id === "AOD_55" && "; aerosols only have data from 2001 onward"}). Widen the period or choose another time of year.
        </Notice>
      ) : (
        <>
          <VerdictPanel variable={v} result={r} place={investigation.place} season={season} onHelp={onHelp} />

          <div className="analysis-block">
            <h3>
              The evidence, year by year
              <SegmentedControl label="Chart view" options={VIEWS} value={state.view} onChange={actions.setView} />
            </h3>
            <Legend
              items={[
                { color: "var(--s1)", label: seriesLabel(state.view, season) },
                { color: "var(--s2)", label: "Trend line" },
                { shape: "box", color: "var(--s2)", opacity: 0.3, label: "Uncertainty of the trend (95%)" },
                { shape: "dash", color: "var(--s3)", label: "Second estimate (Sen’s slope)" },
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
            <p className="muted" style={{ margin: 0 }}>
              {viewNote(state.view, season)} If a flat line fits inside the shaded band, the trend may be just chance.
            </p>
          </div>

          <div className="analysis-block">
            <h3>In which months does the change happen?</h3>
            <MonthlyTrendBars variable={v} grid={investigation.data[v.id]} y0={state.filters.y0} y1={state.filters.y1} />
          </div>

          <CrossCheck variable={v} place={investigation.place} filters={state.filters} onImport={() => actions.goTo("import")} />

          <details>
            <summary>Show the statistics</summary>
            <StatTiles variable={v} result={r} />
            <p className="muted" style={{ marginTop: 10 }}>
              Source: {v.source} · unit: {v.unit}
            </p>
          </details>
          <details>
            <summary>Show the data and export</summary>
            <ExportActions variable={v} result={r} />
            <DataTable variable={v} result={r} />
          </details>
        </>
      )}

      <div className="step-nav">
        <button type="button" onClick={onBack}>← All trends</button>
        <button type="button" className="primary" onClick={onNext}>Where is it changing? →</button>
      </div>
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
    <div className="row" style={{ marginTop: 12 }}>
      <button type="button" onClick={downloadCsv}>Download CSV</button>
      <button type="button" onClick={copyLink}>Copy link to this investigation</button>
      <span className="muted" role="status">{message}</span>
    </div>
  );
}

function DataTable({ variable: v, result: r }: { variable: Variable; result: TrendOk }) {
  return (
    <div className="table-scroll" style={{ maxHeight: 320, overflow: "auto", marginTop: 12 }}>
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th className="num">{v.name} ({v.unit})</th>
            <th className="num">Trend line</th>
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
