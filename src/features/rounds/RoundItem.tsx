import { Link } from 'react-router-dom'
import { Tag } from '../../components/ui'
import { formatBp } from '../../lib/bp'
import { fmtDate, hhmm } from '../../lib/dates'
import type { Round } from '../../lib/models'
import { painLevel, painWord } from '../../lib/pain'
import { previousVersions } from '../../lib/rounds'

function Score({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null
  const lv = painLevel(value)
  return (
    <span className={`tag ${lv === 'low' ? 'good' : lv === 'mid' ? 'warn' : 'alert'}`}>
      {label} {value}{lv === 'high' ? ` ▲ ${painWord(value)}` : ''}
    </span>
  )
}

export function RoundItem({ round: r, all, nameOf, canAmend }: { round: Round; all: Round[]; nameOf: (id: string) => string; canAmend: boolean }) {
  const old = previousVersions(r, all)
  const vitals = [
    r.rr != null ? `RR ${r.rr}` : null,
    r.spo2 != null ? `SpO2 ${r.spo2}%` : null,
    r.hr != null ? `HR ${r.hr}` : null,
    r.bp_sys != null ? `BP ${formatBp(r.bp_sys, r.bp_dia)}` : null,
    r.gcs != null ? `GCS ${r.gcs}` : null,
  ].filter(Boolean)

  return (
    <div className="round-item" data-testid="round-item">
      <div className="row between wrap">
        <strong>
          {fmtDate(r.round_date)}
          {r.round_time ? ` · ${hhmm(r.round_time)}` : ''}
          {r.session ? ` · ${r.session}` : ''}
        </strong>
        <div className="row">
          <Tag tone={r.kind === 'pain' ? 'primary' : undefined}>{r.kind === 'pain' ? 'Pain round' : 'Ward round'}</Tag>
          {r.amended_of && <Tag tone="warn">Corrected</Tag>}
        </div>
      </div>
      {r.kind === 'pain' && (
        <div className="round-scores">
          <Score label="Rest" value={r.pain_rest} />
          <Score label="Movement" value={r.pain_move} />
        </div>
      )}
      {vitals.length > 0 && <p className="mono muted" style={{ fontSize: 13 }}>{vitals.join(' · ')}</p>}
      {r.mobilization && <p className="muted" style={{ fontSize: 13 }}>{r.mobilization}</p>}
      {r.tags.length > 0 && (
        <div className="row wrap" style={{ marginTop: 6 }}>
          {r.tags.map((t) => <Tag key={t} tone={t === 'Urgent review' ? 'alert' : 'info'}>{t}</Tag>)}
        </div>
      )}
      {r.note && <p style={{ marginTop: 6 }}>{r.note}</p>}
      <div className="row between wrap" style={{ marginTop: 6 }}>
        <span className="faint">Recorded by {nameOf(r.created_by)}</span>
        {canAmend && (
          <Link className="btn btn-ghost btn-sm" to={`/patients/${r.patient_id}/round?amend=${r.id}`}>Correct this round</Link>
        )}
      </div>
      {old.length > 0 && (
        <details className="history">
          <summary>Earlier version{old.length > 1 ? 's' : ''} ({old.length})</summary>
          {old.map((o) => (
            <p key={o.id} className="mono" style={{ marginTop: 4 }}>
              {fmtDate(o.round_date)} {hhmm(o.round_time)} · {o.kind === 'pain' ? `Rest ${o.pain_rest} / Move ${o.pain_move}` : 'ward round'}{o.note ? ` · ${o.note}` : ''} · {nameOf(o.created_by)}
            </p>
          ))}
        </details>
      )}
    </div>
  )
}
