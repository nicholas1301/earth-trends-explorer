import type { ReactNode } from "react";
import type { ThemeId } from "../../types";

const PATHS: Record<ThemeId, ReactNode> = {
  heat: <path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0ZM12 9v8" />,
  water: <path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z" />,
  ice: <path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M9.5 4 12 6.5 14.5 4M9.5 20l2.5-2.5 2.5 2.5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
    </>
  ),
  wind: <path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7a2.5 2.5 0 1 1-2.5 2.5" />,
  air: (
    <>
      <circle cx="8" cy="14.5" r="4.5" />
      <circle cx="17" cy="7.5" r="3" />
      <circle cx="17.5" cy="18" r="1.8" />
    </>
  ),
  life: <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14ZM5 19l8-8" />,
};

/** Line icon for an investigation topic, drawn in the current text colour. */
export function ThemeIcon({ theme, size = 28 }: { theme: ThemeId; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[theme]}
    </svg>
  );
}
