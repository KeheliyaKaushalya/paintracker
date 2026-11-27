import { useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import { useToast } from '../../shared/components/Toast'
import { ConfirmDialog, Empty, ErrorBox, Spinner, Tag, PromptDialog } from '../../shared/components/ui'
import { computePOD, fmtDate, fmtDateLong, fmtStamp, hhmm } from '../../domain/clinical/dates'
import { effectiveRounds, newestFirst } from '../../domain/clinical/rounds'
import { useAuth } from '../auth/AuthProvider'
import { RoundItem } from '../rounds/RoundItem'
import { ackAlert, addAlert, dischargePatient, readmitPatient, resolveAlert, deletePatient, restorePatient, } from '../../infrastructure/repositories/patients'
import { useNameLookup, usePatient } from './hooks'
import { PatientTimeline } from './timeline/PatientTimeline'
import { MedSection } from './Medsection'
import { needsMyAck } from '../../domain/clinical/alerts'
import { pdphTechnique } from '../../domain/clinical/category'

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
  const { session, profile } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [view, setView] = useState<'overview' | 'timeline'>('overview')
  const [confirm, setConfirm] = useState<'discharge' | 'readmit' | null>(null)
  const [busy, setBusy] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const p = q.data
  const rounds = useMemo(() => (p ? effectiveRounds(p.rounds).sort(newestFirst) : []), [p])
  const painRounds = useMemo(() => rounds.filter((r) => r.kind === 'pain'), [rounds])

  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
  if (!p) return <Empty title="Patient not found">They may have been removed or you may not have access. <Link to="/patients">Back to the board</Link></Empty>

  const active = p.status === 'active'
  const pod = computePOD(p.surgery_date)
  const alerts = [...p.patient_alerts].sort(
    (a, b) => Number(!!a.resolved_at) - Number(!!b.resolved_at) || (a.created_at < b.created_at ? 1 : -1),
  )

  const openAlerts = alerts.filter((a) => !a.resolved_at)
  const resolvedAlerts = alerts.filter((a) => !!a.resolved_at)

  async function changeStatus() {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm === 'discharge') await dischargePatient(p!.id)
      else await readmitPatient(p!.id)
      await qc.invalidateQueries()
      toast(confirm === 'discharge' ? 'Patient discharged' : 'Patient is back on the board')
      setConfirm(null)
      if (confirm === 'discharge') navigate('/patients')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update the patient', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function submitNote(text: string) {
    if (!text.trim() || !session) return
    setBusy(true)
    setNoteError(null)
    try {
      await addAlert(p!.id, text, session.user.id)
      await qc.invalidateQueries()
      toast('Note added')
      setAddingNote(false)
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Could not add the note')
    } finally {
      setBusy(false)
    }
  }

    async function acknowledge(alertId: string) {
    try {
      await ackAlert(alertId)
      await qc.invalidateQueries()
      toast('Alert acknowledged')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not acknowledge the alert', 'error')
    }
  }

  async function confirmResolve() {
    if (!resolving || !session) return
    setBusy(true)
    try {
      await resolveAlert(resolving, session.user.id)
      await qc.invalidateQueries()
      toast('Alert resolved')
      setResolving(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not resolve the alert', 'error')
    } finally {
      setBusy(false)
    }
  }

    async function doDelete(reason: string) {
    setBusy(true)
    setDeleteError(null)
    try {
      await deletePatient(p!.id, reason)
      await qc.invalidateQueries()
      toast('Record deleted. An administrator can restore it.')
      navigate('/patients')
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete the record')
    } finally {
      setBusy(false)
    }
  }

  async function doRestore() {
    setBusy(true)
    try {
      await restorePatient(p!.id)
      await qc.invalidateQueries()
      toast('Record restored')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not restore the record', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <Link to={active ? '/patients' : '/discharged'} className="btn btn-ghost btn-sm" aria-label="Back"><Icon name="back" />Back</Link>
      </div>

      <div>
        <h1>{p.full_name}</h1>
        <p className="muted">
          {[p.age != null ? `${p.age} yrs` : null, p.sex].filter(Boolean).join(' · ')}
          {(p.age != null || p.sex) && ' · '}<span className="mono">{p.bht}</span>
        </p>
        {p.deleted_at && (
          <div className="error-box stack-s" role="status" style={{ marginTop: 8 }}>
            <strong>This record was deleted</strong>
            <span>{p.delete_reason} · {nameOf(p.deleted_by ?? '')} · {fmtStamp(p.deleted_at)}</span>
            {profile?.role === 'admin' && <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => void doRestore()}>Restore record</button>}
          </div>
        )}
        <div className="row wrap" style={{ marginTop: 8 }}>
          <Tag tone="primary">{p.ward}</Tag>
          {p.category !== 'Surgery' && <Tag tone="info">{p.category}</Tag>}
          {p.anaesthesia_mode && <Tag>{p.anaesthesia_mode}</Tag>}
          {pod != null && <Tag>POD {pod}</Tag>}
          {p.has_epidural && <Tag tone="primary">Epidural {p.ep_level}</Tag>}
          {p.has_nerve_catheter && <Tag tone="primary">{p.nv_type} Catheter</Tag>}
          {p.has_pca && <Tag tone="primary">PCA {p.pca_drug}</Tag>}
          {!active && <Tag tone="warn">Discharged {fmtDate(p.discharged_date)}</Tag>}
        </div>
        {p.category_note && <p className="muted" style={{ marginTop: 6 }}>{p.category_note}</p>}
      </div>

      {active && (
        <div className="row">
          <Link to={`/patients/${p.id}/round?kind=pain`} className="btn btn-primary grow">Pain Round</Link>
          <Link to={`/patients/${p.id}/round?kind=ward`} className="btn btn-outline grow">Ward Round</Link>
        </div>
      )}

      <div className="row" role="group" aria-label="Patient detail view">
        <button type="button" className={`btn grow ${view === 'overview' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={view === 'overview'} onClick={() => setView('overview')}>Overview</button>
        <button type="button" className={`btn grow ${view === 'timeline' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={view === 'timeline'} onClick={() => setView('timeline')}>Timeline</button>
      </div>
      {view === 'timeline' && <PatientTimeline key={p.id} patient={p} nameOf={nameOf} />}
      <div hidden={view !== 'overview'}>
      <div className="stack">
      <section aria-labelledby="alerts-h" className="notes-card">
        <div className="notes-head">
          <h2 id="alerts-h"><Icon name="alert" />Special Notes{openAlerts.length > 0 ? ` · ${openAlerts.length} open` : ''}</h2>
          {active && <button className="link-btn" onClick={() => { setNoteError(null); setAddingNote(true) }}>+ Add Note</button>}
        </div>
        {openAlerts.length === 0 && <p className="note-empty">No Open Special Notes.</p>}
        {openAlerts.map((a) => (
          <div className="note-item" key={a.id}>
            <div>{a.alert_text}</div>
            <div className="meta">{nameOf(a.created_by)} · {fmtStamp(a.created_at)}</div>
            {a.patient_alert_acks.length > 0 && (
              <div className="meta">Seen by {a.patient_alert_acks.map((k) => nameOf(k.user_id)).join(', ')}</div>
            )}
            {active && (
              <div className="note-actions">
                {session && needsMyAck(a, session.user.id) && (
                  <button className="btn btn-white btn-sm" onClick={() => void acknowledge(a.id)}>Acknowledge</button>
                )}
                <button className="btn btn-white btn-sm" onClick={() => setResolving(a.id)}>Mark Resolved</button>
              </div>
            )}
          </div>
        ))}
        {resolvedAlerts.length > 0 && (
          <>
            <button className="link-btn" onClick={() => setShowResolved((v) => !v)}>
              {showResolved ? 'Hide' : 'Show'} Resolved Notes ({resolvedAlerts.length})
            </button>
            {showResolved && resolvedAlerts.map((a) => (
              <div className="note-item resolved" key={a.id}>
                <div>{a.alert_text}</div>
                <div className="meta">
                  {nameOf(a.created_by)} · {fmtStamp(a.created_at)} · Resolved by {a.resolved_by ? nameOf(a.resolved_by) : 'unknown'}, {fmtStamp(a.resolved_at)}
                </div>
              </div>
            ))}
          </>
        )}
      </section>

      <section aria-labelledby="sum-h">
        <h2 className="section-title" id="sum-h">Clinical Summary</h2>
        <div className="card">
          <dl className="info-grid" style={{ margin: 0 }}>
            {p.category === 'PDPH' && (
              <>
                <Info label="PDPH technique"><strong>{pdphTechnique(p)}</strong></Info>
                <Info label="PDPH level"><strong>{p.pdph_level}</strong></Info>
                <Info label="Needle"><strong>{p.pdph_needle}</strong></Info>
                <Info label="Attempts"><strong>{p.pdph_attempts != null ? String(p.pdph_attempts) : ''}</strong></Info>
                <Info label="Symptoms"><strong>{p.pdph_symptoms}</strong></Info>
                <Info label="Presenting complaint"><strong>{p.pdph_complaint}</strong></Info>
                <Info label="Current condition"><strong>{p.pdph_condition}</strong></Info>
                <Info label="Management"><strong>{p.pdph_management}</strong></Info>
              </>
            )}
            
            <Info label="Surgery"><strong>{p.surgery}</strong></Info>
            <Info label="Surgery date"><strong>{p.surgery_date ? `${fmtDateLong(p.surgery_date)}${p.surgery_time ? ` ${hhmm(p.surgery_time)}` : ''}` : ''}</strong></Info>
            <Info label="Indication"><strong>{p.indication}</strong></Info>
            <Info label="Post-op day"><strong>{pod != null ? `POD ${pod}` : ''}</strong></Info>
            {p.has_epidural && <Info label="Epidural level"><strong>{p.ep_level}</strong></Info>}
            {p.has_epidural && <Info label="Epidural inserted"><strong>{p.ep_inserted_date ? `${fmtDate(p.ep_inserted_date)} ${hhmm(p.ep_inserted_time)}` : ''}</strong></Info>}
            {p.has_epidural && <Info label="Test / top-up dose"><strong>{p.ep_test_dose}</strong></Info>}
            {p.has_nerve_catheter && <Info label="Nerve catheter"><strong>{p.nv_type}</strong></Info>}
            {p.has_nerve_catheter && <Info label="Catheter inserted"><strong>{p.nv_inserted_date ? `${fmtDate(p.nv_inserted_date)} ${hhmm(p.nv_inserted_time)}` : ''}</strong></Info>}
            {p.has_pca && <Info label="PCA drug"><strong>{p.pca_drug}</strong></Info>}
            {p.has_pca && <Info label="PCA bolus / lockout / max per hr"><strong>{[p.pca_bolus, p.pca_lockout, p.pca_max_hr].filter(Boolean).join(' / ')}</strong></Info>}
          </dl>
        </div>
      </section>

      <MedSection patientId={p.id} meds={p.patient_meds} editable={active} nameOf={nameOf} />

      {painRounds.length > 0 && (
        <section aria-labelledby="chart-h">
          <h2 className="section-title" id="chart-h">Pain Trend</h2>
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

      <div className="detail-footer">
        <Link to={`/patients/${p.id}/edit`} className="btn btn-outline btn-block">Edit Patient</Link>
        <button className="btn btn-outline btn-block" onClick={() => setConfirm(active ? 'discharge' : 'readmit')}>
          {active ? 'Discharge Patient' : 'Return to board'}
        </button>
        {profile?.role === 'admin' && !p.deleted_at && (
          <button className="btn btn-quiet btn-block" onClick={() => { setDeleteError(null); setDeleting(true) }}>
            Delete Patient Record
          </button>
        )}
      </div>

      </div>
      </div>

      {addingNote && (
        <PromptDialog
          title="Add special note"
          message="Everyone on the team will see this. Notes cannot be edited or deleted. When one no longer applies, mark it resolved."
          label="Note"
          placeholder="e.g. Last dose top-up 0.25% bupivacaine 5 cc"
          required
          confirmLabel="Add Note"
          busy={busy}
          error={noteError}
          onCancel={() => setAddingNote(false)}
          onConfirm={(text) => void submitNote(text)}
        />
      )}

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
      {resolving && (
        <ConfirmDialog
          title="Resolve this alert?"
          message="It will be greyed out and will no longer need acknowledging. It stays on record."
          confirmLabel="Resolve"
          busy={busy}
          onCancel={() => setResolving(null)}
          onConfirm={() => void confirmResolve()}
        />
      )}
      {deleting && (
        <PromptDialog
          title="Delete this patient record?"
          message="It disappears from the board and lists but is kept in full. Only an administrator can restore it."
          label="Reason"
          required
          confirmLabel="Delete Record"
          danger
          busy={busy}
          error={deleteError}
          onCancel={() => setDeleting(false)}
          onConfirm={(reason) => void doDelete(reason)}
        />
      )}
    </div>
  )
}
