import { describe, expect, it } from 'vitest'
import { buildPatient, emptyPatientForm, newMedRow } from './patients/schemas'
import { buildRoundInsert, type RoundFormValues } from './rounds/schemas'

const ctx = {
  id: crypto.randomUUID(), patient_id: crypto.randomUUID(), created_by: crypto.randomUUID(), amended_of: null,
}
const painForm = (over: Partial<RoundFormValues> = {}): RoundFormValues => ({
  kind: 'pain', round_date: '2026-10-20', round_time: '08:30', session: 'Morning', pain_rest: 3, pain_move: 5,
  rr: '', spo2: '', hr: '', bp: '', gcs: '', mobilization: '', tags: [], note: '', ...over,
})

describe('pain round form', () => {
  it('accepts a normal round and converts text to numbers', () => {
    const r = buildRoundInsert(painForm({ spo2: '97', hr: '80', bp: '120/80', gcs: '15', mobilization: 'Mobilized', tags: ['Top-up given'] }), ctx)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toMatchObject({ kind: 'pain', spo2: 97, hr: 80, bp_sys: 120, bp_dia: 80, gcs: 15, mobilization: 'Mobilized', note: null })
    }
  })
  it('rejects the SpO2 typo 980 and says where', () => {
    const r = buildRoundInsert(painForm({ spo2: '980' }), ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.spo2).toMatch(/SpO2/)
  })
  it('rejects text where a number belongs', () => {
    const r = buildRoundInsert(painForm({ hr: 'abc' }), ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.hr).toBeDefined()
  })
  it('needs both pain scores', () => {
    const r = buildRoundInsert(painForm({ pain_move: null }), ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.pain_move).toMatch(/movement/i)
  })
  it('rejects badly typed blood pressure', () => {
    const r = buildRoundInsert(painForm({ bp: '12080' }), ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.bp).toMatch(/120\/80/)
  })
  it('does not block extreme-but-real values', () => {
    expect(buildRoundInsert(painForm({ spo2: '62', hr: '35', bp: '70/40', gcs: '5' }), ctx).ok).toBe(true)
  })
  it('GCS below 3 is impossible', () => {
    expect(buildRoundInsert(painForm({ gcs: '2' }), ctx).ok).toBe(false)
  })
})

describe('ward round form', () => {
  it('needs a note and ignores pain/vitals', () => {
    expect(buildRoundInsert(painForm({ kind: 'ward', note: '' }), ctx).ok).toBe(false)
    const r = buildRoundInsert(painForm({ kind: 'ward', note: 'Comfortable', spo2: '97', pain_rest: 5 }), ctx)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toMatchObject({ kind: 'ward', pain_rest: null, spo2: null, note: 'Comfortable' })
  })
})

describe('patient form', () => {
  const ok = () => ({ ...emptyPatientForm(), full_name: ' Test Patient ', bht: 'TEST/1', age: '61', sex: 'M' })
  it('accepts a minimal patient and trims', () => {
    const r = buildPatient(ok())
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.patient).toMatchObject({ full_name: 'Test Patient', bht: 'TEST/1', age: 61, sex: 'M', ward: '7A', category: 'Surgery' })
  })
  it('requires name and BHT', () => {
    const r = buildPatient({ ...emptyPatientForm() })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(expect.arrayContaining(['full_name', 'bht']))
  })
  it('rejects impossible ages', () => {
    for (const age of ['200', '-1', 'abc', '6.5']) expect(buildPatient({ ...ok(), age }).ok).toBe(false)
  })
  it('needs an epidural level when an epidural is switched on, and clears details when switched off', () => {
    expect(buildPatient({ ...ok(), has_epidural: true }).ok).toBe(false)
    const off = buildPatient({ ...ok(), has_epidural: false, ep_level: 'T11-T12', ep_test_dose: 'x' })
    expect(off.ok && off.value.patient.ep_level).toBeNull()
  })
  it('keeps medications in order and drops top-up for single dosing', () => {
    const a = { ...newMedRow(), dose: '1 g' }
    const b = { ...newMedRow(), drug: 'Tramadol', dosing: 'single' as const, topup: 'ignored' }
    const r = buildPatient({ ...ok(), meds: [a, b] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.meds.map((m) => [m.drug, m.sort_order, m.topup])).toEqual([['Paracetamol', 0, null], ['Tramadol', 1, null]])
    }
  })
  it('rejects an unknown drug', () => {
    expect(buildPatient({ ...ok(), meds: [{ ...newMedRow(), drug: 'Aspirin' }] }).ok).toBe(false)
  })
})
