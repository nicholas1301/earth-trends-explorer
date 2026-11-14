import { useInvestigation } from "../../state/InvestigationContext";
import type { Variable, WhereTab } from "../../types";
import { RegionalTrendMap } from "../charts/RegionalTrendMap";
import { WorldComparison } from "../charts/WorldComparison";
import { SectionHeading } from "../ui/SectionHeading";
import { SegmentedControl } from "../ui/SegmentedControl";

const TABS: { value: WhereTab; label: string }[] = [
  { value: "region", label: "Around here (10° × 10°)" },
  { value: "world", label: "Across the world" },
];

/** Step 5: the same variable around the point and at other places. Heavy downloads only start on request. */
export function WhereSection({ variable }: { variable: Variable }) {
  const { state, actions } = useInvestigation();
  const { whereTab, regionRequested, worldRequested } = state;

  return (
    <section className="card" id="sec-where">
      <SectionHeading
        step={5}
        title="Where is it changing?"
        aside={<SegmentedControl label="Comparison" options={TABS} value={whereTab} onChange={actions.setWhereTab} />}
      />
      <p className="muted">
        The same variable can rise in one place and fall in another — sometimes through the same process. Compare.
      </p>

      <div hidden={whereTab !== "region"}>
        <div className="row">
          <button type="button" className="primary" onClick={() => actions.request("region")}>Map the neighborhood</button>
          <span className="muted">Downloads the full data grid around the point and calculates the trend of each cell.</span>
        </div>
        <div style={{ marginTop: 12 }}>{regionRequested && <RegionalTrendMap variable={variable} />}</div>
      </div>

      <div hidden={whereTab !== "world"}>
        <div className="row">
          <button type="button" className="primary" onClick={() => actions.request("world")}>Compare with other places</button>
          <span className="muted">Calculates the same trend at every place in the list from step 2.</span>
        </div>
        <div style={{ marginTop: 12 }}>{worldRequested && <WorldComparison variable={variable} />}</div>
      </div>
    </section>
  );
}
