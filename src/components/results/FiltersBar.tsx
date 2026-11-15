import { FIRST_YEAR, LAST_YEAR, SEASONS } from "../../config/catalog";
import { useInvestigation } from "../../state/InvestigationContext";
import { SegmentedControl } from "../ui/SegmentedControl";

const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
/** Period shortcuts: 0 = all years, otherwise the last N years. */
const PERIODS = [
  { value: 0, label: "All", title: "All years" },
  { value: 30, label: "30 y", title: "Last 30 years" },
  { value: 20, label: "20 y", title: "Last 20 years" },
];

/** Period and time-of-year filters, shared by every result screen (cells of the ResultControls panel). */
export function FiltersBar() {
  const { state, actions } = useInvestigation();
  const { filters } = state;

  const activePeriod =
    PERIODS.find(({ value: n }) =>
      n ? filters.y1 === LAST_YEAR && filters.y0 === LAST_YEAR - n + 1 : filters.y0 === FIRST_YEAR && filters.y1 === LAST_YEAR,
    )?.value ?? null;

  return (
    <>
      <div className="ctl ctl-period" role="group" aria-labelledby="ctl-period-label">
        <span className="ctl-label" id="ctl-period-label">Period</span>
        <span className="ctl-input">
          <select aria-label="Start year" value={filters.y0} onChange={(e) => actions.setFilters({ y0: +e.target.value })}>
            {YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
          <span className="muted" aria-hidden>–</span>
          <select aria-label="End year" value={filters.y1} onChange={(e) => actions.setFilters({ y1: +e.target.value })}>
            {YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
          <SegmentedControl
            label="Period shortcuts"
            options={PERIODS}
            value={activePeriod}
            onChange={(n) => actions.setFilters({ y1: LAST_YEAR, y0: n ? LAST_YEAR - n + 1 : FIRST_YEAR })}
          />
        </span>
      </div>
      <label className="ctl">
        <span className="ctl-label">Time of year</span>
        <select value={filters.season} onChange={(e) => actions.setFilters({ season: e.target.value })}>
          {SEASONS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
    </>
  );
}
