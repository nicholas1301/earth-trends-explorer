import { useEffect, useMemo, useState } from "react";
import { useChallengeProgress } from "../../hooks/useChallengeProgress";
import { isCurrentSummary, useCompareResults } from "../../lib/compareResults";
import { LEVEL_NAMES, evaluateChallenge, recordPlaceLabel, type Challenge, type ChallengeView } from "../../lib/challenges";
import { formatSigned } from "../../lib/format";
import { useInvestigation } from "../../state/InvestigationContext";
import type { Place } from "../../types";
import "./ChallengeCard.css";

interface Props {
  challenge: Challenge;
  onClose(): void;
  /** Starts the next unsolved challenge; absent when there is none. */
  onNext?: () => void;
}

/**
 * Floating card for the active challenge. It only watches the investigation: the user solves the challenge with the
 * regular tool, and the card ticks the tasks, asks the question and checks the answer against the data on screen.
 */
export function ChallengeCard({ challenge, onClose, onNext }: Props) {
  const { state, actions, analysis } = useInvestigation();
  const { progress, complete, recordScore } = useChallengeProgress();
  const [collapsed, setCollapsed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [wrong, setWrong] = useState<number[]>([]);
  /** Explanation frozen at the moment the challenge was solved, so it survives further exploring. */
  const [solved, setSolved] = useState<string | null>(null);

  const { investigation, variable, filters, step, whereTab } = state;
  const compare = useCompareResults();
  const view = useMemo<ChallengeView | null>(() => {
    if (!investigation || !analysis) return null;
    const fresh = <T extends Parameters<typeof isCurrentSummary>[0]>(s: T) => (isCurrentSummary(s, investigation.id, variable, filters) ? s : null);
    return {
      place: investigation.place,
      variable,
      filters,
      data: investigation.data,
      scan: analysis.scan,
      ranked: analysis.ranked,
      step,
      whereTab,
      region: fresh(compare.region),
      world: fresh(compare.world),
    };
  }, [investigation, analysis, variable, filters, step, whereTab, compare]);
  const status = useMemo(() => evaluateChallenge(challenge, view), [challenge, view]);
  const quiz = useMemo(() => (status.ready && view && challenge.quiz ? challenge.quiz(view) : null), [status.ready, view, challenge]);
  const score = status.ready && view && challenge.score ? challenge.score.value(view) : null;

  // Challenges without a question are solved as soon as every task is done; open-ended ones keep the best score.
  useEffect(() => {
    if (!status.ready || challenge.quiz) return;
    complete(challenge.id);
    setSolved(challenge.explain ?? "");
    if (score != null && view) recordScore(challenge.id, score, view.place);
  }, [status.ready, score, challenge, complete, recordScore]); // eslint-disable-line react-hooks/exhaustive-deps

  // The wrong picks belong to one question; a new investigation or filter starts over.
  useEffect(() => setWrong([]), [quiz?.question, quiz?.correct]);

  const answer = (i: number) => {
    if (!quiz) return;
    if (i === quiz.correct) {
      complete(challenge.id);
      setSolved(quiz.explain);
    } else {
      setWrong((w) => [...w, i]);
      setShowHint(true);
    }
  };

  // Shortcut to a place the challenge asks for, which may not be among the user's saved places.
  const goToPlace = (place: Place) => {
    actions.setPlace(place);
    if (state.step !== "place") void actions.investigate({ place, variable });
  };

  const best = progress.best[challenge.id];
  const bestAt = progress.bestAt[challenge.id];
  const doneCount = status.tasks.filter(Boolean).length;
  const label = `Challenge · ${LEVEL_NAMES[challenge.level]}`;

  const tasks = (
    <ul className="challenge-tasks">
      {challenge.tasks.map((t, i) => (
        <li key={t.label} className={status.tasks[i] ? "done" : undefined}>
          <span aria-hidden="true">{status.tasks[i] ? "✓" : "○"}</span>
          {t.label}
          {t.place && !status.tasks[i] && (
            <button type="button" className="link challenge-go" onClick={() => goToPlace(t.place!)}>
              {state.step === "place" ? "Choose it" : "Go there"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  if (collapsed) {
    return (
      <button type="button" className="challenge-pill" onClick={() => setCollapsed(false)} aria-label={`Show challenge: ${challenge.title}`}>
        <b>{solved != null ? "✓" : `${doneCount}/${status.tasks.length}`}</b> {challenge.title}
      </button>
    );
  }

  return (
    <aside className="challenge-card" aria-label="Challenge">
      {/* The header never scrolls away: minimizing is how the user uncovers a chart the card hides. */}
      <div className="challenge-head">
        <span className="challenge-label">{label}</span>
        <span className="row challenge-head-actions">
          <button type="button" className="challenge-minimize" onClick={() => setCollapsed(true)} aria-label="Minimize challenge">
            <span aria-hidden="true">▾</span> Minimize
          </button>
          <button type="button" className="link" onClick={onClose}>Quit</button>
        </span>
      </div>

      <div className="challenge-body">
      <b className="challenge-title">{challenge.title}</b>

      {status.ready ? (
        // Every task done: fold the list so the question gets the room.
        <details className="challenge-tasks-done">
          <summary><span aria-hidden="true">✓</span> All {status.tasks.length} tasks done</summary>
          {tasks}
        </details>
      ) : (
        tasks
      )}

      {solved != null ? (
        <div className="challenge-solved" role="status">
          <b>Case solved ✓</b>
          {solved && <p>{solved}</p>}
        </div>
      ) : quiz ? (
        <div className="challenge-quiz">
          <p>{quiz.question}</p>
          <div className="challenge-options">
            {quiz.options.map((o, i) => (
              <button key={o} type="button" disabled={wrong.includes(i)} onClick={() => answer(i)}>
                {o}
              </button>
            ))}
          </div>
          {wrong.length > 0 && <p className="challenge-wrong" role="status">Not that one — check the evidence and try again.</p>}
        </div>
      ) : (
        status.ready && challenge.quiz && <p className="muted">There is not enough data in this period to answer. Try a longer period.</p>
      )}

      {challenge.score && best != null && (
        <p className="challenge-score">
          {challenge.score.label}: <b>{formatSigned(best, challenge.score.digits)} {challenge.score.unit}</b>
          {bestAt && <> at {recordPlaceLabel(bestAt)}</>}
          {score != null && score < best && <> · here: {formatSigned(score, challenge.score.digits)}</>}
        </p>
      )}

      {showHint && solved == null && <p className="challenge-hint"><b>Hint:</b> {challenge.hint}</p>}

      <div className="row spread challenge-foot">
        {solved == null ? (
          <button type="button" className="link" onClick={() => setShowHint((h) => !h)}>{showHint ? "Hide hint" : "Need a hint?"}</button>
        ) : (
          <span />
        )}
        {solved != null && (onNext ? <button type="button" className="primary" onClick={onNext}>Next challenge →</button> : <button type="button" className="primary" onClick={onClose}>Done</button>)}
      </div>
      </div>
    </aside>
  );
}

