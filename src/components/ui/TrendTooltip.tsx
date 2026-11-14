import { formatPValue, formatSigned } from "../../lib/format";
import { LEVEL_LABELS, perDecade, type TrendResult } from "../../lib/trend";
import type { Variable } from "../../types";

/** Tooltip body used by the monthly bars and both trend maps. */
export function TrendTooltip({ title, result, variable }: { title: string; result: TrendResult; variable: Variable }) {
  return (
    <>
      <div className="tooltip-title">{title}</div>
      {result.ok ? (
        <>
          <b>{formatSigned(perDecade(result), variable.digits)}</b> {variable.unit} per decade
          <br />
          {LEVEL_LABELS[result.level]} ({formatPValue(result.mk.p)})
        </>
      ) : (
        "not enough data"
      )}
    </>
  );
}
