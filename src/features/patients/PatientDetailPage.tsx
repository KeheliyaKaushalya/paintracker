import { useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { AlertBanner, ConfirmDialog, Empty, ErrorBox, Spinner, Tag } from '../../components/ui'
import { computePOD, fmtDate, fmtDateLong, hhmm } from '../../lib/dates'
import { effectiveRounds, newestFirst } from '../../lib/rounds'
import { useAuth } from '../auth/AuthProvider'
import { RoundItem } from '../rounds/RoundItem'
import { addAlert, dischargePatient, readmitPatient } from './api'
import { useNameLookup, usePatient } from './hooks'

const PainChart = lazy(() => import('../rounds/PainChart'))

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || <span className="faint">—</span>}</dd>
    </div>
  )
}

export function PatientDetailPage() {
  const { id } = useParams()
  const q = usePatient(id)
  const nameOf = useNameLookup()
  const { session } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<'discharge' | 'readmit' | null>(null)
  const [busy, setBusy] = useState(false)
  const [alertText, setAlertText] = useState('')
  const [addingAlert, setAddingAlert] = useState(false)

  const p = q.data
  const rounds = useMemo(() => (p ? effectiveRounds(p.rounds).sort(newestFirst) : []), [p])
  const painRounds = useMemo(() => rounds.filter((r) => r.kind === 'pain'), [rounds])

  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
  if (!p) return <Empty title="Patient not found">They may have been removed or you may not have access. <Link to="/">Back to the board</Link></Empty>

  const active = p.status === 'active'
  const pod = computePOD(p.surgery_date)
  const alerts = [...p.patient_alerts].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const meds = [...p.patient_meds].sort((a, b) => a.sort_order - b.sort_order)

  async function changeStatus() {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm === 'discharge') await dischargePatient(p!.id)
      else await readmitPatient(p!.id)
      await qc.invalidateQueries()
      toast(confirm === 'discharge' ? 'Patient discharged' : 'Patient is back on the board')
      setConfirm(null)
      if (confirm === 'discharge') navigate('/')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update the patient', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function submitAlert() {
    if (!alertText.trim() || !session) return
    setAddingAlert(true)
    try {
      await addAlert(p!.id, alertText, session.user.id)
      setAlertText('')
      await qc.invalidateQueries()
      toast('Alert added')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add the alert', 'error')
    } finally {
      setAddingAlert(false)
    }
  }

  return (
    <div className="stack">
      <div className="row between">
        <Link to={active ? '/' : '/discharged'} className="btn btn-ghost btn-sm" aria-label="Back"><Icon name="back" />Back</Link>
        <div className="row">
          <Link to={`/patients/${p.id}/edit`} className="iconbtn" aria-label="Edit patient"><Icon name="edit" /></Link>
          <button className="iconbtn" onClick={() => setConfirm(active ? 'discharge' : 'readmit')} aria-label={active ? 'Discharge patient' : 'Return to board'}>
            <Icon name="check" />
          </button>
        </div>
      </div>

      <div>
        <h1>{p.full_name}</h1>
        <p className="muted">
          {[p.age != null ? `${p.age} yrs` : null, p.sex].filter(Boolean).join(' · ')}
          {(p.age != null || p.sex) && ' · '}<span className="mono">{p.bht}</span>
        </p>
        <div className="row wrap" style={{ marginTop: 8 }}>
          <Tag tone="primary">{p.ward}</Tag>
          {p.category !== 'Surgery' && <Tag tone="info">{p.category}</Tag>}
          {p.anaesthesia_mode && <Tag>{p.anaesthesia_mode}</Tag>}
          {pod != null && <Tag>POD {pod}</Tag>}
          {p.has_epidural && <Tag tone="primary">Epidural {p.ep_level}</Tag>}
          {p.has_nerve_catheter && <Tag tone="primary">{p.nv_type} catheter</Tag>}
          {p.has_pca && <Tag tone="primary">PCA {p.pca_drug}</Tag>}
          {!active && <Tag tone="warn">Discharged {fmtDate(p.discharged_date)}</Tag>}
        </div>
        {p.category_note && <p className="muted" style={{ marginTop: 6 }}>{p.category_note}</p>}
      </div>

      {active && (
        <div className="row">
          <Link to={`/patients/${p.id}/round?kind=pain`} className="btn btn-primary grow">Pain round</Link>
          <Link to={`/patients/${p.id}/round?kind=ward`} className="btn btn-outline grow">Ward round</Link>
        </div>
      )}

      <section aria-labelledby="alerts-h">
        <h2 className="section-title" id="alerts-h">Special notes and alerts</h2>
        <div className="stack-s">
          {alerts.length === 0 && <p className="faint">No alerts.</p>}
          {alerts.map((a) => (
            <AlertBanner key={a.id} text={a.alert_text} meta={`${nameOf(a.created_by)} · ${fmtDateLong(a.created_at.slice(0, 10))}`} />
          ))}
          {active && (
            <div className="stack-s" style={{ marginTop: 6 }}>
              <label className="label" htmlFor="new-alert">Add an alert</label>
              <textarea id="new-alert" className="input" value={alertText} onChange={(e) => setAlertText(e.target.value)} placeholder="e.g. Do not remove catheter until reviewed" />
              <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => void submitAlert()} disabled={!alertText.trim() || addingAlert}>
                {addingAlert ? 'Adding…' : 'Add alert'}
              </button>
              <span className="hint">Alerts cannot be edited or deleted, so add a new one if things change.</span>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="sum-h">
        <h2 className="section-title" id="sum-h">Clinical summary</h2>
        <div className="card">
          <dl className="info-grid" style={{ margin: 0 }}>
            <Info label="Surgery">{p.surgery}</Info>
            <Info label="Surgery date">{p.surgery_date ? `${fmtDateLong(p.surgery_date)}${p.surgery_time ? ` ${hhmm(p.surgery_time)}` : ''}` : ''}</Info>
            <Info label="Indication">{p.indication}</Info>
            <Info label="Post-op day">{pod != null ? `POD ${pod}` : ''}</Info>
            {p.has_epidural && <Info label="Epidural level">{p.ep_level}</Info>}
            {p.has_epidural && <Info label="Epidural inserted">{p.ep_inserted_date ? `${fmtDate(p.ep_inserted_date)} ${hhmm(p.ep_inserted_time)}` : ''}</Info>}
            {p.has_epidural && <Info label="Test / top-up dose">{p.ep_test_dose}</Info>}
            {p.has_nerve_catheter && <Info label="Nerve catheter">{p.nv_type}</Info>}
            {p.has_nerve_catheter && <Info label="Catheter inserted">{p.nv_inserted_date ? `${fmtDate(p.nv_inserted_date)} ${hhmm(p.nv_inserted_time)}` : ''}</Info>}
            {p.has_pca && <Info label="PCA drug">{p.pca_drug}</Info>}
            {p.has_pca && <Info label="PCA bolus / lockout / max per hr">{[p.pca_bolus, p.pca_lockout, p.pca_max_hr].filter(Boolean).join(' / ')}</Info>}
          </dl>
        </div>
      </section>

      {meds.length > 0 && (
        <section aria-labelledby="med-h">
          <h2 className="section-title" id="med-h">Medications</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Drug</th><th>Route</th><th>Dose</th><th>Frequency</th><th>Top-up</th></tr></thead>
              <tbody>
                {meds.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.drug}</strong>{m.dosing === 'loading' && <div className="faint">loading dose</div>}</td>
                    <td>{m.route}</td><td>{m.dose ?? '—'}</td>
                    <td>{m.freq === 'Other' ? m.freq_custom || 'Other' : m.freq ?? '—'}</td>
                    <td>{m.topup ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {painRounds.length > 0 && (
        <section aria-labelledby="chart-h">
          <h2 className="section-title" id="chart-h">Pain trend</h2>
          <div className="card">
            <Suspense fallback={<Spinner label="Loading chart" />}><PainChart rounds={painRounds} /></Suspense>
          </div>
        </section>
      )}

      <section aria-labelledby="rounds-h">
        <h2 className="section-title" id="rounds-h">Rounds ({rounds.length})</h2>
        <div className="card">
          {rounds.length === 0 && <p className="faint">No rounds yet.</p>}
          {rounds.map((r) => <RoundItem key={r.id} round={r} all={p.rounds} nameOf={nameOf} canAmend={active} />)}
        </div>
      </section>

      {confirm && (
        <ConfirmDialog
          title={confirm === 'discharge' ? 'Discharge this patient?' : 'Return this patient to the board?'}
          message={confirm === 'discharge'
            ? `${p.full_name} will move to the Discharged list. You can bring them back later.`
            : `${p.full_name} will appear on the ward board again.`}
          confirmLabel={confirm === 'discharge' ? 'Discharge' : 'Return to board'}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void changeStatus()}
        />
      )}
    </div>
  )
}
