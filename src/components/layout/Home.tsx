import { FIRST_YEAR, LAST_YEAR, VARIABLES } from "../../config/catalog";
import { DEMOS } from "../../config/demos";
import { ThemeIcon } from "../ui/ThemeIcon";
import "./Home.css";

/** Landing screen: one sentence about the tool, one button to start and the guided cases. */
export function Home({ onStart, onStartDemo }: { onStart(): void; onStartDemo(index: number): void }) {
  return (
    <>
      <section className="hero">
        <h2>
          What is changing
          <br />
          on our planet?
        </h2>
        <p className="lead">
          Pick a topic and a place. We check {LAST_YEAR - FIRST_YEAR + 1} years of NASA data, test {VARIABLES.length} variables
          and tell you in plain words what is really changing.
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
    </>
  );
}
