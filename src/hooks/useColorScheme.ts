import { useCallback, useEffect, useState } from "react";

export type ColorScheme = "light" | "dark";

const read = (): ColorScheme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** Black-on-white or white-on-black. The initial value is set by the inline script in index.html. */
export function useColorScheme(): [ColorScheme, () => void] {
  const [scheme, setScheme] = useState<ColorScheme>(read);

  useEffect(() => {
    document.documentElement.dataset.theme = scheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", scheme === "dark" ? "#0b0b0b" : "#ffffff");
  }, [scheme]);

  const toggle = useCallback(() => {
    setScheme((s) => {
      const next = s === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("color-scheme", next);
      } catch {
        // Private mode: the choice just won't be remembered.
      }
      return next;
    });
  }, []);

  return [scheme, toggle];
}
