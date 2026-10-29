import { useMemo, useState } from 'react'
import { Empty, ErrorBox, Spinner } from '../../components/ui'
import { useNameLookup, usePatients } from './hooks'
import { PatientCard } from './PatientCard'

export function DischargedPage() {
  const q = usePatients('discharged')
  const nameOf = useNameLookup()
  const [search, setSearch] = useState('')
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase()
    return (q.data ?? []).filter((p) => !s || p.full_name.toLowerCase().includes(s) || p.bht.toLowerCase().includes(s))
  }, [q.data, search])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Discharged</h1>
          <p className="muted">Most recent 200 discharged patients</p>
        </div>
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="dsearch" className="sr-only">Search by name or BHT</label>
        <input id="dsearch" className="input" type="search" placeholder="Search name or BHT" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => void q.refetch()} />}
      {q.data && shown.length === 0 && <Empty title="No discharged patients" />}
      {shown.map((p) => <PatientCard key={p.id} patient={p} nameOf={nameOf} />)}
    </div>
  )
}
