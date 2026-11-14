import { useEffect, useMemo, useState } from "react";
import { useChallengeProgress } from "../../hooks/useChallengeProgress";
import { LEVEL_NAMES, evaluateChallenge, type Challenge, type ChallengeView } from "../../lib/challenges";
import { formatSigned } from "../../lib/format";
import { useInvestigation } from "../../state/InvestigationContext";
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
  const { state, analysis } = useInvestigation();
  const { progress, complete, recordScore } = useChallengeProgress();
  const [collapsed, setCollapsed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [wrong, setWrong] = useState<number[]>([]);
  /** Explanation frozen at the moment the challenge was solved, so it survives further exploring. */
  const [solved, setSolved] = useState<string | null>(null);

  const { investigation, variable, filters } = state;
  const view = useMemo<ChallengeView | null>(
    () =>
      investigation && analysis
        ? { place: investigation.place, variable, filters, data: investigation.data, scan: analysis.scan, ranked: analysis.ranked }
        : null,
    [investigation, analysis, variable, filters],
  );
  const status = useMemo(() => evaluateChallenge(challenge, view), [challenge, view]);
  const quiz = useMemo(() => (status.ready && view && challenge.quiz ? challenge.quiz(view) : null), [status.ready, view, challenge]);
  const score = status.ready && view && challenge.score ? challenge.score.value(view) : null;

  // Challenges without a question are solved as soon as every task is done; open-ended ones keep the best score.
  useEffect(() => {
    if (!status.ready || challenge.quiz) return;
    complete(challenge.id);
    setSolved(challenge.explain ?? "");
    if (score != null) recordScore(challenge.id, score);
  }, [status.ready, score, challenge, complete, recordScore]);

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

  const best = progress.best[challenge.id];
  const doneCount = status.tasks.filter(Boolean).length;
  const label = `Challenge · ${LEVEL_NAMES[challenge.level]}`;

  if (collapsed) {
    return (
      <button type="button" className="challenge-pill" onClick={() => setCollapsed(false)} aria-label={`Show challenge: ${challenge.title}`}>
        <b>{solved != null ? "✓" : `${doneCount}/${status.tasks.length}`}</b> {challenge.title}
      </button>
    );
  }

  return (
    <aside className="challenge-card" aria-label="Challenge">
      <div className="challenge-head">
        <span className="challenge-label">{label}</span>
        <span className="row challenge-head-actions">
          <button type="button" className="link" onClick={() => setCollapsed(true)}>Minimize</button>
          <button type="button" className="link" onClick={onClose}>Quit</button>
        </span>
      </div>
      <b className="challenge-title">{challenge.title}</b>

      <ul className="challenge-tasks">
        {challenge.tasks.map((t, i) => (
          <li key={t.label} className={status.tasks[i] ? "done" : undefined}>
            <span aria-hidden="true">{status.tasks[i] ? "✓" : "○"}</span>
            {t.label}
          </li>
        ))}
      </ul>

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
    </aside>
  );
}
