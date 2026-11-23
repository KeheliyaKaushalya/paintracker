import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '../../components/Toast'
import { Tag } from '../../components/ui'
import { hhmm } from '../../lib/dates'
import { createShiftTemplate, setShiftTemplateActive } from '../shifts/api'
import { useShiftTemplates } from '../shifts/hooks'

export function ShiftTemplatesAdmin() {
  const q = useShiftTemplates(true)
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('20:00')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true)
    try {
      await fn()
      await qc.invalidateQueries({ queryKey: ['shifts'] })
      toast(ok)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2 className="section-title">Shift times</h2>
      <div className="card">
        {(q.data ?? []).map((t) => (
          <div className="user-row" key={t.id}>
            <div><strong>{t.name}</strong> <span className="faint mono">{hhmm(t.start_time)}–{hhmm(t.end_time)}</span> {!t.active && <Tag tone="warn">Hidden</Tag>}</div>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void run(() => setShiftTemplateActive(t.id, !t.active), 'Saved')}>
              {t.active ? 'Hide' : 'Show again'}
            </button>
          </div>
        ))}
        <div className="row2" style={{ marginTop: 10 }}>
          <input className="input" aria-label="Shift name" placeholder="Shift name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="row">
            <input className="input" type="time" aria-label="Start time" value={start} onChange={(e) => setStart(e.target.value)} />
            <input className="input" type="time" aria-label="End time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={busy || !name.trim() || !start || !end}
          onClick={() => void run(async () => { await createShiftTemplate({ name: name.trim(), start_time: start, end_time: end }); setName('') }, 'Shift added')}>
          Add shift
        </button>
        <p className="hint" style={{ marginTop: 8 }}>If the end time is not after the start time, the shift runs overnight into the next day.</p>
      </div>
    </section>
  )
}