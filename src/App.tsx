import { useEffect, useState } from "react";
import { DEMOS } from "./config/demos";
import { AppHeader } from "./components/layout/AppHeader";
import { HelpDialog } from "./components/layout/HelpDialog";
import { Home } from "./components/layout/Home";
import { SpaceAppsLogo } from "./components/layout/SpaceAppsLogo";
import { Stepper } from "./components/layout/Stepper";
import { AnalysisSection } from "./components/results/AnalysisSection";
import { ClueBoard } from "./components/results/ClueBoard";
import { FiltersBar } from "./components/results/FiltersBar";
import { ImportSection } from "./components/results/ImportSection";
import { SelectionBar } from "./components/results/SelectionBar";
import { WhereSection } from "./components/results/WhereSection";
import { PlacePicker } from "./components/setup/PlacePicker";
import { GuidedTour } from "./components/tour/GuidedTour";
import { ErrorMessage, Loading, Notice } from "./components/ui/Status";
import { formatCoord } from "./lib/format";
import { FIRST_YEAR, LAST_YEAR } from "./config/catalog";
import { useInvestigation } from "./state/InvestigationContext";

/** One screen per step: home → place → clues → verdict → compare (plus the import screen, reached from home). */
export function App() {
  const { state, actions, analysis } = useInvestigation();
  const [demoIndex, setDemoIndex] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const { step } = state;
  const touring = demoIndex != null;
  const isResult = step === "clues" || step === "verdict" || step === "compare";

  // Each step starts at the top of the page (the guided tour scrolls to its own targets).
  useEffect(() => {
    if (!touring) window.scrollTo({ top: 0 });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <AppHeader onHome={() => actions.goTo("home")} onHelp={() => setHelpOpen(true)} />
      {step !== "home" && step !== "import" && <Stepper />}

      <main>
        {step === "home" && (
          <Home onStart={() => actions.goTo("place")} onStartDemo={setDemoIndex} onImport={() => actions.goTo("import")} />
        )}
        {step === "import" && <ImportSection onBack={() => actions.goTo("home")} onHelp={() => setHelpOpen(true)} />}
        {step === "place" && <PlacePicker onInvestigated={() => actions.goTo("clues")} onBack={() => actions.goTo("home")} />}

        {(isResult || step === "place") && state.loading && (
          <Loading>
            Fetching {LAST_YEAR - FIRST_YEAR + 1} years of NASA data for {state.place.name} ({formatCoord(state.place.lat, state.place.lon)})…
          </Loading>
        )}
        {(isResult || step === "place") && state.error && (
          <ErrorMessage onRetry={actions.retry} retryLabel="try again">
            Could not get the data ({state.error}). Check your connection and
          </ErrorMessage>
        )}

        {isResult && !analysis && !state.loading && !state.error && (
          <Notice>
            Nothing to show yet.{" "}
            <button type="button" className="link" onClick={() => actions.goTo("place")}>Choose a place to investigate</button>
          </Notice>
        )}

        {isResult && analysis && (
          <div className={`stack${state.loading ? " dimmed" : ""}`}>
            <div className="result-controls">
              <SelectionBar showVariable={step !== "clues"} />
              <FiltersBar />
            </div>
            {step === "clues" && (
              <ClueBoard
                analysis={analysis}
                onBack={() => actions.goTo("place")}
                onSelect={(id) => {
                  actions.selectVariable(id);
                  actions.goTo("verdict");
                }}
              />
            )}
            {step === "verdict" && (
              <AnalysisSection
                analysis={analysis}
                onBack={() => actions.goTo("clues")}
                onNext={() => actions.goTo("compare")}
                onHelp={() => setHelpOpen(true)}
              />
            )}
            {step === "compare" && analysis.variable && (
              <WhereSection
                key={analysis.variable.id}
                variable={analysis.variable}
                onBack={() => actions.goTo("verdict")}
                onRestart={() => actions.goTo("place")}
              />
            )}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <SpaceAppsLogo />
        <span>
          Built for the NASA Space Apps Challenge · Data: NASA POWER (MERRA-2, CERES), {FIRST_YEAR}–{LAST_YEAR}
        </span>
      </footer>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      {touring && <GuidedTour demo={DEMOS[demoIndex]} onClose={() => setDemoIndex(null)} />}
    </>
  );
}
