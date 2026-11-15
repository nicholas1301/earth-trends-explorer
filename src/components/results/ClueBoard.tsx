import { useState } from "react";
import { THEMES, VARIABLES, themeById } from "../../config/catalog";
import { decreaseColor, increaseColor } from "../../lib/colors";
import { formatNumber, formatPValue, formatSigned } from "../../lib/format";
import { LEVEL_LABELS, SIGNIFICANT, isSignificant, perDecade, type TrendResult } from "../../lib/trend";
import { useInvestigation, type Analysis } from "../../state/InvestigationContext";
import type { Variable } from "../../types";
import { Sparkline } from "../charts/Sparkline";
import { SectionHeading } from "../ui/SectionHeading";
import { ThemeIcon } from "../ui/ThemeIcon";
import "./ClueBoard.css";

interface Props {
  analysis: Analysis;
  onSelect(id: string): void;
  onBack(): void;
}

/** Step 2: every variable tested in this place, from the most to the least significant trend, optionally filtered by topic. */
export function ClueBoard({ analysis, onSelect, onBack }: Props) {
  const { state, actions } = useInvestigation();
  const [showAll, setShowAll] = useState(false);
  const { scan, ranked, hints } = analysis;
  const { topic } = state;
  const { place, profile } = state.investigation!;
  const nSignificant = VARIABLES.filter((v) => isSignificant(scan[v.id])).length;

  const inTopic = topic ? ranked.filter((v) => v.themes.includes(topic)) : ranked;
  const notable = inTopic.filter((v) => isSignificant(scan[v.id]));
  const hidden = inTopic.length - notable.length;

  const row = (v: Variable) => (
    <ClueRow key={v.id} variable={v} result={scan[v.id]} selected={v.id === state.variable} typical={hints.has(v.id)} onSelect={onSelect} />
  );

  return (
    <section id="sec-clues">
      <SectionHeading title={`Trends in ${place.name}`} />
      <p className="lead">
        We tested {VARIABLES.length} variables: <b className="hl">{nSignificant}</b> {nSignificant === 1 ? "shows" : "show"} a significant
        trend. Pick one to see the evidence.
      </p>
      <p className="muted">
        This place: {place.tag ?? profile.kind} · {formatNumber(profile.meanTemp, 1)} °C on average · {formatNumber(profile.annualRain, 0)} mm
        of rain per year
      </p>

      <div className="topic-filter" role="group" aria-label="Filter trends by topic">
        <button type="button" aria-pressed={topic === null} onClick={() => actions.setTopic(null)}>
          All topics
        </button>
        {THEMES.map((t) => (
          <button key={t.id} type="button" aria-pressed={topic === t.id} title={t.description} onClick={() => actions.setTopic(t.id)}>
            <ThemeIcon theme={t.id} size={16} />
            {t.name}
          </button>
        ))}
      </div>

      <h3 className="clue-group">
        {topic ? themeById(topic).name : "All variables"} · strongest trends first
      </h3>
      {!notable.length && !showAll && (
        <p className="muted">No variable {topic ? "in this topic " : ""}shows a significant trend.</p>
      )}
      <div className="clues">{(showAll ? inTopic : notable).map(row)}</div>
      {hidden > 0 && (
        <button type="button" className="link" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show only significant trends" : `Show the other ${hidden} variable${hidden > 1? 's' : ''}`}
        </button>
      )}
      <div className="step-nav" style={{ marginTop: 24 }}>
        <button type="button" onClick={onBack}>← Place</button>
      </div>
    </section>
  );
}

interface RowProps {
  variable: Variable;
  result: TrendResult;
  selected: boolean;
  /** Variable that usually yields good clues in places of this type. */
  typical: boolean;
  onSelect(id: string): void;
}

function ClueRow({ variable: v, result: r, selected, typical, onSelect }: RowProps) {
  return (
    <button type="button" className="clue" aria-current={selected || undefined} onClick={() => onSelect(v.id)}>
      <span className="clue-main">
        <span className="clue-name">
          {v.name}
          {typical && <span className="tag" title="Usually a good clue in places of this type">typical here</span>}
        </span>
        <span className="clue-def">{v.definition}</span>
      </span>
      <span className="clue-spark">{r.ok && <Sparkline result={r} />}</span>
      <Verdict result={r} variable={v} />
      <span className="clue-go" aria-hidden="true">→</span>
    </button>
  );
}

function Verdict({ result: r, variable: v }: { result: TrendResult; variable: Variable }) {
  if (!r.ok) return <span className="clue-verdict weak">Not enough data</span>;
  const kind = r.direction > 0 ? "up" : r.direction < 0 ? "down" : "flat";
  const icon = { up: "▲", down: "▼", flat: "■" }[kind];
  const word = { up: "Rising", down: "Falling", flat: "Stable" }[kind];
  const color = r.direction > 0 ? increaseColor(v) : r.direction < 0 ? decreaseColor(v) : undefined;
  return (
    <span className={`clue-verdict${r.level >= SIGNIFICANT ? "" : " weak"}`} title={`Mann-Kendall: Z = ${formatNumber(r.mk.Z, 2)}, ${formatPValue(r.mk.p)}`}>
      <span>
        <i style={{ color }}>{icon}</i> {word}
        {r.direction !== 0 && <> · {LEVEL_LABELS[r.level]}</>}
      </span>
      <small>
        {formatSigned(perDecade(r), v.digits)} {v.unit} per decade
      </small>
    </span>
  );
}
