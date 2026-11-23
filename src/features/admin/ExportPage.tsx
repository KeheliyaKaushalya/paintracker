import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { formatBp } from '../../lib/bp'
import { hhmm } from '../../lib/dates'
import { download, toCsv, toOds, type Cell } from '../../lib/export'
import type { PatientFull } from '../../lib/models'
import { effectiveRounds, newestFirst } from '../../lib/rounds'
import { supabase } from '../../lib/supabase'
import { toError } from '../../lib/errors'
import { fetchPatients } from '../patients/api'
import { useNameLookup } from '../patients/hooks'

const stampName = () => new Date().toISOString().slice(0, 10)

function patientRows(list: PatientFull[]): Cell[][] {
  return [
    ['BHT', 'Name', 'Age', 'Sex', 'Ward', 'Category', 'Surgery', 'Surgery date', 'Anaesthesia', 'Epidural level', 'Nerve catheter', 'PCA drug', 'Status', 'Discharged'],
    ...list.map((p) => [
      p.bht, p.full_name, p.age, p.sex, p.ward, p.category, p.surgery, p.surgery_date, p.anaesthesia_mode,
      p.has_epidural ? p.ep_level : '', p.has_nerve_catheter ? p.nv_type : '', p.has_pca ? p.pca_drug : '',
      p.status, p.discharged_date,
    ]),
  ]
}

function roundRows(list: PatientFull[], nameOf: (id: string) => string): Cell[][] {
  const head: Cell[] = ['BHT', 'Date', 'Time', 'Session', 'Type', 'Rest', 'Movement', 'Cough', 'Physio', 'RR', 'SpO2', 'HR', 'BP', 'GCS', 'Mobilization', 'Tags', 'Note', 'Recorded by', 'Corrected']
  const rows: Cell[][] = []
  for (const p of list) {
    for (const r of effectiveRounds(p.rounds).sort(newestFirst)) {
      rows.push([
        p.bht, r.round_date, hhmm(r.round_time), r.session, r.kind, r.pain_rest, r.pain_move, r.pain_cough, r.pain_physio,
        r.rr, r.spo2, r.hr, formatBp(r.bp_sys, r.bp_dia), r.gcs, r.mobilization, r.tags.join('; '), r.note,
        nameOf(r.created_by), r.amended_of ? 'yes' : 'no',
      ])
    }
  }
  return [head, ...rows]
}

export function ExportPage() {
  const toast = useToast()
  const nameOf = useNameLookup()
  const [busy, setBusy] = useState<string | null>(null)

  async function run(kind: 'patients_csv' | 'rounds_csv' | 'workbook_ods') {
    setBusy(kind)
    try {
      const [active, discharged] = await Promise.all([fetchPatients('active'), fetchPatients('discharged')])
      const all = [...active, ...discharged]
      const day = stampName()
      let count = 0
      if (kind === 'patients_csv') {
        const rows = patientRows(all)
        count = rows.length - 1
        download(`dpmr-patients-${day}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
      } else if (kind === 'rounds_csv') {
        const rows = roundRows(all, nameOf)
        count = rows.length - 1
        download(`dpmr-rounds-${day}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
      } else {
        const p = patientRows(all)
        const r = roundRows(all, nameOf)
        count = p.length - 1 + r.length - 1
        download(`dpmr-export-${day}.ods`, toOds([{ name: 'Patients', rows: p }, { name: 'Rounds', rows: r }]), 'application/vnd.oasis.opendocument.spreadsheet')
      }
      const { error } = await supabase.from('export_log').insert({ kind, row_count: count })
      if (error) throw toError(error)
      toast(`Exported ${count} rows`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="stack">
      <div className="row between">
        <Link to="/team" className="btn btn-ghost btn-sm"><Icon name="back" />Team</Link>
        <h1 style={{ fontSize: 20 }}>Export data</h1>
      </div>
      <div className="warn-list">
        These files contain patient names and clinical details. Store them securely and delete them when you are done. Every export is recorded.
        The export covers all active patients and the 200 most recently discharged.
      </div>
      <div className="card stack">
        <button className="btn btn-outline" disabled={!!busy} onClick={() => void run('patients_csv')}>{busy === 'patients_csv' ? 'Preparing…' : 'Patients (CSV)'}</button>
        <button className="btn btn-outline" disabled={!!busy} onClick={() => void run('rounds_csv')}>{busy === 'rounds_csv' ? 'Preparing…' : 'Rounds (CSV)'}</button>
        <button className="btn btn-outline" disabled={!!busy} onClick={() => void run('workbook_ods')}>{busy === 'workbook_ods' ? 'Preparing…' : 'Patients and rounds (ODS spreadsheet)'}</button>
      </div>
    </div>
  )
}