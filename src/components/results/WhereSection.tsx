import { useInvestigation } from "../../state/InvestigationContext";
import type { Variable, WhereTab } from "../../types";
import { RegionalTrendMap } from "../charts/RegionalTrendMap";
import { WorldComparison } from "../charts/WorldComparison";
import { SectionHeading } from "../ui/SectionHeading";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Notice } from "../ui/Status";

const TABS: { value: WhereTab; label: string }[] = [
  { value: "region", label: "Around here" },
  { value: "world", label: "Across the world" },
];

interface Props {
  variable: Variable;
  onBack(): void;
  onRestart(): void;
}

/** Step 5: the same variable around the point and at other places. Both comparisons load as soon as the step opens. */
export function WhereSection({ variable, onBack, onRestart }: Props) {
  const { state, actions } = useInvestigation();
  const { whereTab } = state;

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

      {/* Both comparisons load as soon as the step opens, so switching tabs is instant. */}
      <div hidden={whereTab !== "region"}>
        {variable.extra ? (
          <Notice>
            The map around the point needs the same record for every grid cell nearby, and {variable.name.toLowerCase()} is only stored for
            the featured places (it comes from NASA {variable.extra.tool}, which cannot be queried from the browser).{" "}
            <button type="button" className="link" onClick={() => actions.setWhereTab("world")}>Compare the featured places instead →</button>
          </Notice>
        ) : (
          <RegionalTrendMap variable={variable} />
        )}
      </div>

      <div hidden={whereTab !== "world"}>
        <WorldComparison variable={variable} />
      </div>

      <div className="step-nav" style={{ marginTop: 24 }}>
        <button type="button" onClick={onBack}>← Evidence</button>
        <button type="button" onClick={onRestart}>Start a new investigation</button>
      </div>
    </section>
  );
}
