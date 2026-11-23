import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '../../components/Toast'
import { Tag } from '../../components/ui'
import { addWard, setWardActive } from '../patients/api'
import { useWards } from '../patients/hooks'

export function WardsAdmin() {
  const q = useWards()
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true)
    try {
      await fn()
      await qc.invalidateQueries({ queryKey: ['wards'] })
      toast(ok)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2 className="section-title">Wards</h2>
      <div className="card">
        {(q.data ?? []).map((w) => (
          <div className="user-row" key={w.id}>
            <div><strong>{w.name}</strong> {!w.active && <Tag tone="warn">Hidden</Tag>}</div>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void run(() => setWardActive(w.id, !w.active), 'Saved')}>
              {w.active ? 'Hide from list' : 'Show again'}
            </button>
          </div>
        ))}
        <div className="row" style={{ marginTop: 10 }}>
          <label className="sr-only" htmlFor="new-ward">New ward name</label>
          <input id="new-ward" className="input" placeholder="New ward name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary btn-sm" disabled={busy || !name.trim()} onClick={() => void run(async () => { await addWard(name); setName('') }, 'Ward added')}>Add</button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Hiding a ward only removes it from the type-ahead list. Patients already on it keep it.</p>
      </div>
    </section>
  )
}