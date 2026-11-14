import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { InvestigationProvider } from "./state/InvestigationContext";
import { TooltipProvider } from "./state/TooltipContext";
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
