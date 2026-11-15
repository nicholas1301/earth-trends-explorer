interface Option<T extends string | number> {
  value: T;
  label: string;
  /** Longer name, shown as a tooltip and read by screen readers. */
  title?: string;
}

interface Props<T extends string | number> {
  options: Option<T>[];
  /** Value whose button is pressed; null = none. */
  value: T | null;
  onChange(value: T): void;
  label?: string;
}

export function SegmentedControl<T extends string | number>({ options, value, onChange, label }: Props<T>) {
  return (
    <span className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} title={o.title} aria-label={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </span>
  );
}
