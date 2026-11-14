import { useEffect, useState, type DependencyList } from "react";
import { describeError } from "../lib/powerApi";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  retry(): void;
}

/**
 * Runs an async loader whenever `deps` change (or when `enabled` turns on).
 * Results from outdated runs are ignored. Previous data is kept while reloading.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList, enabled = true): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let current = true;
    setLoading(true);
    setError(null);
    loader().then(
      (result) => { if (current) { setData(result); setLoading(false); } },
      (e) => { if (current) { setData(null); setError(describeError(e)); setLoading(false); } },
    );
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, attempt, ...deps]);

  return { data, error, loading, retry: () => setAttempt((n) => n + 1) };
}
