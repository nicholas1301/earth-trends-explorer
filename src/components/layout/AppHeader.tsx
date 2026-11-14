import { useColorScheme } from "../../hooks/useColorScheme";
import { SpaceAppsLogo } from "./SpaceAppsLogo";
import "./AppHeader.css";

export function AppHeader({ onHome, onHelp }: { onHome(): void; onHelp(): void }) {
  const [scheme, toggleScheme] = useColorScheme();
  const dark = scheme === "dark";

  return (
    <header className="app-header">
      <button type="button" className="brand" onClick={onHome} title="Back to the start">
        <SpaceAppsLogo className="brand-logo" />
        <h1>Earth Trends Detective</h1>
      </button>
      <div className="header-actions">
        <button type="button" onClick={onHelp}>
          <span className="wide">How to read the results</span>
          <span className="narrow">Help</span>
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={toggleScheme}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          title={dark ? "Light mode" : "Dark mode"}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            {dark ? (
              <>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
              </>
            ) : (
              <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" strokeLinejoin="round" />
            )}
          </svg>
        </button>
      </div>
    </header>
  );
}
