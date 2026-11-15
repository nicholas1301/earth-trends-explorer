import { useEffect, useRef, type ReactNode } from "react";
import { STORED_EXTRA_VARIABLES } from "../../lib/extras";
import { FURTHER_READING } from "../../config/externalSources";
import "./HelpDialog.css";

const TERMS: Array<{ term: string; definition: ReactNode }> = [
  { term: "Trend", definition: "Change that goes in one direction over time. Here it is measured as a straight line: how much the variable rises or falls each decade." },
  {
    term: "Significant (p-value)",
    definition: (
      <>
        The p-value answers: “if there were no trend at all, what is the chance of seeing, by pure luck, something this strong?”. By
        convention, p &lt; 0.05 (less than 5%) is called <i>significant</i>.
      </>
    ),
  },
  { term: "Mann-Kendall test", definition: "Compares each year with all following years and counts how many times the value rose or fell. It does not require the data to follow a normal curve or the change to be a perfect straight line — which is why it is the main test here." },
  { term: "Sen’s slope", definition: "The median of the slopes between all pairs of years. It is a rate estimate that resists extreme years (a drought or a strong El Niño)." },
  { term: "Trend line and t-test", definition: "Fits the least-squares regression line and tests whether its slope differs from zero. The 95% confidence band shows the range of rates compatible with the data; if it does not include a flat line, the trend is significant." },
  { term: "Autocorrelation", definition: "Neighboring years tend to look alike, which makes the series “worth” fewer independent points. The t-test here uses an effective sample size corrected for 1-year autocorrelation." },
  { term: "Anomaly (“without seasons”)", definition: "A month’s value minus the typical mean for that month. It removes the seasonal cycle, making the long-term change easier to see. The yearly points are averages of these monthly anomalies — the same recipe used in NASA studies of satellite time series." },
  { term: "Record length", definition: "Short records rarely give significant trends: year-to-year noise hides a slow change. A mission launched a few years ago (for example SWOT, 2022) cannot show a trend yet, while 40 years of reanalysis or station data often can." },
  { term: "Reanalysis (MERRA-2)", definition: "A NASA global model that combines millions of satellite and station observations to reconstruct the state of the atmosphere and surface, in cells of about 50 km." },
];

const tools = STORED_EXTRA_VARIABLES.map((v) => v.extra!.tool);

/** Glossary, sources and limitations — kept out of the main flow and opened on demand. */
export function HelpDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="help-dialog"
      aria-labelledby="help-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="help-body">
        <div className="help-head">
          <h2 id="help-title">How to read the results</h2>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <p className="lead">
          Every result answers three questions: is it going <b className="hl">up or down</b>, <b className="hl">how fast</b>, and could
          it be <b className="hl">just chance</b>?
        </p>
        <dl className="glossary">
          {TERMS.map(({ term, definition }) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{definition}</dd>
            </div>
          ))}
        </dl>
        <details>
          <summary>Sources and limitations</summary>
          <p className="muted" style={{ marginTop: 8 }}>
            Monthly data from the <b>NASA POWER</b> project (power.larc.nasa.gov): meteorology and soil from the <b>MERRA-2</b> reanalysis
            (since 1981), radiation and clouds from <b>CERES/SRB</b> (since 1984) and aerosols from CERES SYN1deg (since 2001). Each point
            represents the model cell containing the location, not a station. Annual means are calculated from monthly anomalies; years with
            fewer than 75% of the months are discarded. The “Dec–Feb” season uses the three months of the same calendar year. Reanalyses may
            contain artificial jumps when new satellites enter the system; treat a result as a clue to confirm with other sources, not as final
            proof. The analysis only detects linear/monotonic trends. “Significant” does not mean “important” and does not identify the cause.
            {STORED_EXTRA_VARIABLES.length > 0 && (
              <>
                At the featured places, {STORED_EXTRA_VARIABLES.length} more records are stored in the app, downloaded in advance because
                their tools need a NASA login: {STORED_EXTRA_VARIABLES.map((v) => `${v.name} (${v.source})`).join(", ")}.
                {tools.includes("AppEEARS") && " Records from NASA AppEEARS are the mean of points within about 1 km of the place (22 km for fire)."}
                {tools.includes("Giovanni") && " Records from NASA Giovanni are the value of the grid cell containing the place."} Most start
                around 2000, so their trends cover a shorter period.{" "}
              </>
            )}
            Coastlines: Natural Earth (public domain). Imported files are averaged per calendar month and analysed with the same methods;
            their quality and units are those of the original tool.
          </p>
        </details>
        <details>
          <summary>Further reading</summary>
          <ul className="reading">
            {FURTHER_READING.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a>
                <span className="muted"> — {r.note}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </dialog>
  );
}
