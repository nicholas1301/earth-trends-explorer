import { useInvestigation } from "../../state/InvestigationContext";
import type { Variable, WhereTab } from "../../types";
import { RegionalTrendMap } from "../charts/RegionalTrendMap";
import { WorldComparison } from "../charts/WorldComparison";
import { SectionHeading } from "../ui/SectionHeading";
import { SegmentedControl } from "../ui/SegmentedControl";

const TABS: { value: WhereTab; label: string }[] = [
  { value: "region", label: "Around here" },
  { value: "world", label: "Across the world" },
];

interface Props {
  variable: Variable;
  onBack(): void;
  onRestart(): void;
}

/** Step 5: the same variable around the point and at other places. Heavy downloads only start on request. */
export function WhereSection({ variable, onBack, onRestart }: Props) {
  const { state, actions } = useInvestigation();
  const { whereTab, regionRequested, worldRequested } = state;

  return (
    <section id="sec-where">
      <SectionHeading
        title="Where is it changing?"
        aside={<SegmentedControl label="Comparison" options={TABS} value={whereTab} onChange={actions.setWhereTab} />}
      />
      <p className="lead">
        {variable.name} can rise in one place and fall in another. Compare {state.investigation!.place.name} with its surroundings or
        with the rest of the world.
      </p>

      <div hidden={whereTab !== "region"}>
        {regionRequested ? (
          <RegionalTrendMap variable={variable} />
        ) : (
          <div className="row">
            <button type="button" className="primary" onClick={() => actions.request("region")}>Map the surroundings</button>
            <span className="muted">Calculates the trend of every map cell in a 10° × 10° area around the place.</span>
          </div>
        )}
      </div>

      <div hidden={whereTab !== "world"}>
        {worldRequested ? (
          <WorldComparison variable={variable} />
        ) : (
          <div className="row">
            <button type="button" className="primary" onClick={() => actions.request("world")}>Compare with other places</button>
            <span className="muted">Calculates the same trend at each suggested place.</span>
          </div>
        )}
      </div>

      <div className="step-nav" style={{ marginTop: 24 }}>
        <button type="button" onClick={onBack}>← Verdict</button>
        <button type="button" onClick={onRestart}>Start a new investigation</button>
      </div>
    </section>
  );
}
