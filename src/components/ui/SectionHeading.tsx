import type { ReactNode } from "react";

interface Props {
  title: ReactNode;
  /** Right-hand side: a hint or controls. */
  aside?: ReactNode;
}

export function SectionHeading({ title, aside }: Props) {
  return (
    <h2>
      <span className="title">{title}</span>
      {typeof aside === "string" ? <span className="muted aside">{aside}</span> : aside}
    </h2>
  );
}
