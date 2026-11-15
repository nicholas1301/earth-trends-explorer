import { useMemo, useSyncExternalStore } from "react";
import { type RecordPlace, getProgress, setProgress, subscribeProgress, withCompleted, withScore } from "../lib/challenges";

/** Solved challenges and personal records (persisted in localStorage). */
export function useChallengeProgress() {
  const progress = useSyncExternalStore(subscribeProgress, getProgress);
  return useMemo(
    () => ({
      progress,
      isDone: (id: string) => progress.done.includes(id),
      complete: (id: string) => setProgress(withCompleted(getProgress(), id)),
      recordScore: (id: string, value: number, at?: RecordPlace) => setProgress(withScore(getProgress(), id, value, at)),
    }),
    [progress],
  );
}
