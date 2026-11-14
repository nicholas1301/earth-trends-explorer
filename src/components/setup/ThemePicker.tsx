import { THEMES, themeById } from "../../config/catalog";
import { useInvestigation } from "../../state/InvestigationContext";
import { SectionHeading } from "../ui/SectionHeading";

/** Step 1: what to investigate. Changing the theme only re-orders the clue board. */
export function ThemePicker() {
  const { state, actions } = useInvestigation();
  return (
    <section className="card" id="q-theme">
      <SectionHeading step={1} title="What do you want to investigate?" />
      <div className="chips">
        {THEMES.map((t) => (
          <button key={t.id} type="button" className="chip" aria-pressed={t.id === state.theme} onClick={() => actions.setTheme(t.id)}>
            {t.icon} {t.name}
          </button>
        ))}
      </div>
      <p className="muted" style={{ margin: "10px 0 0" }}>
        {themeById(state.theme).description}
      </p>
    </section>
  );
}
