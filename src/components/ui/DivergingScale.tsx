import { divergingColor } from "../../lib/colors";
import { formatNumber } from "../../lib/format";
import type { Variable } from "../../types";
import "./DivergingScale.css";

/** Colour bar for the trend maps; the warm side is “increase” or “decrease” depending on the variable. */
export function DivergingScale({ variable, max }: { variable: Variable; max: number }) {
  const warmIsIncrease = variable.increase === "red";
  const value = formatNumber(max, variable.digits);
  const gradient = `linear-gradient(90deg, ${divergingColor(-1)}, ${divergingColor(0)}, ${divergingColor(1)})`;
  return (
    <div className="diverging-scale">
      <span>{warmIsIncrease ? "decrease" : "increase"} {value}</span>
      <span className="bar" style={{ background: gradient }} />
      <span>
        {warmIsIncrease ? "increase" : "decrease"} {value} {variable.unit}/decade
      </span>
      <span className="note">● cell/place with a significant trend (p &lt; 0.05)</span>
    </div>
  );
}
