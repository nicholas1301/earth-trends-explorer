import type { ReactNode } from "react";
import { decreaseColor, increaseColor } from "../../lib/colors";
import { formatNumber, formatPValue, formatSigned } from "../../lib/format";
import { SIGNIFICANT, yearsNeeded, type TrendOk } from "../../lib/trend";
import type { Place, Season, Variable } from "../../types";
import "./VerdictPanel.css";

interface Props {
  variable: Variable;
  result: TrendOk;
  place: Place;
  season: Season;
}

function Headline({ result: r }: { result: TrendOk }) {
  if (r.direction === 0) return <>■ No measurable change</>;
  const up = r.direction > 0;
  const arrow = up ? "▲" : "▼";
  if (r.level >= SIGNIFICANT) return <>{arrow} Significant {up ? "upward" : "downward"} trend</>;
  if (r.level === 1) return <>{arrow} Hint of an {up ? "increase" : "decrease"}, not yet significant</>;
  return <>{arrow} No significant trend</>;
}

function Explanation({ variable: v, result: r, place, season }: Props) {
  const first = r.years[0];
  const last = r.years[r.years.length - 1];
  const what = `${v.name.toLowerCase()} in ${place.name}${season.id === "year" ? "" : ` (${season.name})`}`;
  if (r.direction === 0) {
    return <>The {what} stayed at practically the same level between {first} and {last}.</>;
  }

  const perDecade = r.mk.sen * 10;
  const total = r.mk.sen * r.span;
  // Relative change is meaningless for temperatures (arbitrary zero).
  const relative = Math.abs(r.base) > 1e-9 && v.unit !== "°C" ? (total / Math.abs(r.base)) * 100 : null;
  const p = formatPValue(r.mk.p);
  const tSignificant = r.ols.p < 0.05;
  const mkSignificant = r.mk.p < 0.05;
  const needed = r.level < SIGNIFICANT ? yearsNeeded(r) : null;

  let testSentence: ReactNode;
  if (r.level >= SIGNIFICANT) testSentence = <>The Mann-Kendall test gives {p}: it would be very unlikely to see a pattern like this by chance.</>;
  else if (r.level === 1) testSentence = <>The Mann-Kendall test gives {p}: there is a signal, but it does not yet pass the conventional 0.05 threshold.</>;
  else testSentence = <>The Mann-Kendall test gives {p}: a change of this size easily appears by chance, given the ups and downs from one year to the next.</>;

  return (
    <>
      From {first} to {last}, the {what} {r.direction > 0 ? "rose" : "fell"} by about{" "}
      <b>{formatNumber(Math.abs(perDecade), v.digits)} {v.unit} per decade</b> — {formatSigned(total, v.digits)} {v.unit} over the period
      {relative != null && ` (${formatSigned(relative, 0)}% of the mean)`}. {testSentence}
      {tSignificant !== mkSignificant && (
        <span className="muted">
          {" "}Caution: the t-test ({formatPValue(r.ols.p)}){" "}
          {tSignificant ? "indicates significance, but Mann-Kendall does not" : "does not confirm significance"} — treat the result as uncertain.
        </span>
      )}
      {needed != null && (
        <span className="muted">
          {" "}If the same rate and variability continue, about <b className="hl">{needed} more years</b> of data would be needed
          for the trend to become significant.
        </span>
      )}
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub: ReactNode }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      <div className="tile-sub">{sub}</div>
    </div>
  );
}

/** Plain-language verdict plus the detailed statistics. */
export function VerdictPanel(props: Props) {
  const { variable: v, result: r } = props;
  const d = v.digits;
  const unit = <small>{v.unit}/decade</small>;
  const borderColor =
    r.direction === 0 || r.level < SIGNIFICANT ? "var(--line-soft)" : r.direction > 0 ? increaseColor(v) : decreaseColor(v);

  return (
    <div id="sec-verdict">
      <div className="verdict" style={{ borderLeftColor: borderColor }}>
        <strong><Headline result={r} /></strong>
        <Explanation {...props} />
      </div>
      <div className="tiles">
        <Tile label="Rate (Sen)" value={<>{formatSigned(r.mk.sen * 10, d)} {unit}</>} sub="median of the slopes" />
        <Tile
          label="Rate (regression)"
          value={<>{formatSigned(r.ols.slope * 10, d)} {unit}</>}
          sub={`95% CI: ${formatSigned(r.ols.lo * 10, d)} to ${formatSigned(r.ols.hi * 10, d)}`}
        />
        <Tile label="Mann-Kendall" value={formatPValue(r.mk.p)} sub={`Z = ${formatSigned(r.mk.Z, 2)} · τ = ${formatSigned(r.mk.tau, 2)}`} />
        <Tile
          label="t-test"
          value={formatPValue(r.ols.p)}
          sub={`t = ${formatSigned(r.ols.t, 2)} · effective n ${formatNumber(r.ols.effectiveN, 0)} of ${r.ols.n}`}
        />
        <Tile
          label="Total change"
          value={<>{formatSigned(r.mk.sen * r.span, d)} <small>{v.unit}</small></>}
          sub={`${r.years[0]}–${r.years[r.years.length - 1]} · mean ${formatNumber(r.base, d)}`}
        />
        <Tile
          label="Line fit"
          value={<>{formatNumber(r.ols.r2 * 100, 0)}<small>% of variation</small></>}
          sub={`R² · autocorrelation ${formatSigned(r.ols.r1, 2)}`}
        />
      </div>
    </div>
  );
}
