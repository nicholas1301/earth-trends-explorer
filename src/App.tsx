import { useState } from "react";
import { DEMOS } from "./config/demos";
import { AppHeader } from "./components/layout/AppHeader";
import { Glossary } from "./components/layout/Glossary";
import { IntroCard } from "./components/layout/IntroCard";
import { AnalysisSection } from "./components/results/AnalysisSection";
import { ClueBoard } from "./components/results/ClueBoard";
import { FiltersBar } from "./components/results/FiltersBar";
import { WhereSection } from "./components/results/WhereSection";
import { PlacePicker } from "./components/setup/PlacePicker";
import { ThemePicker } from "./components/setup/ThemePicker";
import { GuidedTour } from "./components/tour/GuidedTour";
import { ErrorMessage, Loading } from "./components/ui/Status";
import { formatCoord } from "./lib/format";
import { FIRST_YEAR, LAST_YEAR } from "./config/catalog";
import { useInvestigation } from "./state/InvestigationContext";

const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export function App() {
  const { state, actions, analysis } = useInvestigation();
  const [demoIndex, setDemoIndex] = useState<number | null>(null);

  const selectVariable = (id: string) => {
    actions.selectVariable(id);
    scrollToId("sec-chart");
  };

  return (
    <>
      <AppHeader />
      <main>
        <IntroCard onStartDemo={setDemoIndex} />

        <div className="cols">
          <ThemePicker />
          <PlacePicker onInvestigated={() => scrollToId("filters")} />
        </div>

        {state.loading && (
          <Loading>
            Fetching {LAST_YEAR - FIRST_YEAR + 1} years of NASA data for {state.place.name} ({formatCoord(state.place.lat, state.place.lon)})…
          </Loading>
        )}
        {state.error && (
          <ErrorMessage onRetry={actions.retry} retryLabel="try again">
            Could not get the data ({state.error}). Check your connection and
          </ErrorMessage>
        )}

        {analysis && (
          <div className={`stack${state.loading ? " dimmed" : ""}`}>
            <FiltersBar />
            <ClueBoard analysis={analysis} onSelect={selectVariable} />
            <AnalysisSection analysis={analysis} />
            {analysis.variable && <WhereSection key={`${state.investigation!.id}:${analysis.variable.id}`} variable={analysis.variable} />}
          </div>
        )}

        <Glossary />
      </main>

      {demoIndex != null && <GuidedTour demo={DEMOS[demoIndex]} onClose={() => setDemoIndex(null)} />}
    </>
  );
}
