import { painLevel, painWord } from '../lib/pain'

/** 0-10 buttons. Selected score shows its colour AND a word ("Severe"), never colour alone. */
export function PainScale({ id, label, value, onChange, error }: { id: string; label: string; value: number | null; onChange: (n: number) => void; error?: string }) {
  return (
    <div className="stack-s" role="group" aria-labelledby={`${id}-l`}>
      <span className="label" id={`${id}-l`}>{label}</span>
      <div className="pain-scale">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            className={`pain-btn lv-${painLevel(n)}`}
            aria-pressed={value === n}
            aria-label={`${label} ${n} out of 10`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className={`pain-readout ${value != null ? `lv-${painLevel(value)}` : ''}`} aria-live="polite">
        {value != null ? `${value} - ${painWord(value)}${value >= 7 ? ' ▲' : ''}` : ''}
      </div>
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  )
}
