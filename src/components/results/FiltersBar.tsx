import { FIRST_YEAR, LAST_YEAR, SEASONS } from "../../config/catalog";
import { useInvestigation } from "../../state/InvestigationContext";
import { SegmentedControl } from "../ui/SegmentedControl";
import "./FiltersBar.css";

const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
/** Period shortcuts: 0 = all years, otherwise the last N years. */
const PERIODS = [
  { value: 0, label: "All years" },
  { value: 30, label: "Last 30" },
  { value: 20, label: "Last 20" },
];

/** Period and time-of-year filters, shared by every result screen. */
export function FiltersBar() {
  const { state, actions } = useInvestigation();
  const { filters } = state;

  const activePeriod =
    PERIODS.find(({ value: n }) =>
      n ? filters.y1 === LAST_YEAR && filters.y0 === LAST_YEAR - n + 1 : filters.y0 === FIRST_YEAR && filters.y1 === LAST_YEAR,
    )?.value ?? null;

  return (
    <div className="filters-bar" id="filters">
      <label className="field">
        Period
        <select aria-label="Start year" value={filters.y0} onChange={(e) => actions.setFilters({ y0: +e.target.value })}>
          {YEARS.map((y) => <option key={y}>{y}</option>)}
        </select>
        to
        <select aria-label="End year" value={filters.y1} onChange={(e) => actions.setFilters({ y1: +e.target.value })}>
          {YEARS.map((y) => <option key={y}>{y}</option>)}
        </select>
      </label>
      <SegmentedControl
        label="Period shortcuts"
        options={PERIODS}
        value={activePeriod}
        onChange={(n) => actions.setFilters({ y1: LAST_YEAR, y0: n ? LAST_YEAR - n + 1 : FIRST_YEAR })}
      />
      <label className="field">
        Time of year
        <select value={filters.season} onChange={(e) => actions.setFilters({ season: e.target.value })}>
          {SEASONS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
    </div>
  );
}
