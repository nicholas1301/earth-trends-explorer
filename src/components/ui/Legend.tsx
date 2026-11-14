import type { CSSProperties, ReactNode } from "react";

export type KeyShape = "line" | "dash" | "box" | "hollow";

/** Small swatch matching a chart mark. */
export function LegendKey({ shape = "line", color, opacity }: { shape?: KeyShape; color: string; opacity?: number }) {
  const style: CSSProperties =
    shape === "box" ? { background: color, opacity } : { borderColor: color };
  return <i className={`key ${shape === "line" ? "" : shape}`} style={style} />;
}

export interface LegendItem {
  shape?: KeyShape;
  color: string;
  opacity?: number;
  label: ReactNode;
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="legend">
      {items.map((item, i) => (
        <span key={i}>
          <LegendKey shape={item.shape} color={item.color} opacity={item.opacity} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
