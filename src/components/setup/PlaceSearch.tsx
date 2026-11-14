import { useEffect, useId, useRef, useState } from "react";
import { searchPlaces, type GeocodeResult } from "../../lib/geocode";

interface Props {
  onSelect(result: GeocodeResult): void;
}

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "done"; results: GeocodeResult[] } | { kind: "error"; message: string };

const DEBOUNCE_MS = 300;

/** Search-as-you-type box for any city, state, country or landmark (ARIA combobox). */
export function PlaceSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setStatus({ kind: "idle" });
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setStatus({ kind: "loading" });
      searchPlaces(q, ctrl.signal).then(
        (results) => {
          setStatus({ kind: "done", results });
          setActive(results.length ? 0 : -1);
        },
        (e) => {
          if (!ctrl.signal.aborted) setStatus({ kind: "error", message: e instanceof Error ? e.message : "Place search failed" });
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  // Close the list when clicking elsewhere.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const results = status.kind === "done" ? status.results : [];
  const showList = open && status.kind !== "idle";

  const pick = (r: GeocodeResult) => {
    onSelect(r);
    setQuery(r.region ? `${r.name}, ${r.region}` : r.name);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (results.length) {
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((i) => (i + step + results.length) % results.length);
      }
    } else if (e.key === "Enter") {
      const r = results[active] ?? results[0];
      if (r && showList) {
        e.preventDefault();
        pick(r);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="place-search" ref={boxRef}>
      <input
        type="search"
        role="combobox"
        aria-label="Search for a place"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        placeholder="Search a city, state, country…"
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id={listId} role="listbox" className="place-search-list" aria-label="Matching places">
          {status.kind === "loading" && <li className="muted place-search-note">Searching…</li>}
          {status.kind === "error" && <li className="place-search-note error">{status.message}</li>}
          {status.kind === "done" && results.length === 0 && <li className="muted place-search-note">No places found.</li>}
          {results.map((r, i) => (
            <li
              key={r.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(r)}
            >
              <span className="place-search-name">{r.name}</span>
              <span className="muted">
                {r.region}
                {r.region && " · "}
                {r.kind}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
