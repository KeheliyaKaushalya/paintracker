import type { Database } from './database.types'

type T = Database['public']['Tables']

export type Role = Database['public']['Enums']['app_role']
export type Profile = T['profiles']['Row']
export type Patient = T['patients']['Row']
export type PatientInsert = T['patients']['Insert']
export type PatientMed = T['patient_meds']['Row']
export type PatientMedInsert = T['patient_meds']['Insert']
export type MedChange = T['patient_med_changes']['Row']
export type PatientAlert = T['patient_alerts']['Row']
export type AlertAck = T['patient_alert_acks']['Row']
export type PatientAlertWithAcks = PatientAlert & { patient_alert_acks: Pick<AlertAck, 'user_id'>[] }
export type Round = T['rounds']['Row']
export type RoundInsert = T['rounds']['Insert']
export type Ward = T['wards']['Row']

/** A patient together with everything attached to it. */
export type PatientFull = Patient & {
  patient_meds: PatientMed[]
  patient_alerts: PatientAlertWithAcks[]
  rounds: Round[]
}
