import { z } from 'zod'
import {
  ANAESTHESIA_MODES, CATEGORIES, MED_DOSINGS, MED_DRUGS, MED_FREQS, MED_ROUTES, NERVE_TYPES, SEXES,
} from '../../lib/constants'
import { hhmm } from '../../lib/dates'
import type { PatientFull, PatientInsert } from '../../lib/models'
import type { BuildResult, FieldErrors } from '../rounds/schemas'

export interface MedFormRow {
  id: string
  drug: string
  route: string
  dose: string
  freq: string
  freq_custom: string
  dosing: 'single' | 'loading'
  topup: string
}

export interface PatientFormValues {
  full_name: string
  age: string
  sex: string
  bht: string
  ward: string
  category: string
  category_note: string
  surgery: string
  indication: string
  surgery_date: string
  surgery_time: string
  anaesthesia_mode: string
  has_epidural: boolean
  ep_level: string
  ep_inserted_date: string
  ep_inserted_time: string
  ep_test_dose: string
  has_nerve_catheter: boolean
  nv_type: string
  nv_inserted_date: string
  nv_inserted_time: string
  has_pca: boolean
  pca_drug: string
  pca_bolus: string
  pca_lockout: string
  pca_max_hr: string
  meds: MedFormRow[]
  new_alert: string
}

export const newMedRow = (): MedFormRow => ({
  id: crypto.randomUUID(), drug: 'Paracetamol', route: 'IV', dose: '', freq: 'Every 6h', freq_custom: '', dosing: 'single', topup: '',
})

export function emptyPatientForm(): PatientFormValues {
  return {
    full_name: '', age: '', sex: '', bht: '', ward: '7A', category: 'Surgery', category_note: '',
    surgery: '', indication: '', surgery_date: '', surgery_time: '', anaesthesia_mode: '',
    has_epidural: false, ep_level: '', ep_inserted_date: '', ep_inserted_time: '', ep_test_dose: '',
    has_nerve_catheter: false, nv_type: 'Supraclavicular', nv_inserted_date: '', nv_inserted_time: '',
    has_pca: false, pca_drug: '', pca_bolus: '', pca_lockout: '', pca_max_hr: '',
    meds: [], new_alert: '',
  }
}

export function patientToForm(p: PatientFull): PatientFormValues {
  const s = (v: string | null | undefined) => v ?? ''
  return {
    full_name: p.full_name, age: p.age == null ? '' : String(p.age), sex: s(p.sex), bht: p.bht, ward: p.ward,
    category: p.category, category_note: s(p.category_note), surgery: s(p.surgery), indication: s(p.indication),
    surgery_date: s(p.surgery_date), surgery_time: hhmm(p.surgery_time), anaesthesia_mode: s(p.anaesthesia_mode),
    has_epidural: p.has_epidural, ep_level: s(p.ep_level), ep_inserted_date: s(p.ep_inserted_date),
    ep_inserted_time: hhmm(p.ep_inserted_time), ep_test_dose: s(p.ep_test_dose),
    has_nerve_catheter: p.has_nerve_catheter, nv_type: s(p.nv_type) || 'Supraclavicular',
    nv_inserted_date: s(p.nv_inserted_date), nv_inserted_time: hhmm(p.nv_inserted_time),
    has_pca: p.has_pca, pca_drug: s(p.pca_drug), pca_bolus: s(p.pca_bolus), pca_lockout: s(p.pca_lockout), pca_max_hr: s(p.pca_max_hr),
    meds: [...p.patient_meds].sort((a, b) => a.sort_order - b.sort_order).map((m) => ({
      id: m.id, drug: m.drug, route: m.route, dose: s(m.dose), freq: s(m.freq), freq_custom: s(m.freq_custom),
      dosing: m.dosing === 'loading' ? 'loading' : 'single', topup: s(m.topup),
    })),
    new_alert: '',
  }
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date').nullable()
const time = z.string().regex(/^\d{2}:\d{2}$/, 'Enter a time like 08:30').nullable()
const text = (max = 500) => z.string().max(max, `Too long (${max} characters maximum)`).nullable()

const patientSchema = z
  .object({
    full_name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
    bht: z.string().min(1, 'BHT number is required').max(60, 'BHT is too long'),
    age: z.number('Age must be a number').int('Age must be a whole number').min(0, 'Age must be between 0 and 120').max(120, 'Age must be between 0 and 120').nullable(),
    sex: z.enum(SEXES).nullable(),
    ward: z.string().min(1, 'Ward is required').max(60),
    category: z.enum(CATEGORIES),
    category_note: text(1000),
    surgery: text(),
    indication: text(),
    surgery_date: date,
    surgery_time: time,
    anaesthesia_mode: z.enum(ANAESTHESIA_MODES).nullable(),
    has_epidural: z.boolean(),
    ep_level: text(60),
    ep_inserted_date: date,
    ep_inserted_time: time,
    ep_test_dose: text(200),
    has_nerve_catheter: z.boolean(),
    nv_type: z.enum(NERVE_TYPES).nullable(),
    nv_inserted_date: date,
    nv_inserted_time: time,
    has_pca: z.boolean(),
    pca_drug: text(100),
    pca_bolus: text(100),
    pca_lockout: text(100),
    pca_max_hr: text(100),
  })
  .superRefine((v, ctx) => {
    if (v.has_epidural && !v.ep_level) ctx.addIssue({ code: 'custom', path: ['ep_level'], message: 'Enter the epidural level' })
  })

const medSchema = z.object({
  id: z.guid(),
  drug: z.enum(MED_DRUGS),
  route: z.enum(MED_ROUTES),
  dose: text(100),
  freq: z.enum(MED_FREQS).nullable(),
  freq_custom: text(100),
  dosing: z.enum(MED_DOSINGS),
  topup: text(100),
})

export type PatientRecord = Omit<PatientInsert, 'id' | 'created_by'>
export interface MedRecord {
  id: string
  sort_order: number
  drug: string
  route: string
  dose: string | null
  freq: string | null
  freq_custom: string | null
  dosing: string
  topup: string | null
}
export interface PatientBuild {
  patient: PatientRecord
  meds: MedRecord[]
  alert: string | null
}

const blank = (s: string) => s.trim() || null

export function buildPatient(f: PatientFormValues): BuildResult<PatientBuild> {
  const errors: FieldErrors = {}
  const ageText = f.age.trim()
  const age = ageText === '' ? null : /^\d+$/.test(ageText) ? Number(ageText) : Number.NaN

  const ep = f.has_epidural
  const nv = f.has_nerve_catheter
  const pca = f.has_pca
  const candidate = {
    full_name: f.full_name.trim(), bht: f.bht.trim(), age, sex: f.sex || null, ward: f.ward.trim(),
    category: f.category, category_note: blank(f.category_note),
    surgery: blank(f.surgery), indication: blank(f.indication),
    surgery_date: f.surgery_date || null, surgery_time: f.surgery_time || null,
    anaesthesia_mode: f.anaesthesia_mode || null,
    has_epidural: ep, ep_level: ep ? blank(f.ep_level) : null,
    ep_inserted_date: ep ? f.ep_inserted_date || null : null, ep_inserted_time: ep ? f.ep_inserted_time || null : null,
    ep_test_dose: ep ? blank(f.ep_test_dose) : null,
    has_nerve_catheter: nv, nv_type: nv ? f.nv_type || null : null,
    nv_inserted_date: nv ? f.nv_inserted_date || null : null, nv_inserted_time: nv ? f.nv_inserted_time || null : null,
    has_pca: pca, pca_drug: pca ? blank(f.pca_drug) : null, pca_bolus: pca ? blank(f.pca_bolus) : null,
    pca_lockout: pca ? blank(f.pca_lockout) : null, pca_max_hr: pca ? blank(f.pca_max_hr) : null,
  }

  const parsed = patientSchema.safeParse(candidate)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      if (!errors[key]) errors[key] = issue.message
    }
  }

  const meds: MedRecord[] = []
  f.meds.forEach((m, i) => {
    const r = medSchema.safeParse({
      id: m.id, drug: m.drug, route: m.route, dose: blank(m.dose), freq: m.freq || null,
      freq_custom: m.freq === 'Other' ? blank(m.freq_custom) : null, dosing: m.dosing,
      topup: m.dosing === 'loading' ? blank(m.topup) : null,
    })
    if (!r.success) errors[`med_${i}`] = r.error.issues[0]?.message ?? 'Check this medication'
    else meds.push({ ...r.data, sort_order: i })
  })

  const alert = blank(f.new_alert)
  if (alert && alert.length > 1000) errors.new_alert = 'Alert is too long (1000 characters maximum)'

  if (Object.keys(errors).length > 0 || !parsed.success) return { ok: false, errors }
  return { ok: true, value: { patient: parsed.data as PatientRecord, meds, alert } }
}
