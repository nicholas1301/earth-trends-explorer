import { DEMOS } from "../../config/demos";
import "./IntroCard.css";

export function IntroCard({ onStartDemo }: { onStartDemo(index: number): void }) {
  return (
    <section className="card">
      <p className="intro">
        The planet is constantly changing — but <b>what</b> is changing, <b>where</b>, <b>by how much</b>, and is the
        change <b>statistically significant</b>? Pick a theme and a place: the tool fetches decades of real NASA
        satellite and model data, tests 20 variables and shows which of them have a real trend.
      </p>
      <h3>Never done this before? Watch a guided case</h3>
      <div className="demos">
        {DEMOS.map((d, i) => (
          <button key={d.title} type="button" className="demo" onClick={() => onStartDemo(i)}>
            <b>{d.title}</b>
            <span>{d.summary}</span>
            <span className="go">▶ Watch the case</span>
          </button>
        ))}
      </div>
    </section>
  );
}
