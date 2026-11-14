import { THEMES } from "../../config/catalog";
import { useInvestigation } from "../../state/InvestigationContext";
import { SectionHeading } from "../ui/SectionHeading";
import { ThemeIcon } from "../ui/ThemeIcon";
import "./ThemePicker.css";

/** Step 1: what to investigate. The topic only decides which clues are shown first. */
export function ThemePicker({ onNext }: { onNext(): void }) {
  const { state, actions } = useInvestigation();
  return (
    <section id="q-theme">
      <SectionHeading title="What do you want to investigate?" />
      <p className="lead">Choose a topic. You can change it at any time.</p>
      <div className="theme-grid">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="theme-card"
            aria-pressed={t.id === state.theme}
            onClick={() => {
              actions.setTheme(t.id);
              onNext();
            }}
          >
            <ThemeIcon theme={t.id} size={34} />
            <b>{t.name}</b>
            <span>{t.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
