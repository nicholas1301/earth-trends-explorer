import { FIRST_YEAR, LAST_YEAR, VARIABLES } from "../../config/catalog";
import { STORED_EXTRA_VARIABLES } from "../../lib/extras";
import { CHALLENGES } from "../../config/challenges";
import { DEMOS } from "../../config/demos";
import { useChallengeProgress } from "../../hooks/useChallengeProgress";
import { LEVEL_NAMES, recordPlaceLabel } from "../../lib/challenges";
import { formatSigned } from "../../lib/format";
import { ThemeIcon } from "../ui/ThemeIcon";
import "./Home.css";

/** Landing screen: one sentence about the tool, one button to start, the guided cases and the optional challenges. */
interface Props {
  onStart(): void;
  onStartDemo(index: number): void;
  /** Starts an optional challenge, solved with the regular tool. */
  onStartChallenge(id: string): void;
  /** Opens the screen that analyses a time series downloaded from another tool. */
  onImport(): void;
}

export function Home({ onStart, onStartDemo, onStartChallenge, onImport }: Props) {
  const { progress, isDone } = useChallengeProgress();
  const solved = CHALLENGES.filter((c) => isDone(c.id)).length;
  return (
    <>
      <section className="hero">
        <h2>
          What is changing
          <br />
          on our planet?
        </h2>
        <p className="lead">
          Pick a place. We check {LAST_YEAR - FIRST_YEAR + 1} years of NASA data, test {VARIABLES.length} variables{" "}
          {STORED_EXTRA_VARIABLES.length > 0 && <>(up to {VARIABLES.length + STORED_EXTRA_VARIABLES.length} at the featured places) </>}and tell you in plain words what is really changing.
        </p>
        <button type="button" className="primary big" onClick={onStart}>
          Start investigating →
        </button>
      </section>

      <section>
        <h3>First time here? Watch a guided case</h3>
        <div className="demos">
          {DEMOS.map((d, i) => (
            <button key={d.title} type="button" className="demo" onClick={() => onStartDemo(i)}>
              <ThemeIcon theme={d.theme} />
              <b>{d.title}</b>
              <span>{d.summary}</span>
              <span className="go">Watch the case →</span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-challenges">
        <h3>
          Feeling like a detective? Take a challenge
          {solved > 0 && <span className="tag">{solved} of {CHALLENGES.length} solved</span>}
        </h3>
        <p className="muted">Optional cases to crack with the tool itself. No timer and no wrong moves: explore, then answer.</p>
        <div className="demos">
          {CHALLENGES.map((c) => (
            <button key={c.id} type="button" className={`demo challenge${isDone(c.id) ? " solved" : ""}`} onClick={() => onStartChallenge(c.id)}>
              <span className="challenge-level">
                <ThemeIcon theme={c.theme} />
                {LEVEL_NAMES[c.level]}
                {isDone(c.id) && <span className="tag">Solved ✓</span>}
              </span>
              <b>{c.title}</b>
              <span>{c.summary}</span>
              {c.score && progress.best[c.id] != null && (
                <span>
                  {c.score.label}: {formatSigned(progress.best[c.id], c.score.digits)} {c.score.unit}
                  {progress.bestAt[c.id] && <> at {recordPlaceLabel(progress.bestAt[c.id])}</>}
                </span>
              )}
              <span className="go">{isDone(c.id) ? "Play again →" : "Take the challenge →"}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-import">
        <h3>Already have a time series?</h3>
        <p className="muted">
          Bring a file from NASA Giovanni (MODIS, OMI, AIRS, GPM, GLDAS…), NASA AppEEARS, KNMI Climate Explorer or a NOAA weather
          station and run the same trend tests on it.
        </p>
        <button type="button" onClick={onImport}>Analyze your own data →</button>
      </section>
    </>
  );
}
