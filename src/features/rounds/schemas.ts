import { z } from 'zod'
import { MOBILIZATION, ROUND_TAGS, SESSIONS } from '../../lib/constants'
import { parseBp } from '../../lib/bp'
import type { RoundInsert } from '../../lib/models'

export type FieldErrors = Record<string, string>
export type BuildResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors }

/** What the form holds (everything the user types is a string until it is checked). */
export interface RoundFormValues {
  kind: 'pain' | 'ward'
  round_date: string
  round_time: string
  session: string
  pain_rest: number | null
  pain_move: number | null
  rr: string
  spo2: string
  hr: string
  bp: string
  gcs: string
  mobilization: string
  tags: string[]
  note: string
}

export interface RoundContext {
  id: string
  patient_id: string
  created_by: string
  amended_of: string | null
}

const rangeInt = (label: string, min: number, max: number) =>
  z
    .number(`${label} must be a number`)
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be between ${min} and ${max}`)
    .max(max, `${label} must be between ${min} and ${max}`)
    .nullable()

const roundSchema = z
  .object({
    id: z.guid(),
    patient_id: z.guid(),
    created_by: z.guid(),
    amended_of: z.guid().nullable(),
    kind: z.enum(['pain', 'ward']),
    round_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
    round_time: z.string().regex(/^\d{2}:\d{2}$/, 'Enter a time like 08:30').nullable(),
    session: z.enum(SESSIONS).nullable(),
    pain_rest: rangeInt('Rest pain', 0, 10),
    pain_move: rangeInt('Movement pain', 0, 10),
    rr: rangeInt('Respiratory rate', 0, 80),
    spo2: rangeInt('SpO2', 0, 100),
    hr: rangeInt('Heart rate', 0, 300),
    bp_sys: rangeInt('Systolic BP', 0, 350),
    bp_dia: rangeInt('Diastolic BP', 0, 250),
    gcs: rangeInt('GCS', 3, 15),
    mobilization: z.enum(MOBILIZATION).nullable(),
    tags: z.array(z.enum(ROUND_TAGS)),
    note: z.string().max(2000, 'Note is too long (2000 characters maximum)').nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'pain') {
      if (v.pain_rest == null) ctx.addIssue({ code: 'custom', path: ['pain_rest'], message: 'Choose a rest pain score' })
      if (v.pain_move == null) ctx.addIssue({ code: 'custom', path: ['pain_move'], message: 'Choose a movement pain score' })
    } else if (!v.note || !v.note.trim()) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Write a note for this ward round' })
    }
  })

/** Whole-number text field -> number | null. Returns NaN for text that is not a whole number. */
function toInt(s: string): number | null {
  const t = s.trim()
  if (t === '') return null
  return /^\d+$/.test(t) ? Number(t) : Number.NaN
}

export function buildRoundInsert(f: RoundFormValues, ctx: RoundContext): BuildResult<RoundInsert> {
  const errors: FieldErrors = {}

  const bpText = f.bp.trim()
  const bp = bpText ? parseBp(bpText) : null
  if (bpText && !bp) errors.bp = 'Enter blood pressure like 120/80'

  const pain = f.kind === 'pain'
  const candidate = {
    ...ctx,
    kind: f.kind,
    round_date: f.round_date,
    round_time: f.round_time.trim() || null,
    session: pain || f.session ? (f.session || null) : null,
    pain_rest: pain ? f.pain_rest : null,
    pain_move: pain ? f.pain_move : null,
    rr: pain ? toInt(f.rr) : null,
    spo2: pain ? toInt(f.spo2) : null,
    hr: pain ? toInt(f.hr) : null,
    bp_sys: pain && bp ? bp.sys : null,
    bp_dia: pain && bp ? bp.dia : null,
    gcs: pain ? toInt(f.gcs) : null,
    mobilization: pain ? (f.mobilization || null) : null,
    tags: f.tags,
    note: f.note.trim() || null,
  }

  const parsed = roundSchema.safeParse(candidate)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      let key = String(issue.path[0] ?? 'form')
      if (key === 'bp_sys' || key === 'bp_dia') key = 'bp'
      if (!errors[key]) errors[key] = issue.message
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: (parsed as { data: RoundInsert }).data }
}
