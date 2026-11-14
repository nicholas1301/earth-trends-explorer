import type { ReactNode } from "react";
import { SectionHeading } from "../ui/SectionHeading";
import "./Glossary.css";

const TERMS: Array<{ term: string; definition: ReactNode }> = [
  { term: "Trend", definition: "Change that goes in one direction over time. Here it is measured as a straight line: how much the variable rises or falls each decade." },
  {
    term: "Significance and p-value",
    definition: (
      <>
        The p-value answers: “if there were no trend at all, what is the chance of seeing, by pure luck, something this strong?”. By
        convention, p &lt; 0.05 (less than 5%) is called <i>significant</i>.
      </>
    ),
  },
  { term: "Mann-Kendall test", definition: "Compares each year with all following years and counts how many times the value rose or fell. It does not require the data to follow a normal curve or the change to be a perfect straight line — which is why it is the main test here." },
  { term: "Sen’s slope", definition: "The median of the slopes between all pairs of years. It is a rate estimate that resists extreme years (a drought or a strong El Niño)." },
  { term: "Linear regression and t-test", definition: "Fits the least-squares line and tests whether the slope differs from zero. The 95% confidence interval shows the range of rates compatible with the data; if it does not include zero, the trend is significant." },
  { term: "Autocorrelation", definition: "Neighboring years tend to look alike, which makes the series “worth” fewer independent points. The t-test here uses an effective sample size corrected for 1-year autocorrelation." },
  { term: "Anomaly", definition: "A month’s value minus the typical mean for that month. It removes the seasonal cycle, making the long-term change easier to see." },
  { term: "Reanalysis (MERRA-2)", definition: "A NASA global model that combines millions of satellite and station observations to reconstruct the state of the atmosphere and surface, in cells of about 50 km." },
];

export function Glossary() {
  return (
    <section className="card">
      <SectionHeading title="How to read the results" />
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
          Coastlines: Natural Earth (public domain).
        </p>
      </details>
    </section>
  );
}
