import { useMemo, useState } from 'react'
import { Empty, ErrorBox, Spinner } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { CATEGORIES } from '../../lib/constants'
import { categoryCounts, emptyFilters, filterPatients, sortBoard, type BoardFilters } from './filters'
import { useNameLookup, usePatients } from './hooks'
import { PatientCard } from './PatientCard'

export function BoardPage() {
  const q = usePatients('active')
  const nameOf = useNameLookup()
  const [f, setF] = useState<BoardFilters>(emptyFilters)
  const patients = q.data
  const counts = useMemo(() => categoryCounts(patients ?? []), [patients])
  const wards = useMemo(() => [...new Set((patients ?? []).map((p) => p.ward))].sort(), [patients])
  const shown = useMemo(() => sortBoard(filterPatients(patients ?? [], f)), [patients, f])
  const set = (patch: Partial<BoardFilters>) => setF((cur) => ({ ...cur, ...patch }))
  const filtering = f.search || f.ward || f.from || f.to || f.category !== 'All'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ward board</h1>
          <p className="muted">{patients ? `${patients.length} active patients under pain follow-up` : 'Loading…'}</p>
        </div>
      </div>

      <div className="cat-tabs" role="tablist" aria-label="Patient category">
        {['All', ...CATEGORIES].map((c) => (
          <button key={c} role="tab" aria-selected={f.category === c} className={`cat-tab ${f.category === c ? 'active' : ''}`} onClick={() => set({ category: c })}>
            {c}<span className="count">{counts[c] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="field" style={{ position: 'relative' }}>
        <label htmlFor="search" className="sr-only">Search by name or BHT</label>
        <span style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ink-faint)' }}><Icon name="search" /></span>
        <input id="search" className="input" style={{ paddingLeft: 40 }} type="search" placeholder="Search name or BHT" value={f.search} onChange={(e) => set({ search: e.target.value })} />
      </div>

      <div className="filters">
        <div className="field ward-f">
          <label htmlFor="ward">Ward</label>
          <select id="ward" className="input" value={f.ward} onChange={(e) => set({ ward: e.target.value })}>
            <option value="">All wards</option>
            {wards.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="from">Surgery from</label>
          <input id="from" className="input" type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="to">to</label>
          <input id="to" className="input" type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} />
        </div>
      </div>
      {filtering && (
        <button className="btn btn-ghost btn-sm" onClick={() => setF(emptyFilters)} style={{ marginBottom: 8 }}>Clear filters</button>
      )}

      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => void q.refetch()} />}
      {patients && shown.length === 0 && (
        <Empty title={patients.length === 0 ? 'No active patients' : 'No patients match these filters'}>
          {patients.length === 0 ? 'Tap + to add the first patient.' : 'Clear the filters to see everyone.'}
        </Empty>
      )}
      {shown.map((p) => <PatientCard key={p.id} patient={p} nameOf={nameOf} />)}
    </div>
  )
}
