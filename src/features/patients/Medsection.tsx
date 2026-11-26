import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '../../components/Toast'
import { Field, PromptDialog } from '../../components/ui'
import { MED_FREQS } from '../../lib/constants'
import { fmtStamp } from '../../lib/dates'
import { isActiveMed, medFreqLabel } from '../../lib/meds'
import type { MedChange, PatientMed } from '../../lib/models'
import { addMed, changeMedDose, endMed, type NewMed } from './api'
import { useMedChanges } from './hooks'

type Dialog =
  | { kind: 'dose'; med: PatientMed }
  | { kind: 'history'; med: PatientMed }
  | { kind: 'stopped' | 'removed'; med: PatientMed }
  | null

const DRUGS = [
  'Paracetamol', 'Tramadol', 'Morphine', 'Diclofenac', 'Ibuprofen',
  'Gabapentin', 'Pregabalin', 'Amitriptyline', 'Ondansetron', 'Omeprazole',
]
const ROUTES = ['Oral', 'IV', 'IM', 'SC', 'PR', 'Topical', 'Epidural']

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

function HistoryDialog({ med, changes, nameOf, onClose }: {
  med: PatientMed
  changes: MedChange[]
  nameOf: (id: string) => string
  onClose: () => void
}) {
  const ordered = [...changes].sort((a, b) => a.changed_at.localeCompare(b.changed_at))
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="mh-t" onClick={(e) => e.stopPropagation()}>
        <h2 id="mh-t">History: {med.drug}</h2>

        {med.started_at && (
          <p className="mono">
            {fmtStamp(med.started_at)} · Added by {med.started_by ? nameOf(med.started_by) : 'unknown'}
          </p>
        )}

        {ordered.length === 0 && <p className="faint">No dose changes yet.</p>}
        {ordered.map((c) => (
          <p key={c.id} className="mono">
            {fmtStamp(c.changed_at)} · {[c.from_dose, c.from_freq].filter(Boolean).join(' ') || '—'} → {[c.to_dose, c.to_freq].filter(Boolean).join(' ') || '—'} · {nameOf(c.changed_by)}{c.reason ? ` · ${c.reason}` : ''}
          </p>
        ))}

        {!isActiveMed(med) && (
          <p className="mono">
            {fmtStamp(med.ended_at)} · {med.status === 'removed' ? 'Entered in error' : 'Stopped'} by {med.ended_by ? nameOf(med.ended_by) : 'unknown'}{med.end_reason ? ` · ${med.end_reason}` : ''}
          </p>
        )}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function AddMedForm({ onAdd }: { onAdd: (m: NewMed) => Promise<void> }) {
  const [drugSel, setDrugSel] = useState(DRUGS[0])
  const [drugOther, setDrugOther] = useState('')
  const [route, setRoute] = useState('Oral')
  const [dose, setDose] = useState('')
  const [freq, setFreq] = useState<string>(MED_FREQS[0])
  const [custom, setCustom] = useState('')
  const [topup, setTopup] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    const drug = drugSel === 'Other' ? drugOther.trim() : drugSel
    if (!drug) { setError('Enter the drug name'); return }
    if (!dose.trim()) { setError('Enter a dose (e.g. 1 g)'); return }
    if (freq === 'Other' && !custom.trim()) { setError('Enter the custom frequency'); return }
    setBusy(true)
    try {
      await onAdd({ drug, route, dose: dose.trim(), freq, freq_custom: custom.trim(), topup: topup.trim() })
      setDose(''); setCustom(''); setTopup(''); setDrugOther('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the medication')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="med-add">
      <h3 className="med-add-title">Add medication</h3>
      <div className="med-add-grid">
        <Field id="am-drug" label="Medication">
          <select id="am-drug" className="input" value={drugSel} onChange={(e) => setDrugSel(e.target.value)}>
            {DRUGS.map((d) => <option key={d} value={d}>{d}</option>)}
            <option value="Other">Other…</option>
          </select>
        </Field>
        <Field id="am-route" label="Route">
          <select id="am-route" className="input" value={route} onChange={(e) => setRoute(e.target.value)}>
            {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>

        {drugSel === 'Other' && (
          <div className="med-add-full">
            <Field id="am-drug-other" label="Drug name">
              <input id="am-drug-other" className="input" autoComplete="off" value={drugOther} onChange={(e) => setDrugOther(e.target.value)} />
            </Field>
          </div>
        )}

        <Field id="am-dose" label="Dose">
          <input id="am-dose" className="input" autoComplete="off" placeholder="e.g. 1 g" value={dose} onChange={(e) => setDose(e.target.value)} />
        </Field>
        <Field id="am-freq" label="Frequency">
          <select id="am-freq" className="input" value={freq} onChange={(e) => setFreq(e.target.value)}>
            {MED_FREQS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>

        {freq === 'Other' && (
          <div className="med-add-full">
            <Field id="am-custom" label="Frequency (describe)">
              <input id="am-custom" className="input" value={custom} onChange={(e) => setCustom(e.target.value)} />
            </Field>
          </div>
        )}

        <div className="med-add-full">
          <Field id="am-topup" label="Top-up (optional)">
            <input id="am-topup" className="input" autoComplete="off" placeholder="e.g. 500 mg PRN" value={topup} onChange={(e) => setTopup(e.target.value)} />
          </Field>
        </div>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      <button className="btn btn-primary med-add-btn" onClick={() => void submit()} disabled={busy}>
        {busy ? 'Adding…' : 'Add to chart'}
      </button>
    </div>
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

  // no early return: the add form must still show when a patient has no meds yet
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

  async function add(m: NewMed) {
    const nextOrder = meds.reduce((max, x) => Math.max(max, x.sort_order), 0) + 1
    await addMed(patientId, m, nextOrder)
    await qc.invalidateQueries()
    toast('Medication added')
  }

  return (
    <section aria-labelledby="med-h">
      <h2 className="section-title" id="med-h">Medications</h2>
      {current.length === 0 && <p className="faint">No active medications.</p>}

      {current.length > 0 && (
        <div className="table-wrap">
          <table className="med-table">
            <thead>
              <tr><th>Drug</th><th>Route</th><th>Dose</th><th>Frequency</th><th>Top-up</th></tr>
            </thead>
            {current.map((m) => (
              <tbody key={m.id}>
                <tr className="med-main">
                  <td>
                    <strong>{m.drug}</strong>
                    {m.dosing === 'loading' && <div className="faint">loading dose</div>}
                    {m.started_at && <div className="faint">Added by {m.started_by ? nameOf(m.started_by) : 'unknown'} · {fmtStamp(m.started_at)}</div>}
                  </td>
                  <td>{m.route}</td>
                  <td><strong>{m.dose ?? '—'}</strong></td>
                  <td>{medFreqLabel(m)}</td>
                  <td>{m.topup ?? '—'}</td>
                </tr>
                <tr className="med-actions-row">
                  <td colSpan={5}>
                    <div className="med-actions">
                      {editable && (
                        <button className="btn btn-outline btn-sm" onClick={() => setDialog({ kind: 'dose', med: m })}>Change dose</button>
                      )}
                      <button className="btn btn-outline btn-sm" onClick={() => setDialog({ kind: 'history', med: m })}>History</button>
                      {editable && (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={() => { setEndError(null); setDialog({ kind: 'stopped', med: m }) }}>Stop</button>
                          <button className="btn btn-outline btn-sm btn-error-outline" onClick={() => { setEndError(null); setDialog({ kind: 'removed', med: m }) }}>Entered in error</button>                        </>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            ))}
          </table>
        </div>
      )}

      {editable && <AddMedForm onAdd={add} />}

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

      {dialog?.kind === 'history' && (
        <HistoryDialog
          med={dialog.med}
          changes={changesFor(dialog.med.id)}
          nameOf={nameOf}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog && dialog.kind !== 'dose' && dialog.kind !== 'history' && (
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