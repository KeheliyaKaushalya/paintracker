import { toError } from '../../lib/errors'
import { todayISO } from '../../lib/dates'
import type { PatientFull, Profile, Role, Round } from '../../lib/models'
import { supabase } from '../../lib/supabase'
import type { PatientBuild } from './schemas'

type WithoutRounds = Omit<PatientFull, 'rounds'>

/** All patients with a given status, with their medications, alerts and rounds. */
export async function fetchPatients(status: 'active' | 'discharged'): Promise<PatientFull[]> {
  const base = supabase.from('patients').select('*, patient_meds(*), patient_alerts(*)').eq('status', status)
  const { data, error } =
    status === 'active'
      ? await base.order('ward').order('full_name')
      : await base.order('discharged_date', { ascending: false }).limit(200)
  if (error) throw toError(error)
  const patients = (data ?? []) as unknown as WithoutRounds[]
  if (patients.length === 0) return []

  const { data: rounds, error: e2 } = await supabase.from('rounds').select('*').in('patient_id', patients.map((p) => p.id))
  if (e2) throw toError(e2)
  const byPatient = new Map<string, Round[]>()
  for (const r of (rounds ?? []) as Round[]) {
    const list = byPatient.get(r.patient_id) ?? []
    list.push(r)
    byPatient.set(r.patient_id, list)
  }
  return patients.map((p) => ({ ...p, rounds: byPatient.get(p.id) ?? [] }))
}

export async function fetchPatient(id: string): Promise<PatientFull | null> {
  const { data, error } = await supabase
    .from('patients').select('*, patient_meds(*), patient_alerts(*)').eq('id', id).maybeSingle()
  if (error) throw toError(error)
  if (!data) return null
  const { data: rounds, error: e2 } = await supabase.from('rounds').select('*').eq('patient_id', id)
  if (e2) throw toError(e2)
  return { ...(data as unknown as WithoutRounds), rounds: (rounds ?? []) as Round[] }
}

export interface SaveOutcome {
  id: string
  warnings: string[]
}

export async function createPatient(build: PatientBuild, userId: string): Promise<SaveOutcome> {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('patients').insert({ ...build.patient, id, created_by: userId })
  if (error) throw toError(error)

  const warnings: string[] = []
  if (build.meds.length > 0) {
    const { error: e } = await supabase.from('patient_meds').insert(build.meds.map((m) => ({ ...m, patient_id: id })))
    if (e) warnings.push('The patient was saved, but the medications were not. Open Edit and add them again.')
  }
  if (build.alert) {
    const { error: e } = await supabase.from('patient_alerts').insert({ patient_id: id, alert_text: build.alert, created_by: userId })
    if (e) warnings.push('The patient was saved, but the alert was not. Add it again from the patient page.')
  }
  return { id, warnings }
}

export async function updatePatient(id: string, build: PatientBuild, existingMedIds: string[]): Promise<SaveOutcome> {
  const { error } = await supabase.from('patients').update(build.patient).eq('id', id)
  if (error) throw toError(error)

  const warnings: string[] = []
  // Save the current medications first; only then remove the ones that were taken out,
  // so a failure part-way can never leave the patient with fewer medications than before.
  if (build.meds.length > 0) {
    const { error: e } = await supabase.from('patient_meds').upsert(build.meds.map((m) => ({ ...m, patient_id: id })), { onConflict: 'id' })
    if (e) {
      warnings.push('The patient was saved, but the medication list was not updated. Open Edit and check it.')
      return { id, warnings }
    }
  }
  const keep = new Set(build.meds.map((m) => m.id))
  const removed = existingMedIds.filter((x) => !keep.has(x))
  if (removed.length > 0) {
    const { error: e } = await supabase.from('patient_meds').delete().in('id', removed)
    if (e) warnings.push('Some removed medications are still listed. Open Edit and remove them again.')
  }
  return { id, warnings }
}

export async function addAlert(patientId: string, text: string, userId: string): Promise<void> {
  const { error } = await supabase.from('patient_alerts').insert({ patient_id: patientId, alert_text: text.trim(), created_by: userId })
  if (error) throw toError(error)
}

export async function dischargePatient(id: string): Promise<void> {
  const { error } = await supabase.from('patients').update({ status: 'discharged', discharged_date: todayISO() }).eq('id', id)
  if (error) throw toError(error)
}

export async function readmitPatient(id: string): Promise<void> {
  const { error } = await supabase.from('patients').update({ status: 'active', discharged_date: null }).eq('id', id)
  if (error) throw toError(error)
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name')
  if (error) throw toError(error)
  return (data ?? []) as Profile[]
}

export async function updateProfile(id: string, patch: { active?: boolean; role?: Role; full_name?: string }): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id)
  if (error) throw toError(error)
}
