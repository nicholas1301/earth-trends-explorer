import type { ReactNode } from "react";

interface Props {
  step?: number;
  title: ReactNode;
  /** Right-hand side: a hint or controls. */
  aside?: ReactNode;
}

export function SectionHeading({ step, title, aside }: Props) {
  return (
    <h2>
      <span className="title">
        {step != null && <span className="step-badge">{step}</span>}
        {title}
      </span>
      {typeof aside === "string" ? <span className="muted aside">{aside}</span> : aside}
    </h2>
  );
}
