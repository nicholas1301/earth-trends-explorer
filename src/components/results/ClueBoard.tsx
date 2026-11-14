import { VARIABLES, themeById } from "../../config/catalog";
import { decreaseColor, increaseColor } from "../../lib/colors";
import { formatNumber, formatPValue, formatSigned } from "../../lib/format";
import { LEVEL_LABELS, isSignificant, perDecade, type TrendResult } from "../../lib/trend";
import { useInvestigation, type Analysis } from "../../state/InvestigationContext";
import type { Variable } from "../../types";
import { Sparkline } from "../charts/Sparkline";
import { SectionHeading } from "../ui/SectionHeading";
import "./ClueBoard.css";

/** Step 3: every variable ranked by theme, typical clues and strength of evidence. */
export function ClueBoard({ analysis, onSelect }: { analysis: Analysis; onSelect(id: string): void }) {
  const { state } = useInvestigation();
  const { scan, ranked, hints, season } = analysis;
  const theme = themeById(state.theme);
  const place = state.investigation!.place;
  const placeKind = place.tag ?? state.investigation!.profile.kind;
  const nSignificant = VARIABLES.filter((v) => isSignificant(scan[v.id])).length;

  return (
    <section className="card" id="sec-clues">
      <SectionHeading step={3} title="Clue board" aside="click a row to investigate" />
      <p className="muted">
        We tested <b className="hl">{VARIABLES.length} variables</b> in {place.name} ({state.filters.y0}–{state.filters.y1},{" "}
        {season.name.toLowerCase()}): <b className="hl">{nSignificant}</b> have a significant trend. Variables from the “
        {theme.name}” theme come first, then typical clues for a <i>{placeKind}</i> place, always from the strongest
        evidence to the weakest.
      </p>
      <div className="table-scroll">
        <table className="clue-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Annual mean</th>
              <th className="num">Rate per decade</th>
              <th>Verdict</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((v) => {
              const r = scan[v.id];
              const select = () => onSelect(v.id);
              return (
                <tr
                  key={v.id}
                  tabIndex={0}
                  className={v.id === state.variable ? "selected" : undefined}
                  onClick={select}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); }
                  }}
                >
                  <td>
                    <span className="var-name">{v.name}</span>
                    {v.themes.includes(state.theme) && <span className="tag">{theme.icon} theme</span>}
                    {hints.has(v.id) && (
                      <span className="tag" title="Variable that usually yields good clues in places of this type">★ typical clue</span>
                    )}
                    <div className="var-def">{v.definition}</div>
                  </td>
                  <td>{r.ok && <Sparkline result={r} />}</td>
                  <td className="num">
                    {r.ok ? (
                      <>
                        {formatSigned(perDecade(r), v.digits)} <small className="muted">{v.unit}</small>
                      </>
                    ) : "—"}
                  </td>
                  <td><VerdictBadge result={r} variable={v} /></td>
                  <td><EvidenceDots result={r} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VerdictBadge({ result: r, variable: v }: { result: TrendResult; variable: Variable }) {
  if (!r.ok) {
    return <span className="verdict-badge flat"><i>·</i><small>insufficient data</small></span>;
  }
  const kind = r.direction > 0 ? "up" : r.direction < 0 ? "down" : "flat";
  const icon = { up: "▲", down: "▼", flat: "■" }[kind];
  const word = { up: "rising", down: "falling", flat: "stable" }[kind];
  const color = r.direction > 0 ? increaseColor(v) : r.direction < 0 ? decreaseColor(v) : undefined;
  return (
    <span className={`verdict-badge ${kind}`}>
      <i style={{ color }}>{icon}</i>
      {word}
      {r.direction !== 0 && <small> · {LEVEL_LABELS[r.level]}</small>}
    </span>
  );
}

function EvidenceDots({ result: r }: { result: TrendResult }) {
  if (!r.ok) return <>—</>;
  const max = LEVEL_LABELS.length - 1;
  return (
    <>
      <span className="evidence-dots" title={`Mann-Kendall: Z = ${formatNumber(r.mk.Z, 2)}, ${formatPValue(r.mk.p)}`}>
        {"●".repeat(r.level)}
        <s>{"●".repeat(max - r.level)}</s>
      </span>{" "}
      <small className="muted">{formatPValue(r.mk.p)}</small>
    </>
  );
}
