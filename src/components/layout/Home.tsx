import { FIRST_YEAR, LAST_YEAR, VARIABLES } from "../../config/catalog";
import { DEMOS } from "../../config/demos";
import { ThemeIcon } from "../ui/ThemeIcon";
import "./Home.css";

/** Landing screen: one sentence about the tool, one button to start and the guided cases. */
interface Props {
  onStart(): void;
  onStartDemo(index: number): void;
  /** Opens the screen that analyses a time series downloaded from another tool. */
  onImport(): void;
}

export function Home({ onStart, onStartDemo, onImport }: Props) {
  return (
    <>
      <section className="hero">
        <h2>
          What is changing
          <br />
          on our planet?
        </h2>
        <p className="lead">
          Pick a place. We check {LAST_YEAR - FIRST_YEAR + 1} years of NASA data, test {VARIABLES.length} variables
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
