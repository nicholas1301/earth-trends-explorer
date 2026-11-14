import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { geoPath } from "d3-geo";
import type { MultiLineString } from "geojson";
import { formatCoord } from "../../lib/format";
import { LAND_GEOJSON } from "../../lib/geo";
import {
  MAP_H, MAP_W, MAX_ZOOM, center, centeredOn, flightDuration, globeRadius, homeView, initialView, invert, isVisible,
  makeProjection, pan, switchMode, zoomAt, zoomCentered, type LatLon, type MapMode,
} from "../../lib/mapView";
import { clamp } from "../../lib/stats";
import { useMapView } from "../../hooks/useMapView";
import { useTooltip } from "../../state/TooltipContext";
import { SegmentedControl } from "../ui/SegmentedControl";
import "./GeoMap.css";

export interface MapMarker extends LatLon {
  key: string;
  /** SVG drawn around (0, 0) in screen units — markers keep their size when zooming. */
  content: ReactNode;
  onClick?(): void;
  onPointerMove?(e: PointerEvent): void;
  onPointerLeave?(): void;
}

interface Props {
  label: string;
  initialMode: MapMode;
  initialCenter?: LatLon;
  markers: MapMarker[];
  /** Click on an empty spot of the Earth. */
  onPick?(p: LatLon): void;
  /** Animate to this point whenever `key` changes. */
  flyTo?: (LatLon & { key: number }) | null;
  /** Where the ⌂ button re-centres the globe. */
  home?: LatLon;
}

const SPHERE = { type: "Sphere" } as const;
const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
/** Meridians every 30° (pole to pole) and parallels every 30° between 60°S and 60°N. */
const GRATICULE: MultiLineString = {
  type: "MultiLineString",
  coordinates: [
    ...range(-180, 150, 30).map((lon) => range(-90, 90, 3).map((lat) => [lon, lat])),
    ...range(-60, 60, 30).map((lat) => range(-180, 180, 3).map((lon) => [lon, lat])),
  ],
};
const MODES: { value: MapMode; label: string }[] = [
  { value: "globe", label: "🌐 Globe" },
  { value: "flat", label: "🗺️ Flat" },
];
const DRAG_THRESHOLD_PX = 4;

interface DragState {
  last: [number, number];
  startX: number;
  startY: number;
  time: number;
  velocity: [number, number];
}

/**
 * Interactive world map: an orthographic globe (drag to rotate with inertia) or an Equal Earth flat map.
 * Wheel/pinch/double-click zoom, keyboard arrows and +/−, and a coordinate readout under the cursor.
 */
export function GeoMap({ label, initialMode, initialCenter, markers, onPick, flyTo, home }: Props) {
  const { view, viewRef, setView, update, animateTo, glide, stop } = useMapView(initialView(initialMode, initialCenter));
  const tooltip = useTooltip();
  const svgRef = useRef<SVGSVGElement>(null);
  const ids = useId().replace(/:/g, "");
  const [readout, setReadout] = useState("");
  const [dragging, setDragging] = useState(false);

  // ---------- Rendering ----------
  const paths = useMemo(() => {
    const path = geoPath(makeProjection(view));
    return { sphere: path(SPHERE) ?? "", graticule: path(GRATICULE) ?? "", land: path(LAND_GEOJSON) ?? "" };
  }, [view]);
  const projection = useMemo(() => makeProjection(view), [view]);
  const isGlobe = view.mode === "globe";
  const r = globeRadius(view);

  // ---------- Fly-to requests from the parent ----------
  useEffect(() => {
    if (!flyTo) return;
    animateTo(centeredOn(viewRef.current, flyTo), flightDuration(viewRef.current, flyTo));
  }, [flyTo?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Pointer gestures ----------
  const pointers = useRef(new Map<number, [number, number]>());
  const drag = useRef<DragState | null>(null);
  const pinch = useRef<{ distance: number; k: number; mid: [number, number] } | null>(null);
  const moved = useRef(false);

  const toViewBox = (e: { clientX: number; clientY: number }): [number, number] => {
    const b = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - b.left) * MAP_W) / b.width, ((e.clientY - b.top) * MAP_H) / b.height];
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stop();
    const p = toViewBox(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      drag.current = { last: p, startX: e.clientX, startY: e.clientY, time: performance.now(), velocity: [0, 0] };
      moved.current = false;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a[0] - b[0], a[1] - b[1]), k: viewRef.current.k, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      moved.current = true;
    }
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const p = toViewBox(e);
    if (!pointers.current.has(e.pointerId)) {
      const g = invert(viewRef.current, p[0], p[1]);
      setReadout(g ? formatCoord(g.lat, g.lon) : "");
      return;
    }
    pointers.current.set(e.pointerId, p);

    const pz = pinch.current;
    if (pz && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const target = (pz.k * Math.hypot(a[0] - b[0], a[1] - b[1])) / pz.distance;
      update((v) => zoomAt(v, target / v.k, pz.mid[0], pz.mid[1]));
      return;
    }

    const d = drag.current;
    if (!d) return;
    if (!moved.current && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD_PX) {
      moved.current = true;
      setDragging(true);
      try {
        svgRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // The pointer may already be gone (released or cancelled); dragging still works without capture.
      }
      tooltip.hide();
    }
    if (!moved.current) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.time);
    const dx = p[0] - d.last[0];
    const dy = p[1] - d.last[1];
    d.velocity = [d.velocity[0] * 0.6 + (dx / dt) * 0.4 * 16, d.velocity[1] * 0.6 + (dy / dt) * 0.4 * 16];
    d.last = p;
    d.time = now;
    update((v) => pan(v, dx, dy));
  };

  const onPointerEnd = (e: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    if (pointers.current.size || !d) return;
    drag.current = null;
    setDragging(false);
    const [vx, vy] = performance.now() - d.time < 80 ? d.velocity : [0, 0];
    if (Math.hypot(vx, vy) > 0.6) glide(vx, vy);
  };

  // A drag must not count as a click on the map or on a marker.
  const onClickCapture = (e: MouseEvent) => {
    if (!moved.current) return;
    e.stopPropagation();
    e.preventDefault();
    moved.current = false;
  };

  const onClick = (e: MouseEvent) => {
    const [x, y] = toViewBox(e);
    const g = invert(viewRef.current, x, y);
    if (g) onPick?.(g);
  };

  const onDoubleClick = (e: MouseEvent) => {
    e.preventDefault();
    const [x, y] = toViewBox(e);
    const g = invert(viewRef.current, x, y);
    if (g) animateTo(centeredOn(viewRef.current, g, clamp(viewRef.current.k * 2, 1, MAX_ZOOM)), flightDuration(viewRef.current, g));
  };

  // Wheel needs a non-passive listener so the page does not scroll while zooming.
  useEffect(() => {
    const svg = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [x, y] = toViewBox(e);
      const dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 300 : 1);
      setView((v) => zoomAt(v, Math.exp(-clamp(dy, -200, 200) * 0.0022), x, y));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [setView]);

  const goHome = () => animateTo(homeView(viewRef.current, home), 600);

  const onKeyDown = (e: KeyboardEvent) => {
    const step = viewRef.current.mode === "flat" ? 40 : 18;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (arrows[e.key]) setView((v) => pan(v, ...arrows[e.key]));
    else if (e.key === "+" || e.key === "=") setView((v) => zoomAt(v, 1.5));
    else if (e.key === "-" || e.key === "_") setView((v) => zoomAt(v, 1 / 1.5));
    else if (e.key === "0") goHome();
    else return;
    e.preventDefault();
  };

  return (
    <div className="geo-map">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        tabIndex={0}
        role="application"
        aria-label={`${label}. Drag to move, scroll or pinch to zoom, arrow keys to move, plus and minus to zoom.`}
        className={dragging ? "dragging" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={(e) => !pointers.current.has(e.pointerId) && setReadout("")}
        onClickCapture={onClickCapture}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        <defs>
          <radialGradient id={`${ids}-ocean`} cx="40%" cy="36%" r="70%">
            <stop offset="0" stopColor="#1c2a3d" />
            <stop offset=".75" stopColor="#121b28" />
            <stop offset="1" stopColor="#0b1119" />
          </radialGradient>
          <radialGradient id={`${ids}-shade`} cx="50%" cy="50%" r="50%">
            <stop offset=".86" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".45" />
          </radialGradient>
        </defs>
        {isGlobe && <circle className="geo-halo" cx={center.x} cy={center.y} r={r + 3} />}
        <path className="geo-sphere" d={paths.sphere} fill={`url(#${ids}-ocean)`} />
        <path className="geo-graticule" d={paths.graticule} />
        <path className="geo-land" d={paths.land} />
        {isGlobe && <circle cx={center.x} cy={center.y} r={r} fill={`url(#${ids}-shade)`} pointerEvents="none" />}
        <g>
          {markers.filter((m) => isVisible(view, m)).map((m) => {
            const [x, y] = projection([m.lon, m.lat]) ?? [0, 0];
            return (
              <g
                key={m.key}
                transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
                className={m.onClick ? "clickable" : undefined}
                onClick={m.onClick && ((e) => { e.stopPropagation(); m.onClick!(); })}
                onPointerMove={m.onPointerMove}
                onPointerLeave={m.onPointerLeave}
              >
                {m.content}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="geo-controls">
        <SegmentedControl label="Map projection" options={MODES} value={view.mode} onChange={(m) => setView((v) => switchMode(v, m))} />
      </div>
      <span className="geo-zoom">
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => animateTo(zoomCentered(viewRef.current, 1.8), 280)}>+</button>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => animateTo(zoomCentered(viewRef.current, 1 / 1.8), 280)}>−</button>
        <button type="button" title="Reset view" aria-label="Reset view" onClick={goHome}>⌂</button>
      </span>
      <div className="geo-readout">{readout}</div>
      <div className="geo-hint">drag · scroll to zoom · double-click to dive in</div>
    </div>
  );
}
