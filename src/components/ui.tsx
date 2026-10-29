import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div className="spinner" role="status" aria-label={label} />
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <div className="error-box stack-s" role="alert">
      <strong>Could not load this.</strong>
      <span>{msg}</span>
      {onRetry && (
        <button className="btn btn-outline btn-sm" onClick={onRetry} style={{ alignSelf: 'flex-start' }}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p style={{ fontWeight: 600, color: 'var(--ink)' }}>{title}</p>
      {children && <p style={{ marginTop: 4 }}>{children}</p>}
    </div>
  )
}

/** Label + control + error text, wired together for screen readers. */
export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="field-error" id={`${id}-err`} role="alert">{error}</span>}
    </div>
  )
}

export function Tag({ tone, children }: { tone?: 'primary' | 'warn' | 'alert' | 'good' | 'info'; children: ReactNode }) {
  return <span className={`tag ${tone ?? ''}`}>{children}</span>
}

export function AlertBanner({ text, meta }: { text: string; meta?: string }) {
  return (
    <div className="alert-banner" role="note">
      <Icon name="alert" />
      <div className="grow">
        <div>{text}</div>
        {meta && <div className="meta">{meta}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog(props: {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="dialog-backdrop" onClick={props.onCancel}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-m" onClick={(e) => e.stopPropagation()}>
        <h2 id="dlg-t">{props.title}</h2>
        <p id="dlg-m" className="muted">{props.message}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={props.onCancel} disabled={props.busy}>Cancel</button>
          <button className={`btn ${props.danger ? 'btn-danger' : 'btn-primary'}`} onClick={props.onConfirm} disabled={props.busy}>
            {props.busy ? 'Working…' : props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? 'active' : ''} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
