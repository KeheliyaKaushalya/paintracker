import type { ReactNode } from "react";
import { Field } from "../../shared/components/ui";

export function Section({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="acc" open={open}>
      <summary>{title}</summary>
      <div className="acc-body">{children}</div>
    </details>
  );
}

export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="stack-s" role="group" aria-label={label}>
      <span className="label">{label}</span>
      <div className="chips">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={`chip ${value === o ? "active" : ""}`}
            aria-pressed={value === o}
            onClick={() => onChange(value === o ? "" : o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`chip ${on ? "active" : ""}`}
      aria-pressed={on}
      onClick={() => onChange(!on)}
    >
      {on ? "✓ " : ""}
      {label}
    </button>
  );
}

export function Select({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <Field id={id} label={label}>
      <select
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}
