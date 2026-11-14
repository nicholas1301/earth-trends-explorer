import { useMemo, useState, type DragEvent } from "react";
import { SEASONS, seasonById } from "../../config/catalog";
import { EXTERNAL_TOOLS } from "../../config/externalSources";
import { downloadText, trendCsv } from "../../lib/exporters";
import { ImportError, SOURCE_LABELS, parseTable, suggestDigits, toMonthlyGrid, type ParsedTable } from "../../lib/importSeries";
import { analyzeTrend } from "../../lib/trend";
import type { ChartView, IncreaseColor, Place, Variable } from "../../types";
import { MonthlyTrendBars } from "../charts/MonthlyTrendBars";
import { TimeSeriesChart } from "../charts/TimeSeriesChart";
import { Legend } from "../ui/Legend";
import { SectionHeading } from "../ui/SectionHeading";
import { SegmentedControl } from "../ui/SegmentedControl";
import { ErrorMessage, Notice } from "../ui/Status";
import { StatTiles, VerdictPanel } from "./VerdictPanel";
import "./ImportSection.css";

const MAX_BYTES = 40 * 1024 * 1024;
const MIN_YEARS = 8;

const VIEWS: { value: ChartView; label: string }[] = [
  { value: "annual", label: "Yearly" },
  { value: "monthly", label: "Monthly" },
  { value: "anomaly", label: "Without seasons" },
];

const seriesLabel = (view: ChartView) => (view === "annual" ? "Annual mean" : view === "anomaly" ? "Monthly anomaly" : "Monthly value");

interface Props {
  onBack(): void;
  /** Opens the “how to read the results” help. */
  onHelp(): void;
}

interface Loaded {
  table: ParsedTable;
  fileName: string;
}

/** Short, readable default name: “Merged satellite-gauge precipitation estimate - Final Run (…)” → first clause. */
function shortName(table: ParsedTable, column: number): string {
  const raw = table.title ?? table.columns[column];
  return raw.split(/ - |\s\(/)[0].replace(/^mean_/, "").trim() || "Imported variable";
}

const parseCodes = (text: string): number[] => text.split(/[,;\s]+/).filter(Boolean).map(Number).filter(Number.isFinite);

/** Side screen: analyse a time series downloaded from Giovanni, AppEEARS, KNMI, NOAA CDO… with the same tests. */
export function ImportSection({ onBack, onHelp }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);

  const load = (text: string, fileName: string) => {
    try {
      const table = parseTable(text);
      setLoaded({ table, fileName });
      setError(null);
    } catch (e) {
      setLoaded(null);
      setError(e instanceof ImportError ? e.message : `Could not read the file (${e instanceof Error ? e.message : String(e)}).`);
    }
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("The file is larger than 40 MB. Export a smaller area, fewer variables or monthly instead of daily data.");
      return;
    }
    load(await file.text(), file.name);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void loadFile(e.dataTransfer.files[0]);
  };

  return (
    <section id="sec-import" className="stack">
      <div>
        <SectionHeading title="Analyze your own time series" />
        <p className="lead" style={{ margin: 0 }}>
          Satellite records such as <b className="hl">MODIS, OMI, AIRS or GPM</b>, the <b className="hl">GLDAS</b> hydrology model or a
          weather station: download a time series and drop the file here. It goes through the same tests as the rest of the app. The
          file is read in your browser and is not uploaded anywhere.
        </p>
      </div>

      <details className="import-tools">
        <summary>Where to get a file, step by step</summary>
        <div className="tool-grid">
          {EXTERNAL_TOOLS.map((t) => (
            <div key={t.name} className="tool">
              <a href={t.url} target="_blank" rel="noreferrer"><b>{t.name} ↗</b></a>
              <span>{t.adds}</span>
              <span className="muted"><b className="hl">How:</b> {t.steps}</span>
              <span className="muted">{t.login}</span>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          The GES DISC <i>Hydrology Time Series</i> (“Data Rods”) service has been retired; its GLDAS and NLDAS variables are now available as
          area-averaged time series in Giovanni. Files saved from Data Rods earlier can still be read here.
        </p>
      </details>

      <div
        className={`dropzone${dragging ? " over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <label className="file-button">
          <input type="file" accept=".csv,.txt,.dat,.tsv,.asc,text/*" onChange={(e) => void loadFile(e.target.files?.[0])} />
          Choose a file
        </label>
        <span className="muted">or drop it here (CSV or text, daily or monthly values)</span>
      </div>
      <details className="paste-box">
        <summary>…or paste the contents</summary>
        <textarea
          className="paste"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={"time,mean_GPM_3IMERGM_07_precipitation\n2001-01-01 00:00:00,10.2\n2001-02-01 00:00:00,11.5\n…"}
          rows={6}
          spellCheck={false}
        />
        <button type="button" disabled={!pasted.trim()} onClick={() => load(pasted, "pasted data")}>Analyze pasted data</button>
      </details>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {loaded && <ImportedAnalysis key={loaded.fileName + loaded.table.rows.length} {...loaded} onHelp={onHelp} />}

      <div className="step-nav">
        <button type="button" onClick={onBack}>← Home</button>
      </div>
    </section>
  );
}

function ImportedAnalysis({ table, fileName, onHelp }: Loaded & { onHelp(): void }) {
  const [column, setColumn] = useState(table.defaultColumn);
  const [group, setGroup] = useState<string | null>(table.groups[0] ?? null);
  const [name, setName] = useState(() => shortName(table, table.defaultColumn));
  const [unit, setUnit] = useState(table.unit ?? "");
  const [increase, setIncrease] = useState<IncreaseColor>("red");
  const [missingText, setMissingText] = useState(table.fillValues.join(", "));
  const [view, setView] = useState<ChartView>("annual");
  const [seasonId, setSeasonId] = useState("year");
  const [range, setRange] = useState<[number, number] | null>(null);

  const missing = useMemo(() => parseCodes(missingText), [missingText]);
  const series = useMemo(() => {
    try {
      return toMonthlyGrid(table, { column, group, missing });
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, [table, column, group, missing]);

  if (typeof series === "string") return <ErrorMessage>{series}</ErrorMessage>;

  const years = Array.from({ length: series.lastYear - series.firstYear + 1 }, (_, i) => series.firstYear + i);
  const [y0, y1] = range && range[0] >= series.firstYear && range[1] <= series.lastYear ? range : [series.firstYear, series.lastYear];
  const season = seasonById(seasonId);
  const result = analyzeTrend(series.grid, y0, y1, season.months, series.origin);

  const source = SOURCE_LABELS[table.source];
  const variable: Variable = {
    id: "IMPORTED",
    name: name || "Imported variable",
    unit,
    themes: [],
    increase,
    digits: suggestDigits(series.grid),
    source,
    definition: "",
  };
  const place: Place = { name: group ?? (table.region ? `the box ${table.region}` : "the selected area"), region: "", lat: NaN, lon: NaN, tag: null };
  const shortSpan = series.lastYear - series.firstYear + 1 < MIN_YEARS;

  return (
    <div className="imported stack">
      <div className="import-setup">
      <p className="muted">
        <span className="tag">{source}</span>
        Read <b className="hl">{table.rows.length.toLocaleString("en-US")}</b> rows from <b className="hl">{fileName}</b> →{" "}
        <b className="hl">{series.months}</b> monthly values from {series.firstYear} to {series.lastYear}
        {table.subMonthly && " (several observations per month were averaged into monthly means)"}.
      </p>

      <div className="row import-controls">
        {table.columns.length > 1 && (
          <label className="field">
            Variable
            <select value={column} onChange={(e) => { setColumn(+e.target.value); setName(shortName({ ...table, title: null }, +e.target.value)); }}>
              {table.columns.map((c, i) => <option key={c + i} value={i}>{c}</option>)}
            </select>
          </label>
        )}
        {table.groups.length > 0 && (
          <label className="field">
            {table.groupColumn}
            <select value={group ?? ""} onChange={(e) => setGroup(e.target.value)}>
              {table.groups.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
        )}
        <label className="field">
          Name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} size={32} />
        </label>
        <label className="field">
          Unit
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            size={8}
            placeholder="e.g. mm/day"
            className={unit ? undefined : "needs-input"}
          />
        </label>
        <label className="field">
          An increase is
          <select value={increase} onChange={(e) => setIncrease(e.target.value as IncreaseColor)}>
            <option value="red">warmer / drier / more polluted (red)</option>
            <option value="blue">wetter / colder / greener (blue)</option>
          </select>
        </label>
      </div>
      {!unit && (
        <p className="muted unit-hint">
          {table.source === "giovanni"
            ? "Giovanni’s CSV does not include the unit: copy it from the title of the plot in Giovanni (for example “mm/hr” or “kg m-2”)."
            : "The file does not state the unit: type it above so the results read correctly."}{" "}
          Leave it empty for unitless quantities such as aerosol optical depth.
        </p>
      )}
      <div className="row import-controls">
        <label className="field">
          Period
          <select aria-label="Start year" value={y0} onChange={(e) => setRange([+e.target.value, Math.min(series.lastYear, Math.max(y1, +e.target.value + MIN_YEARS - 1))])}>
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
          to
          <select aria-label="End year" value={y1} onChange={(e) => setRange([Math.max(series.firstYear, Math.min(y0, +e.target.value - MIN_YEARS + 1)), +e.target.value])}>
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
        </label>
        <label className="field">
          Time of year
          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
            {SEASONS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="field" title="Values equal to these codes are ignored. Values ≤ −999 are always ignored.">
          Missing-value codes
          <input type="text" value={missingText} onChange={(e) => setMissingText(e.target.value)} size={10} placeholder="e.g. -9999" />
        </label>
      </div>
      </div>

      {shortSpan ? (
        <Notice>
          This record covers only {series.lastYear - series.firstYear + 1} year(s). At least {MIN_YEARS} years are needed to test a trend —
          short records (for example from a recently launched mission) cannot yet tell a trend apart from natural ups and downs.
        </Notice>
      ) : !result.ok ? (
        <Notice>Not enough valid years in this period or time of year (at least {MIN_YEARS} are needed). Widen the period or pick another season.</Notice>
      ) : (
        <>
          <VerdictPanel variable={variable} result={result} place={place} season={season} onHelp={onHelp} />
          <div className="analysis-block">
            <h3>
              The evidence, year by year
              <SegmentedControl<ChartView> label="Chart view" options={VIEWS} value={view} onChange={setView} />
            </h3>
            <Legend
              items={[
                { color: "var(--s1)", label: seriesLabel(view) },
                { color: "var(--s2)", label: "Trend line" },
                { shape: "box", color: "var(--s2)", opacity: 0.3, label: "Uncertainty of the trend (95%)" },
                { shape: "dash", color: "var(--s3)", label: "Second estimate (Sen’s slope)" },
              ]}
            />
            <TimeSeriesChart
              variable={variable}
              result={result}
              grid={series.grid}
              origin={series.origin}
              months={season.months}
              y0={y0}
              y1={y1}
              view={view}
              seriesLabel={seriesLabel(view)}
            />
          </div>
          <div className="analysis-block">
            <h3>In which months does the change happen?</h3>
            <MonthlyTrendBars variable={variable} grid={series.grid} origin={series.origin} y0={y0} y1={y1} />
          </div>
          <details>
            <summary>Show the statistics and export</summary>
            <StatTiles variable={variable} result={result} />
            <div className="row" style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() =>
                  downloadText(
                    trendCsv(variable, result, place, { y0, y1, season: seasonId }, `${source} (${fileName})`),
                    `trend_imported_${y0}-${y1}.csv`,
                  )
                }
              >
                Download CSV with the trend
              </button>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
