import { Link } from 'react-router-dom'
import { AlertBanner, Tag } from '../../components/ui'
import { computePOD, fmtDate, fmtDateLong } from '../../lib/dates'
import type { PatientFull } from '../../lib/models'
import { painLevel, painWord } from '../../lib/pain'
import { latestPainRound, latestRound } from '../../lib/rounds'
import { isUrgent } from './filters'

function Tile({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) {
    return <div className="tile"><div className="num faint">–</div><div className="lab">{label}</div></div>
  }
  const lv = painLevel(value)
  return (
    <div className={`tile lv-${lv}`}>
      <div className="num">{value}</div>
      <div className="lab">{label}</div>
      {lv === 'high' && <div className="sev">▲ {painWord(value)}</div>}
    </div>
  )
}

export function PatientCard({ patient: p, nameOf }: { patient: PatientFull; nameOf: (id: string) => string }) {
  const pain = latestPainRound(p.rounds)
  const last = latestRound(p.rounds)
  const alert = [...p.patient_alerts].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]
  const pod = computePOD(p.surgery_date)
  const meds = [...p.patient_meds].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <Link to={`/patients/${p.id}`} className="card pcard" aria-label={`${p.full_name}, ${p.ward}`}>
      <div className="pcard-top">
        <div className="grow">
          <div className="pname">{p.full_name}</div>
          <div className="pmeta">
            {[p.age != null ? `${p.age} yrs` : null, p.sex].filter(Boolean).join(' · ')}
            {(p.age != null || p.sex) && ' · '}
            <span className="mono">{p.bht}</span>
          </div>
          <div className="pmeta">
            {[p.surgery, p.anaesthesia_mode, pod != null ? `POD ${pod}` : null].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="stack-s" style={{ alignItems: 'flex-end' }}>
          <Tag tone="primary">{p.ward}</Tag>
          {isUrgent(p) && <Tag tone="alert">Urgent review</Tag>}
        </div>
      </div>

      {p.category !== 'Surgery' && (
        <div className="row wrap" style={{ marginTop: 8 }}>
          <Tag tone="info">{p.category}</Tag>
          {p.category_note && <span className="faint">{p.category_note}</span>}
        </div>
      )}

      {pain ? (
        <div className="scores">
          <Tile label="Rest" value={pain.pain_rest} />
          <Tile label="Movement" value={pain.pain_move} />
        </div>
      ) : (
        <p className="faint" style={{ margin: '10px 0' }}>No pain round recorded yet.</p>
      )}

      {meds.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Drug</th><th>Route</th><th>Dose</th><th>Frequency</th></tr></thead>
            <tbody>
              {meds.slice(0, 3).map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.drug}</strong></td><td>{m.route}</td><td>{m.dose ?? '—'}</td>
                  <td>{m.freq === 'Other' ? m.freq_custom || 'Other' : m.freq ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {meds.length > 3 && <p className="faint">+{meds.length - 3} more</p>}

      {alert && (
        <div style={{ marginTop: 10 }}>
          <AlertBanner text={alert.alert_text} meta={`${nameOf(alert.created_by)} · ${fmtDateLong(alert.created_at.slice(0, 10))}`} />
        </div>
      )}

      <div className="pcard-foot">
        <span>{last ? `Last round: ${fmtDate(last.round_date)}${last.session ? ` · ${last.session}` : ''}` : 'No rounds yet'}</span>
        {last && <span>{nameOf(last.created_by)}</span>}
      </div>
    </Link>
  )
}
