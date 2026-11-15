import type { Filters, Place, PointData, ThemeId, Variable } from "../types";
import type { Scan } from "./clues";

/** What a challenge can see: the investigation currently on screen. Answers are always derived from it, never stored. */
export interface ChallengeView {
  place: Place;
  /** Variable currently open. */
  variable: string | null;
  filters: Filters;
  data: PointData;
  scan: Scan;
  ranked: Variable[];
}

/** One thing the user has to do in the tool; ticked automatically. */
export interface Task {
  label: string;
  done(view: ChallengeView): boolean;
  /** Place the task asks for; the card offers a shortcut to it, since it may not be in the user's saved places. */
  place?: Place;
}

export interface Quiz {
  question: string;
  options: string[];
  /** Index of the right option. */
  correct: number;
  /** Shown after the right answer: what was found and why it happens. */
  explain: string;
}

export type ChallengeLevel = "rookie" | "detective" | "master";
export const LEVEL_NAMES: Record<ChallengeLevel, string> = { rookie: "Rookie", detective: "Detective", master: "Master" };

export interface Challenge {
  id: string;
  level: ChallengeLevel;
  theme: ThemeId;
  title: string;
  summary: string;
  tasks: Task[];
  hint: string;
  /** Question asked once every task is done; null when the data on screen cannot answer it. */
  quiz?(view: ChallengeView): Quiz | null;
  /** For challenges without a question: shown when every task is done. */
  explain?: string;
  /** Personal record kept for open-ended challenges (higher is better). */
  score?: { label: string; unit: string; digits: number; value(view: ChallengeView): number | null };
}

export interface ChallengeStatus {
  tasks: boolean[];
  /** Every task is done. */
  ready: boolean;
}

export function evaluateChallenge(challenge: Challenge, view: ChallengeView | null): ChallengeStatus {
  const tasks = challenge.tasks.map((t) => (view ? t.done(view) : false));
  return { tasks, ready: tasks.every(Boolean) };
}

// ---- Progress (which challenges were solved, personal records) ----

export interface ChallengeProgress {
  done: string[];
  best: Record<string, number>;
}

/** localStorage key; bump the suffix if the stored shape ever changes. */
export const CHALLENGES_KEY = "challenges-v1";
const EMPTY: ChallengeProgress = { done: [], best: {} };

export function parseProgress(raw: string | null): ChallengeProgress {
  if (raw == null) return EMPTY;
  try {
    const data = JSON.parse(raw) as { done?: unknown; best?: unknown };
    const done = Array.isArray(data?.done) ? [...new Set(data.done.filter((x): x is string => typeof x === "string"))] : [];
    const best: Record<string, number> = {};
    if (data?.best && typeof data.best === "object") {
      for (const [id, value] of Object.entries(data.best)) if (typeof value === "number" && isFinite(value)) best[id] = value;
    }
    return { done, best };
  } catch {
    return EMPTY;
  }
}

export const withCompleted = (p: ChallengeProgress, id: string): ChallengeProgress =>
  p.done.includes(id) ? p : { ...p, done: [...p.done, id] };

/** Keeps the highest score seen for a challenge. */
export const withScore = (p: ChallengeProgress, id: string, value: number): ChallengeProgress =>
  p.best[id] != null && p.best[id] >= value ? p : { ...p, best: { ...p.best, [id]: value } };

// ---- Shared store: one progress record for every component and browser tab ----

type Listener = () => void;
const listeners = new Set<Listener>();
let current: ChallengeProgress | null = null;

function read(): ChallengeProgress {
  try {
    return parseProgress(localStorage.getItem(CHALLENGES_KEY));
  } catch {
    return EMPTY; // storage blocked (private mode, sandboxed frame)
  }
}

export function getProgress(): ChallengeProgress {
  return (current ??= read());
}

export function setProgress(next: ChallengeProgress): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(CHALLENGES_KEY, JSON.stringify(next));
  } catch {
    // Private mode: progress just won't be remembered.
  }
  listeners.forEach((l) => l());
}

export function subscribeProgress(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CHALLENGES_KEY) {
      current = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
