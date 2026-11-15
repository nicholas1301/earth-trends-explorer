import { useInvestigation } from "../../state/InvestigationContext";
import type { Step } from "../../types";
import "./Stepper.css";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "place", label: "Place" },
  { id: "clues", label: "Trends" },
  { id: "verdict", label: "Evidence" },
  { id: "compare", label: "Compare" },
];

/** Progress through the investigation. Result steps unlock once a place has been investigated. */
export function Stepper() {
  const { state, actions, analysis } = useInvestigation();
  const current = STEPS.findIndex((s) => s.id === state.step);

  return (
    <nav className="stepper" aria-label="Investigation steps">
      <ol>
        {STEPS.map((s, i) => {
          const locked = i >= 1 && !analysis;
          return (
            <li key={s.id} className={i < current ? "done" : undefined}>
              <button
                type="button"
                disabled={locked}
                aria-current={i === current ? "step" : undefined}
                title={locked ? "Investigate a place first" : undefined}
                onClick={() => actions.goTo(s.id)}
              >
                <span className="step-number">{i + 1}</span>
                <span className="step-label">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
