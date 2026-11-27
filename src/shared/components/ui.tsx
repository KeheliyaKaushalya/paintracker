import { useState, useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return <div className="spinner" role="status" aria-label={label} />;
}

export function ErrorBox({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const msg = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="error-box stack-s" role="alert">
      <strong>Could not load this.</strong>
      <span>{msg}</span>
      {onRetry && (
        <button
          className="btn btn-outline btn-sm"
          onClick={onRetry}
          style={{ alignSelf: "flex-start" }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <p style={{ fontWeight: 600, color: "var(--ink)" }}>{title}</p>
      {children && <p style={{ marginTop: 4 }}>{children}</p>}
    </div>
  );
}

/** Label + control + error text, wired together for screen readers. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && (
        <span className="field-error" id={`${id}-err`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function Tag({
  tone,
  children,
}: {
  tone?: "primary" | "warn" | "alert" | "good" | "info";
  children: ReactNode;
}) {
  return <span className={`tag ${tone ?? ""}`}>{children}</span>;
}

export function AlertBanner({
  text,
  meta,
  resolved,
  children,
}: {
  text: string;
  meta?: string;
  resolved?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className="alert-banner"
      role="note"
      style={resolved ? { opacity: 0.6 } : undefined}
    >
      <Icon name="alert" />
      <div className="grow">
        <div>{text}</div>
        {meta && <div className="meta">{meta}</div>}
        {children && (
          <div className="row wrap" style={{ marginTop: 8 }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

/** Keep keyboard focus inside the existing dialog and restore it on close. */
function useDialogKeyboard(busy: boolean | undefined, onCancel: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef({ busy, onCancel });
  useEffect(() => { latest.current = { busy, onCancel }; }, [busy, onCancel]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement;
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
    ));
    (controls()[0] ?? dialog).focus();
    function keydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!latest.current.busy) latest.current.onCancel();
      } else if (e.key === "Tab") {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) { e.preventDefault(); dialog?.focus(); return; }
        if (!dialog?.contains(document.activeElement) || (e.shiftKey && document.activeElement === first) || (!e.shiftKey && document.activeElement === last)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return ref;
}

export function ConfirmDialog(props: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useDialogKeyboard(props.busy, props.onCancel);
  const id = useId();
  return (
    <div className="dialog-backdrop" onClick={() => { if (!props.busy) props.onCancel(); }}>
      <div
        className="dialog"
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-title`}>{props.title}</h2>
        <p id={`${id}-message`} className="muted">
          {props.message}
        </p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={props.onCancel}
            disabled={props.busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${props.danger ? "btn-danger" : "btn-primary"}`}
            onClick={props.onConfirm}
            disabled={props.busy}
          >
            {props.busy ? "Working…" : props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? "active" : ""}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A dialog with a text box for a reason. */
export function PromptDialog(props: {
  title: string;
  message: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const missing = props.required && !value.trim();
  const dialogRef = useDialogKeyboard(props.busy, props.onCancel);
  const id = useId();
  return (
    <div className="dialog-backdrop" onClick={() => { if (!props.busy) props.onCancel(); }}>
      <div
        className="dialog"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-title`}>{props.title}</h2>
        <p id={`${id}-message`} className="muted">
          {props.message}
        </p>
        <Field id={`${id}-input`} label={props.label}>
          <textarea
            id={`${id}-input`}
            className="input"
            placeholder={props.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        {props.error && (
          <div className="error-box" role="alert">
            {props.error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={props.onCancel}
            disabled={props.busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${props.danger ? "btn-danger" : "btn-primary"}`}
            onClick={() => props.onConfirm(value)}
            disabled={props.busy || missing}
          >
            {props.busy ? "Working…" : props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
