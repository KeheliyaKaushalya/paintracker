import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '../../components/Toast'
import { Field, PromptDialog } from '../../components/ui'
import { MED_FREQS } from '../../lib/constants'
import { fmtStamp } from '../../lib/dates'
import { isActiveMed, medFreqLabel } from '../../lib/meds'
import type { MedChange, PatientMed } from '../../lib/models'
import { changeMedDose, endMed } from './api'
import { useMedChanges } from './hooks'

type Dialog = { kind: 'dose'; med: PatientMed } | { kind: 'stopped' | 'removed'; med: PatientMed } | null

function ChangeDoseDialog({ med, onClose, onDone }: { med: PatientMed; onClose: () => void; onDone: () => void }) {
  const [dose, setDose] = useState(med.dose ?? '')
  const [freq, setFreq] = useState(med.freq ?? '')
  const [custom, setCustom] = useState(med.freq_custom ?? '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    if (freq === 'Other' && !custom.trim()) { setError('Enter the custom frequency'); return }
    if (dose.trim() === (med.dose ?? '') && freq === (med.freq ?? '') && (freq !== 'Other' || custom.trim() === (med.freq_custom ?? ''))) {
      setError('Nothing has changed')
      return
    }
    setBusy(true)
    try {
      await changeMedDose(med.id, dose, freq, custom, reason)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the change')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="cd-t" onClick={(e) => e.stopPropagation()}>
        <h2 id="cd-t">Change dose: {med.drug}</h2>
        <p className="muted">Currently {[med.route, med.dose, medFreqLabel(med)].filter(Boolean).join(' · ')}. The old dose stays in the history.</p>
        <Field id="cd-dose" label="New dose">
          <input id="cd-dose" className="input" autoComplete="off" value={dose} onChange={(e) => setDose(e.target.value)} />
        </Field>
        <Field id="cd-freq" label="Frequency">
          <select id="cd-freq" className="input" value={freq} onChange={(e) => setFreq(e.target.value)}>
            <option value="">—</option>
            {MED_FREQS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>
        {freq === 'Other' && (
          <Field id="cd-custom" label="Frequency (describe)">
            <input id="cd-custom" className="input" value={custom} onChange={(e) => setCustom(e.target.value)} />
          </Field>
        )}
        <Field id="cd-reason" label="Reason (optional)">
          <input id="cd-reason" className="input" autoComplete="off" placeholder="e.g. Pain not controlled" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error && <div className="error-box" role="alert">{error}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save change'}</button>
        </div>
      </div>
    </div>
  )
}

function DoseHistory({ changes, nameOf }: { changes: MedChange[]; nameOf: (id: string) => string }) {
  if (changes.length === 0) return null
  return (
    <details className="history">
      <summary>Dose history ({changes.length})</summary>
      {changes.map((c) => (
        <p key={c.id} className="mono" style={{ marginTop: 4 }}>
          {fmtStamp(c.changed_at)} · {[c.from_dose, c.from_freq].filter(Boolean).join(' ') || '—'} → {[c.to_dose, c.to_freq].filter(Boolean).join(' ') || '—'} · {nameOf(c.changed_by)}{c.reason ? ` · ${c.reason}` : ''}
        </p>
      ))}
    </details>
  )
}

export function MedSection({ patientId, meds, editable, nameOf }: {
  patientId: string
  meds: PatientMed[]
  editable: boolean
  nameOf: (id: string) => string
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const changesQ = useMedChanges(patientId)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)
  const [endError, setEndError] = useState<string | null>(null)

  if (meds.length === 0) return null
  const sorted = [...meds].sort((a, b) => a.sort_order - b.sort_order)
  const current = sorted.filter(isActiveMed)
  const ended = sorted.filter((m) => !isActiveMed(m))
  const changesFor = (id: string) => (changesQ.data ?? []).filter((c) => c.med_id === id)

  async function end(status: 'stopped' | 'removed', med: PatientMed, reason: string) {
    setBusy(true)
    setEndError(null)
    try {
      await endMed(med.id, status, reason)
      await qc.invalidateQueries()
      toast(status === 'stopped' ? 'Medication stopped' : 'Medication entry removed')
      setDialog(null)
    } catch (e) {
      setEndError(e instanceof Error ? e.message : 'Could not update the medication')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="med-h">
      <h2 className="section-title" id="med-h">Medications</h2>
      {current.length === 0 && <p className="faint">No active medications.</p>}
      {current.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Drug</th><th>Route</th><th>Dose</th><th>Frequency</th><th>Top-up</th>{editable && <th>Actions</th>}</tr></thead>
            <tbody>
              {current.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.drug}</strong>
                    {m.dosing === 'loading' && <div className="faint">loading dose</div>}
                    {m.started_at && <div className="faint">Added by {m.started_by ? nameOf(m.started_by) : 'unknown'} · {fmtStamp(m.started_at)}</div>}
                    <DoseHistory changes={changesFor(m.id)} nameOf={nameOf} />
                  </td>
                  <td>{m.route}</td>
                  <td><strong>{m.dose ?? '—'}</strong></td>
                  <td>{medFreqLabel(m)}</td>
                  <td>{m.topup ?? '—'}</td>
                  {editable && (
                    <td>
                      <div className="stack-s">
                        <button className="btn btn-outline btn-sm" onClick={() => setDialog({ kind: 'dose', med: m })}>Change dose</button>
                        <button className="btn btn-outline btn-sm" onClick={() => { setEndError(null); setDialog({ kind: 'stopped', med: m }) }}>Stop</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEndError(null); setDialog({ kind: 'removed', med: m }) }}>Entered in error</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ended.length > 0 && (
        <details className="history" style={{ marginTop: 8 }}>
          <summary>Stopped / removed medications ({ended.length})</summary>
          {ended.map((m) => (
            <div key={m.id} style={{ marginTop: 8 }}>
              <p className="mono">
                <strong>{m.drug}</strong> {[m.route, m.dose, medFreqLabel(m)].filter(Boolean).join(' · ')} — {m.status === 'removed' ? 'entered in error' : 'stopped'} by {m.ended_by ? nameOf(m.ended_by) : 'unknown'}, {fmtStamp(m.ended_at)}{m.end_reason ? ` — ${m.end_reason}` : ''}
              </p>
              <DoseHistory changes={changesFor(m.id)} nameOf={nameOf} />
            </div>
          ))}
        </details>
      )}

      {dialog?.kind === 'dose' && (
        <ChangeDoseDialog
          med={dialog.med}
          onClose={() => setDialog(null)}
          onDone={() => { void qc.invalidateQueries(); toast('Dose change saved'); setDialog(null) }}
        />
      )}
      {dialog && dialog.kind !== 'dose' && (
        <PromptDialog
          title={dialog.kind === 'stopped' ? `Stop ${dialog.med.drug}?` : `Remove ${dialog.med.drug} as entered in error?`}
          message={dialog.kind === 'stopped'
            ? 'It moves to “Stopped / removed medications”. Its full history stays on record.'
            : 'Use this only for an entry that should never have been made. To end a medication that was given, use Stop instead.'}
          label={dialog.kind === 'stopped' ? 'Reason (optional)' : 'Reason'}
          required={dialog.kind === 'removed'}
          confirmLabel={dialog.kind === 'stopped' ? 'Stop medication' : 'Remove entry'}
          danger
          busy={busy}
          error={endError}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => void end(dialog.kind, dialog.med, reason)}
        />
      )}
    </section>
  )
}