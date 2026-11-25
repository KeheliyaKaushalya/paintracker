import { toError } from '../../lib/errors'
import { todayISO } from '../../lib/dates'
import type { MedChange, PatientFull, Profile, Role, Round, Ward } from '../../lib/models'
import { supabase } from '../../lib/supabase'
import type { PatientBuild } from './schemas'

type WithoutRounds = Omit<PatientFull, 'rounds'>

/** All patients with a given status, with their medications, alerts and rounds. */
export async function fetchPatients(status: 'active' | 'discharged'): Promise<PatientFull[]> {
  const base = supabase.from('patients').select('*, patient_meds(*), patient_alerts(*, patient_alert_acks(user_id))').eq('status', status).is('deleted_at', null)
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
    .from('patients').select('*, patient_meds(*), patient_alerts(*, patient_alert_acks(user_id))').eq('id', id).maybeSingle()
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
  void addWard(build.patient.ward).catch(() => undefined)

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
  const saved = new Set(existingMedIds)
  const added = build.meds.filter((m) => !saved.has(m.id))
  if (added.length > 0) {
    const { error: e } = await supabase.from('patient_meds').insert(added.map((m) => ({ ...m, patient_id: id })))
    if (e) warnings.push('The patient was saved, but the new medications were not. Open Edit and add them again.')
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

export async function changeMedDose(medId: string, dose: string, freq: string, freqCustom: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('change_med_dose', { p_med: medId, p_dose: dose, p_freq: freq, p_freq_custom: freqCustom, p_reason: reason })
  if (error) throw toError(error)
}

export async function endMed(medId: string, status: 'stopped' | 'removed', reason: string): Promise<void> {
  const { error } = await supabase.rpc('end_med', { p_med: medId, p_status: status, p_reason: reason })
  if (error) throw toError(error)
}

export async function fetchMedChanges(patientId: string): Promise<MedChange[]> {
  const { data, error } = await supabase.from('patient_med_changes').select('*').eq('patient_id', patientId).order('changed_at', { ascending: false })
  if (error) throw toError(error)
  return (data ?? []) as MedChange[]
}

export async function ackAlert(alertId: string): Promise<void> {
  const { error } = await supabase.from('patient_alert_acks').insert({ alert_id: alertId })
  if (error && error.code !== '23505') throw toError(error) // 23505 = already acknowledged
}

export async function resolveAlert(alertId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('patient_alerts')
    .update({ resolved_at: new Date().toISOString(), resolved_by: userId }).eq('id', alertId)
  if (error) throw toError(error)
}
export async function fetchWards(): Promise<Ward[]> {
  const { data, error } = await supabase.from('wards').select('*').order('name')
  if (error) throw toError(error)
  return (data ?? []) as Ward[]
}

/** Adds a ward if it does not exist yet (a duplicate in any capitalisation is ignored). */
export async function addWard(name: string): Promise<void> {
  const clean = name.trim()
  if (!clean) return
  const { error } = await supabase.from('wards').insert({ name: clean })
  if (error && error.code !== '23505') throw toError(error)
}

export async function setWardActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('wards').update({ active }).eq('id', id)
  if (error) throw toError(error)
}
export async function deletePatient(id: string, reason: string): Promise<void> {
  const { error } = await supabase.from('patients').update({ deleted_at: new Date().toISOString(), delete_reason: reason.trim() }).eq('id', id)
  if (error) throw toError(error)
}

export async function restorePatient(id: string): Promise<void> {
  const { error } = await supabase.from('patients').update({ deleted_at: null, deleted_by: null, delete_reason: null }).eq('id', id)
  if (error) throw toError(error)
}

export async function fetchDeletedPatients(): Promise<PatientFull[]> {
  const { data, error } = await supabase.from('patients').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
  if (error) throw toError(error)
  return ((data ?? []) as unknown as Omit<PatientFull, 'patient_meds' | 'patient_alerts' | 'rounds'>[]).map((p) => ({ ...p, patient_meds: [], patient_alerts: [], rounds: [] }))
}