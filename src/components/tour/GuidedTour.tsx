import { useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../../config/demos";
import { useInvestigation } from "../../state/InvestigationContext";
import { buildTourSteps } from "./tourSteps";
import "./GuidedTour.css";

/** Step-by-step walkthrough of a demo case. It drives the app through the same actions a user would take. */
export function GuidedTour({ demo, onClose }: { demo: Demo; onClose(): void }) {
  const { actions, analysis } = useInvestigation();
  const steps = useMemo(() => buildTourSteps(demo, actions), [demo, actions]);
  const [index, setIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const runId = useRef(0);

  const goTo = async (next: number) => {
    if (next >= steps.length) return onClose();
    const forward = next > index;
    const id = ++runId.current;
    setIndex(next);
    actions.goTo(steps[next].step);
    const run = steps[next].run;
    if (run && forward) {
      setBusy(true);
      try {
        await run();
      } finally {
        if (id === runId.current) setBusy(false);
      }
    }
  };

  // Start (or restart) when a demo is chosen.
  useEffect(() => {
    setIndex(-1);
    void goTo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  // Spotlight and scroll to the current step's target once its content is ready.
  const target = index >= 0 && !busy ? steps[index].target : null;
  useEffect(() => {
    if (!target) return;
    const el = document.getElementById(target);
    if (!el) return;
    el.classList.add("spotlight");
    // Tall targets start at the top so their heading stays visible; small ones are centred above the tour panel.
    const tall = el.getBoundingClientRect().height > window.innerHeight * 0.55;
    el.scrollIntoView({ behavior: "smooth", block: tall ? "start" : "center" });
    return () => el.classList.remove("spotlight");
  }, [target, analysis]);

  if (index < 0) return null;
  const last = index === steps.length - 1;

  return (
    <div className="tour" role="dialog" aria-label="Guided case">
      <div className="tour-title">Guided case · step {index + 1} of {steps.length}</div>
      <p>
        {busy ? (
          <><span className="spinner" />One moment…</>
        ) : (
          steps[index].text(analysis?.result ?? null)
        )}
      </p>
      <div className="row spread">
        <button type="button" onClick={onClose}>Exit</button>
        <div className="row">
          <button type="button" disabled={index === 0} onClick={() => goTo(index - 1)}>← Previous</button>
          <button type="button" className="primary" disabled={busy} onClick={() => goTo(index + 1)}>
            {last ? "Finish ✓" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
