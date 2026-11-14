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
  /** Opens the “how to read the results” help. */
  onHelp(): void;
}

function Headline({ result: r }: { result: TrendOk }) {
  if (r.direction === 0) return <>No measurable change</>;
  const up = r.direction > 0;
  if (r.level >= SIGNIFICANT) return <>Significant {up ? "upward" : "downward"} trend</>;
  if (r.level === 1) return <>Hint of {up ? "an increase" : "a decrease"}, not yet significant</>;
  return <>No significant trend</>;
}

function Explanation({ variable: v, result: r, place, season }: Props) {
  const first = r.years[0];
  const last = r.years[r.years.length - 1];
  const what = `${v.name.toLowerCase()} in ${place.name}${season.id === "year" ? "" : ` (${season.name})`}`;
  if (r.direction === 0) {
    return <p>The {what} stayed at practically the same level between {first} and {last}.</p>;
  }

  const perDecade = r.mk.sen * 10;
  const total = r.mk.sen * r.span;
  // Relative change is meaningless for temperatures (arbitrary zero).
  const relative = Math.abs(r.base) > 1e-9 && v.unit !== "°C" ? (total / Math.abs(r.base)) * 100 : null;
  const p = formatPValue(r.mk.p);
  const tSignificant = r.ols.p < 0.05;
  const mkSignificant = r.mk.p < 0.05;
  const needed = r.level < SIGNIFICANT ? yearsNeeded(r) : null;

  let chance: ReactNode;
  if (r.level >= SIGNIFICANT) chance = <>A pattern this consistent would be very unlikely to appear by chance ({p}).</>;
  else if (r.level === 1) chance = <>There is a signal, but it could still be chance: it does not pass the usual threshold ({p}).</>;
  else chance = <>A change of this size easily appears by chance, given the ups and downs from one year to the next ({p}).</>;

  return (
    <>
      <p>
        From {first} to {last}, the {what} {r.direction > 0 ? "rose" : "fell"} by about{" "}
        <b>{formatNumber(Math.abs(perDecade), v.digits)} {v.unit} per decade</b> — {formatSigned(total, v.digits)} {v.unit} in total
        {relative != null && ` (${formatSigned(relative, 0)}% of the mean)`}.
      </p>
      <p>{chance}</p>
      {tSignificant !== mkSignificant && (
        <p className="muted">
          Caution: our two tests disagree (the t-test gives {formatPValue(r.ols.p)}), so treat this result as uncertain.
        </p>
      )}
      {needed != null && (
        <p className="muted">
          If the same pace continues, about <b className="hl">{needed} more years</b> of data would be needed for the trend to become
          significant.
        </p>
      )}
    </>
  );
}

/** Plain-language verdict: what changed, by how much, and whether it could be chance. */
export function VerdictPanel(props: Props) {
  const { variable: v, result: r } = props;
  const clear = r.direction !== 0 && r.level >= SIGNIFICANT;
  const color = !clear ? "var(--line-soft)" : r.direction > 0 ? increaseColor(v) : decreaseColor(v);
  const arrow = r.direction > 0 ? "▲" : r.direction < 0 ? "▼" : "■";

  return (
    <div className="verdict" id="sec-verdict" style={{ borderLeftColor: color }}>
      <strong>
        <i style={{ color: clear ? color : undefined }}>{arrow}</i> <Headline result={r} />
      </strong>
      <Explanation {...props} />
      <button type="button" className="link" onClick={props.onHelp}>What does “significant” mean?</button>
    </div>
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

/** The detailed statistics behind the verdict, for readers who want them. */
export function StatTiles({ variable: v, result: r }: { variable: Variable; result: TrendOk }) {
  const d = v.digits;
  const unit = <small>{v.unit}/decade</small>;
  return (
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
  );
}
