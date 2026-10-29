import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { PainScale } from '../../components/PainScale'
import { useToast } from '../../components/Toast'
import { Empty, ErrorBox, Field, Spinner } from '../../components/ui'
import { MOBILIZATION, ROUND_TAGS, SESSIONS } from '../../lib/constants'
import { formatBp, parseBp } from '../../lib/bp'
import { hhmm, nowHHMM, todayISO } from '../../lib/dates'
import type { PatientFull, Round } from '../../lib/models'
import { vitalWarnings } from '../../lib/vitals'
import { useAuth } from '../auth/AuthProvider'
import { usePatient } from '../patients/hooks'
import { saveRound } from './outbox'
import { buildRoundInsert, type RoundFormValues } from './schemas'

const defaultSession = () => (new Date().getHours() < 12 ? 'Morning' : 'Evening')

function initialValues(kind: 'pain' | 'ward', from?: Round): RoundFormValues {
  if (from) {
    const n = (v: number | null) => (v == null ? '' : String(v))
    return {
      kind: from.kind === 'ward' ? 'ward' : 'pain', round_date: from.round_date, round_time: hhmm(from.round_time), session: from.session ?? '',
      pain_rest: from.pain_rest, pain_move: from.pain_move, rr: n(from.rr), spo2: n(from.spo2), hr: n(from.hr),
      bp: formatBp(from.bp_sys, from.bp_dia), gcs: n(from.gcs), mobilization: from.mobilization ?? '',
      tags: from.tags, note: from.note ?? '',
    }
  }
  return {
    kind, round_date: todayISO(), round_time: nowHHMM(), session: defaultSession(), pain_rest: null, pain_move: null,
    rr: '', spo2: '', hr: '', bp: '', gcs: '', mobilization: '', tags: [], note: '',
  }
}

function RoundForm({ patient, amend, kind }: { patient: PatientFull; amend?: Round; kind: 'pain' | 'ward' }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [f, setF] = useState<RoundFormValues>(() => initialValues(kind, amend))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const roundId = useRef(crypto.randomUUID()) // created once, so a retry can never duplicate this round
  const set = <K extends keyof RoundFormValues>(k: K, v: RoundFormValues[K]) => setF((cur) => ({ ...cur, [k]: v }))
  const pain = f.kind === 'pain'

  const warnings = useMemo(() => {
    if (!pain) return []
    const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : null)
    const bp = parseBp(f.bp)
    return vitalWarnings({
      pain_rest: f.pain_rest, pain_move: f.pain_move, rr: int(f.rr), spo2: int(f.spo2), hr: int(f.hr),
      bp_sys: bp?.sys, bp_dia: bp?.dia, gcs: int(f.gcs),
    })
  }, [f, pain])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!session) return
    const built = buildRoundInsert(f, { id: roundId.current, patient_id: patient.id, created_by: session.user.id, amended_of: amend?.id ?? null })
    if (!built.ok) {
      setErrors(built.errors)
      setFormError('Please fix the highlighted fields and try again.')
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"], .field-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
      return
    }
    setErrors({})
    setBusy(true)
    try {
      const result = await saveRound(built.value, session.user.id)
      await qc.invalidateQueries()
      toast(result === 'queued' ? 'Saved on this device. NOT YET SENT: it will send when you are online.' : amend ? 'Correction saved' : 'Round saved', result === 'queued' ? 'error' : 'info')
      navigate(`/patients/${patient.id}`, { replace: true })
    } catch (ex) {
      setFormError(ex instanceof Error ? ex.message : 'Could not save the round.')
    } finally {
      setBusy(false)
    }
  }

  const err = (k: string) => errors[k]
  const bad = (k: string) => (errors[k] ? true : undefined)

  return (
    <form onSubmit={submit} noValidate className="stack">
      <div className="row between">
        <Link to={`/patients/${patient.id}`} className="btn btn-ghost btn-sm"><Icon name="back" />Cancel</Link>
        <div className="right">
          <h1 style={{ fontSize: 20 }}>{amend ? 'Correct round' : pain ? 'Pain round' : 'Ward round'}</h1>
          <span className="faint">{patient.full_name} · {patient.ward}</span>
        </div>
      </div>
      {amend && (
        <p className="warn-list">
          This saves a <strong>new version</strong>. The original stays in the record and is shown as "earlier version".
        </p>
      )}

      <div className="card stack">
        <div className="row2">
          <Field id="round_date" label="Date" error={err('round_date')}>
            <input id="round_date" className="input" type="date" aria-invalid={bad('round_date')} value={f.round_date} onChange={(e) => set('round_date', e.target.value)} />
          </Field>
          <Field id="round_time" label="Time" error={err('round_time')}>
            <input id="round_time" className="input" type="time" aria-invalid={bad('round_time')} value={f.round_time} onChange={(e) => set('round_time', e.target.value)} />
          </Field>
        </div>
        <div className="stack-s" role="group" aria-label="Session">
          <span className="label">Session</span>
          <div className="segmented">
            {SESSIONS.map((s) => (
              <button key={s} type="button" className={f.session === s ? 'active' : ''} aria-pressed={f.session === s} onClick={() => set('session', f.session === s ? '' : s)}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {pain && (
        <>
          <div className="card stack">
            <PainScale id="rest" label="Rest pain" value={f.pain_rest} onChange={(n) => set('pain_rest', n)} error={err('pain_rest')} />
            <PainScale id="move" label="Movement pain" value={f.pain_move} onChange={(n) => set('pain_move', n)} error={err('pain_move')} />
          </div>

          <div className="card stack">
            <h2>Vitals (optional)</h2>
            <div className="row3">
              <Field id="rr" label="RR" error={err('rr')}><input id="rr" className="input" inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-invalid={bad('rr')} value={f.rr} onChange={(e) => set('rr', e.target.value)} /></Field>
              <Field id="spo2" label="SpO2 %" error={err('spo2')}><input id="spo2" className="input" inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-invalid={bad('spo2')} value={f.spo2} onChange={(e) => set('spo2', e.target.value)} /></Field>
              <Field id="hr" label="HR" error={err('hr')}><input id="hr" className="input" inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-invalid={bad('hr')} value={f.hr} onChange={(e) => set('hr', e.target.value)} /></Field>
            </div>
            <div className="row2">
              <Field id="bp" label="BP (120/80)" error={err('bp')}><input id="bp" className="input" inputMode="text" autoComplete="off" placeholder="120/80" aria-invalid={bad('bp')} value={f.bp} onChange={(e) => set('bp', e.target.value)} /></Field>
              <Field id="gcs" label="GCS (3-15)" error={err('gcs')}><input id="gcs" className="input" inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-invalid={bad('gcs')} value={f.gcs} onChange={(e) => set('gcs', e.target.value)} /></Field>
            </div>
            <div className="stack-s" role="group" aria-label="Mobilization">
              <span className="label">Mobilization</span>
              <div className="segmented">
                {MOBILIZATION.map((m) => (
                  <button key={m} type="button" className={f.mobilization === m ? 'active' : ''} aria-pressed={f.mobilization === m} onClick={() => set('mobilization', f.mobilization === m ? '' : m)}>{m}</button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card stack">
        <div className="stack-s" role="group" aria-label="Tags">
          <span className="label">Tags</span>
          <div className="chips">
            {ROUND_TAGS.map((t) => {
              const on = f.tags.includes(t)
              return (
                <button key={t} type="button" className={`chip ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => set('tags', on ? f.tags.filter((x) => x !== t) : [...f.tags, t])}>{t}</button>
              )
            })}
          </div>
        </div>
        <Field id="note" label={pain ? 'Note (optional)' : 'Note'} error={err('note')}>
          <textarea id="note" className="input" aria-invalid={bad('note')} value={f.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </div>

      {warnings.length > 0 && (
        <div className="warn-list" role="status">
          <strong>Please double-check (you can still save):</strong>
          <ul style={{ margin: '6px 0 0', padding: 0 }}>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      {formError && <div className="error-box" role="alert">{formError}</div>}

      <div className="sticky-actions">
        <button className="btn btn-primary grow" type="submit" disabled={busy}>{busy ? 'Saving…' : amend ? 'Save correction' : 'Save round'}</button>
      </div>
    </form>
  )
}

export function RoundFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const q = usePatient(id)
  const amendId = params.get('amend')
  const kind = params.get('kind') === 'ward' ? 'ward' : 'pain'

  if (q.isLoading) return <Spinner />
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
  if (!q.data) return <Empty title="Patient not found" />
  const amend = amendId ? q.data.rounds.find((r) => r.id === amendId) : undefined
  if (amendId && !amend) return <Empty title="That round was not found" />
  return <RoundForm key={amend?.id ?? kind} patient={q.data} amend={amend} kind={amend ? (amend.kind === 'ward' ? 'ward' : 'pain') : kind} />
}
