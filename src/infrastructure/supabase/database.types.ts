// Hand-written to match supabase/migrations. You can replace this file with the generated one:
//   npm run types   (after setting your project ref in package.json)
// Everything in the app derives its types from here via src/lib/models.ts.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ProfileRow = {
  id: string;
  full_name: string;
  role: "nurse" | "resident" | "consultant" | "admin";
  active: boolean;
  created_at: string;
};

type PatientRow = {
  id: string;
  bht: string;
  full_name: string;
  age: number | null;
  sex: string | null;
  ward: string;
  category: string;
  category_note: string | null;
  surgery: string | null;
  indication: string | null;
  surgery_date: string | null;
  surgery_time: string | null;
  anaesthesia_mode: string | null;
  has_epidural: boolean;
  ep_level: string | null;
  ep_inserted_date: string | null;
  ep_inserted_time: string | null;
  ep_test_dose: string | null;
  has_nerve_catheter: boolean;
  nv_type: string | null;
  nv_inserted_date: string | null;
  nv_inserted_time: string | null;
  has_pca: boolean;
  pca_drug: string | null;
  pca_bolus: string | null;
  pca_lockout: string | null;
  pca_max_hr: string | null;
  status: string;
  discharged_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  delete_reason: string | null;
  pdph_level: string | null;
  pdph_needle: string | null;
  pdph_attempts: number | null;
  pdph_symptoms: string | null;
  pdph_complaint: string | null;
  pdph_condition: string | null;
  pdph_management: string | null;
};

type MedRow = {
  id: string;
  patient_id: string;
  sort_order: number;
  drug: string;
  route: string;
  dose: string | null;
  freq: string | null;
  freq_custom: string | null;
  dosing: string;
  topup: string | null;
  status: string;
  started_at: string | null;
  started_by: string | null;
  ended_at: string | null;
  ended_by: string | null;
  end_reason: string | null;
};

type AlertRow = {
  id: string;
  patient_id: string;
  alert_text: string;
  created_by: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

type RoundRow = {
  id: string;
  patient_id: string;
  kind: string;
  round_date: string;
  round_time: string | null;
  session: string | null;
  pain_rest: number | null;
  pain_move: number | null;
  pain_cough: number | null;
  pain_physio: number | null;
  rr: number | null;
  spo2: number | null;
  hr: number | null;
  bp_sys: number | null;
  bp_dia: number | null;
  gcs: number | null;
  mobilization: string | null;
  tags: string[];
  note: string | null;
  amended_of: string | null;
  created_by: string;
  created_at: string;
};

type MedChangeRow = {
  id: string;
  med_id: string;
  patient_id: string;
  from_dose: string | null;
  to_dose: string | null;
  from_freq: string | null;
  to_freq: string | null;
  reason: string | null;
  changed_by: string;
  changed_at: string;
};

type AlertAckRow = {
  id: string;
  alert_id: string;
  user_id: string;
  acked_at: string;
};

type WardRow = {
  id: string;
  name: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
};

type ShiftTemplateRow = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  active: boolean;
  created_at: string;
};

type ShiftAssignmentRow = {
  id: string;
  shift_date: string;
  template_id: string;
  assignee_id: string | null;
  assignee_name: string | null;
  note: string | null;
  assigned_by: string | null;
  updated_at: string;
};

type ExportLogRow = {
  id: string;
  kind: string;
  row_count: number;
  exported_by: string;
  exported_at: string;
};

type AuditRow = {
  id: number;
  at: string;
  actor: string | null;
  table_name: string;
  row_id: string | null;
  action: string;
  old_row: Json | null;
  new_row: Json | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      patients: {
        Row: PatientRow;
        Insert: Partial<PatientRow> &
          Pick<PatientRow, "bht" | "full_name" | "ward">;
        Update: Partial<PatientRow>;
        Relationships: [];
      };
      patient_meds: {
        Row: MedRow;
        Insert: Partial<MedRow> & Pick<MedRow, "patient_id" | "drug" | "route">;
        Update: Partial<MedRow>;
        Relationships: [];
      };
      patient_med_changes: {
        Row: MedChangeRow;
        Insert: Partial<MedChangeRow> &
          Pick<MedChangeRow, "med_id" | "patient_id">;
        Update: Partial<MedChangeRow>;
        Relationships: [];
      };
      patient_alerts: {
        Row: AlertRow;
        Insert: Partial<AlertRow> & Pick<AlertRow, "patient_id" | "alert_text">;
        Update: Partial<AlertRow>;
        Relationships: [];
      };
      patient_alert_acks: {
        Row: AlertAckRow;
        Insert: Partial<AlertAckRow> & Pick<AlertAckRow, "alert_id">;
        Update: Partial<AlertAckRow>;
        Relationships: [];
      };
      rounds: {
        Row: RoundRow;
        Insert: Partial<RoundRow> &
          Pick<RoundRow, "patient_id" | "kind" | "round_date">;
        Update: Partial<RoundRow>;
        Relationships: [];
      };
      wards: {
        Row: WardRow;
        Insert: Partial<WardRow> & Pick<WardRow, "name">;
        Update: Partial<WardRow>;
        Relationships: [];
      };
      export_log: {
        Row: ExportLogRow;
        Insert: Partial<ExportLogRow> &
          Pick<ExportLogRow, "kind" | "row_count">;
        Update: Partial<ExportLogRow>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditRow;
        Insert: Partial<AuditRow> & Pick<AuditRow, "table_name" | "action">;
        Update: Partial<AuditRow>;
        Relationships: [];
      };
      shift_templates: {
        Row: ShiftTemplateRow;
        Insert: Partial<ShiftTemplateRow> &
          Pick<ShiftTemplateRow, "name" | "start_time" | "end_time">;
        Update: Partial<ShiftTemplateRow>;
        Relationships: [];
      };
      shift_assignments: {
        Row: ShiftAssignmentRow;
        Insert: Partial<ShiftAssignmentRow> &
          Pick<ShiftAssignmentRow, "shift_date" | "template_id">;
        Update: Partial<ShiftAssignmentRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      log_export: {
        Args: { description: string; export_kind: string; row_count: number };
        Returns: undefined;
      };
      change_med_dose: {
        Args: {
          p_med: string;
          p_dose: string;
          p_freq: string;
          p_freq_custom: string;
          p_reason: string;
        };
        Returns: undefined;
      };
      end_med: {
        Args: { p_med: string; p_status: string; p_reason: string };
        Returns: undefined;
      };
    };
    Enums: { app_role: "nurse" | "resident" | "consultant" | "admin" };
    CompositeTypes: { [_ in never]: never };
  };
};
