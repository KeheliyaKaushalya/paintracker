// Hand-written to match supabase/migrations. You can replace this file with the generated one:
//   npm run types   (after setting your project ref in package.json)
// Everything in the app derives its types from here via src/lib/models.ts.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type ProfileRow = {
  id: string
  full_name: string
  role: 'nurse' | 'resident' | 'consultant' | 'admin'
  active: boolean
  created_at: string
}

type PatientRow = {
  id: string
  bht: string
  full_name: string
  age: number | null
  sex: string | null
  ward: string
  category: string
  category_note: string | null
  surgery: string | null
  indication: string | null
  surgery_date: string | null
  surgery_time: string | null
  anaesthesia_mode: string | null
  has_epidural: boolean
  ep_level: string | null
  ep_inserted_date: string | null
  ep_inserted_time: string | null
  ep_test_dose: string | null
  has_nerve_catheter: boolean
  nv_type: string | null
  nv_inserted_date: string | null
  nv_inserted_time: string | null
  has_pca: boolean
  pca_drug: string | null
  pca_bolus: string | null
  pca_lockout: string | null
  pca_max_hr: string | null
  status: string
  discharged_date: string | null
  created_by: string
  created_at: string
  updated_at: string
}

type MedRow = {
  id: string
  patient_id: string
  sort_order: number
  drug: string
  route: string
  dose: string | null
  freq: string | null
  freq_custom: string | null
  dosing: string
  topup: string | null
}

type AlertRow = {
  id: string
  patient_id: string
  alert_text: string
  created_by: string
  created_at: string
}

type RoundRow = {
  id: string
  patient_id: string
  kind: string
  round_date: string
  round_time: string | null
  session: string | null
  pain_rest: number | null
  pain_move: number | null
  rr: number | null
  spo2: number | null
  hr: number | null
  bp_sys: number | null
  bp_dia: number | null
  gcs: number | null
  mobilization: string | null
  tags: string[]
  note: string | null
  amended_of: string | null
  created_by: string
  created_at: string
}

type AuditRow = {
  id: number
  at: string
  actor: string | null
  table_name: string
  row_id: string | null
  action: string
  old_row: Json | null
  new_row: Json | null
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Partial<ProfileRow> & { id: string }
        Update: Partial<ProfileRow>
        Relationships: []
      }
      patients: {
        Row: PatientRow
        Insert: Partial<PatientRow> & Pick<PatientRow, 'bht' | 'full_name' | 'ward'>
        Update: Partial<PatientRow>
        Relationships: []
      }
      patient_meds: {
        Row: MedRow
        Insert: Partial<MedRow> & Pick<MedRow, 'patient_id' | 'drug' | 'route'>
        Update: Partial<MedRow>
        Relationships: []
      }
      patient_alerts: {
        Row: AlertRow
        Insert: Partial<AlertRow> & Pick<AlertRow, 'patient_id' | 'alert_text'>
        Update: Partial<AlertRow>
        Relationships: []
      }
      rounds: {
        Row: RoundRow
        Insert: Partial<RoundRow> & Pick<RoundRow, 'patient_id' | 'kind' | 'round_date'>
        Update: Partial<RoundRow>
        Relationships: []
      }
      audit_log: {
        Row: AuditRow
        Insert: Partial<AuditRow> & Pick<AuditRow, 'table_name' | 'action'>
        Update: Partial<AuditRow>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { app_role: 'nurse' | 'resident' | 'consultant' | 'admin' }
    CompositeTypes: { [_ in never]: never }
  }
}
