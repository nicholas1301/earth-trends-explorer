import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clamp } from "../lib/stats";

interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

interface TooltipApi {
  show(event: { clientX: number; clientY: number }, content: ReactNode): void;
  hide(): void;
}

const TooltipContext = createContext<TooltipApi | null>(null);

/** A single floating tooltip shared by every chart and map. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const show = useCallback<TooltipApi["show"]>((e, content) => setTip({ x: e.clientX, y: e.clientY, content }), []);
  const hide = useCallback(() => setTip(null), []);
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <TooltipContext.Provider value={api}>
      {children}
      {tip && <FloatingTooltip {...tip} />}
    </TooltipContext.Provider>
  );
}

function FloatingTooltip({ x, y, content }: TooltipState) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + 14, top: y + 16 });

  // Measure, then keep the tooltip inside the viewport (above the cursor when there is room).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setPos({
      left: clamp(x + 14, 4, window.innerWidth - w - 4),
      top: y - h - 12 < 4 ? y + 16 : y - h - 12,
    });
  }, [x, y, content]);

  return (
    <div ref={ref} className="tooltip" style={pos}>
      {content}
    </div>
  );
}

export function useTooltip(): TooltipApi {
  const ctx = useContext(TooltipContext);
  if (!ctx) throw new Error("useTooltip must be used inside <TooltipProvider>");
  return ctx;
}
