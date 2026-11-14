import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { InvestigationProvider } from "./state/InvestigationContext";
import { TooltipProvider } from "./state/TooltipContext";
import "@fontsource/bebas-neue/latin-400.css";
import "@fontsource/fira-sans/latin-400.css";
import "@fontsource/fira-sans/latin-500.css";
import "@fontsource/fira-sans/latin-600.css";
import "@fontsource/fira-sans/latin-700.css";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <InvestigationProvider>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </InvestigationProvider>
  </StrictMode>,
);
