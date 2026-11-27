import { PainScale } from "../../shared/components/PainScale";

export function OptionalPain({
  id,
  label,
  on,
  value,
  onToggle,
  onChange,
  error,
}: {
  id: string;
  label: string;
  on: boolean;
  value: number | null;
  onToggle: (on: boolean) => void;
  onChange: (n: number) => void;
  error?: string;
}) {
  return (
    <div className="stack-s">
      <button
        type="button"
        className={`chip ${on ? "active" : ""}`}
        aria-pressed={on}
        style={{ alignSelf: "flex-start" }}
        onClick={() => onToggle(!on)}
      >
        {on ? "✓ " : "+ "}
        {label}
      </button>
      {on && (
        <PainScale
          id={id}
          label={label}
          value={value}
          onChange={onChange}
          error={error}
        />
      )}
    </div>
  );
}
