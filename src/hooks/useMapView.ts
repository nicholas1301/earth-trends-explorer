import { useCallback, useEffect, useRef, useState } from "react";
import { easeInOutCubic, interpolateView, pan, type MapView } from "../lib/mapView";

/**
 * Holds the map view and drives its animations (tweens and drag inertia) with requestAnimationFrame.
 * Any direct update cancels a running animation.
 */
export function useMapView(initial: MapView) {
  const [view, setViewState] = useState(initial);
  const viewRef = useRef(view);
  const frame = useRef(0);

  const commit = useCallback((v: MapView) => {
    viewRef.current = v;
    setViewState(v);
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);

  /** Immediate update (cancels animations). Accepts a value or an updater. */
  const setView = useCallback(
    (next: MapView | ((v: MapView) => MapView)) => {
      stop();
      commit(typeof next === "function" ? next(viewRef.current) : next);
    },
    [stop, commit],
  );

  /** Same as setView but keeps animations running (used inside drag handlers). */
  const update = useCallback((fn: (v: MapView) => MapView) => commit(fn(viewRef.current)), [commit]);

  const animateTo = useCallback(
    (target: MapView, ms: number) => {
      stop();
      const from = viewRef.current;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        commit(interpolateView(from, target, easeInOutCubic(t)));
        frame.current = t < 1 ? requestAnimationFrame(step) : 0;
      };
      frame.current = requestAnimationFrame(step);
    },
    [stop, commit],
  );

  /** Keeps panning with a decaying velocity after a fling. */
  const glide = useCallback(
    (vx: number, vy: number) => {
      stop();
      const step = () => {
        vx *= 0.93;
        vy *= 0.93;
        commit(pan(viewRef.current, vx, vy));
        frame.current = Math.hypot(vx, vy) > 0.15 ? requestAnimationFrame(step) : 0;
      };
      frame.current = requestAnimationFrame(step);
    },
    [stop, commit],
  );

  useEffect(() => stop, [stop]);

  return { view, viewRef, setView, update, animateTo, glide, stop };
}
