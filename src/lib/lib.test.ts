import { describe, expect, it } from 'vitest'
import { formatBp, parseBp } from './bp'
import { computePOD, daysBetween, fmtDate, hhmm, todayISO, toUnixSeconds } from './dates'
import { friendlyMessage, isNetworkError } from './errors'
import { painLevel, painWord } from './pain'
import { effectiveRounds, latestPainRound, previousVersions } from './rounds'
import type { Round } from './models'
import { vitalWarnings } from './vitals'

const round = (over: Partial<Round>): Round => ({
  id: 'r', patient_id: 'p', kind: 'pain', round_date: '2026-10-20', round_time: '08:00:00', session: 'Morning',
  pain_rest: 2, pain_move: 4, rr: null, spo2: null, hr: null, bp_sys: null, bp_dia: null, gcs: null,
  mobilization: null, tags: [], note: null, amended_of: null, created_by: 'u', created_at: '2026-10-20T02:00:00Z', ...over,
})

describe('blood pressure', () => {
  it('parses 120/80 and tolerates spaces', () => {
    expect(parseBp('120/80')).toEqual({ sys: 120, dia: 80 })
    expect(parseBp(' 95 / 60 ')).toEqual({ sys: 95, dia: 60 })
  })
  it('rejects things that are not blood pressure', () => {
    for (const bad of ['', '120', '120-80', 'abc', '1/2', '1200/80']) expect(parseBp(bad)).toBeNull()
  })
  it('formats back', () => {
    expect(formatBp(120, 80)).toBe('120/80')
    expect(formatBp(null, null)).toBe('')
  })
})

describe('pain levels', () => {
  it('splits 0-3 / 4-6 / 7-10', () => {
    expect([0, 3, 4, 6, 7, 10].map(painLevel)).toEqual(['low', 'low', 'mid', 'mid', 'high', 'high'])
  })
  it('always has a word, not just a colour', () => {
    expect(painWord(8)).toBe('Severe')
  })
})

describe('vital warnings are soft', () => {
  it('is quiet for normal values', () => {
    expect(vitalWarnings({ pain_rest: 2, pain_move: 4, spo2: 98, hr: 80, rr: 16, bp_sys: 120, bp_dia: 80, gcs: 15 })).toEqual([])
  })
  it('flags low SpO2, severe pain and odd BP order', () => {
    const w = vitalWarnings({ pain_move: 8, spo2: 90, bp_sys: 80, bp_dia: 90 })
    expect(w.join(' ')).toMatch(/Severe pain/)
    expect(w.join(' ')).toMatch(/SpO2 90/)
    expect(w.join(' ')).toMatch(/Diastolic/)
  })
})

describe('dates', () => {
  it('uses LOCAL date, not UTC', () => {
    expect(todayISO(new Date(2026, 9, 20, 23, 59))).toBe('2026-10-20')
    expect(todayISO(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05')
  })
  it('counts post-operative days', () => {
    expect(computePOD('2026-10-17', '2026-10-20')).toBe(3)
    expect(computePOD('2026-10-20', '2026-10-20')).toBe(0)
    expect(computePOD('2026-10-25', '2026-10-20')).toBeNull()
    expect(computePOD(null)).toBeNull()
  })
  it('handles month boundaries', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3)
  })
  it('formats', () => {
    expect(fmtDate('2026-10-20')).toBe('20 Oct')
    expect(hhmm('08:05:00')).toBe('08:05')
  })
  it('turns date + time into chart seconds, with session defaults', () => {
    const a = toUnixSeconds('2026-10-20', '08:00:00')
    expect(toUnixSeconds('2026-10-20', null, 'Morning')).toBe(a)
    expect(toUnixSeconds('2026-10-20', null, 'Evening')).toBeGreaterThan(a)
  })
})

describe('error messages', () => {
  it('recognises a dead network and database refusals', () => {
    expect(isNetworkError({ message: 'TypeError: Failed to fetch', code: '' })).toBe(true)
    expect(isNetworkError({ message: 'permission denied', code: '42501' })).toBe(false)
    expect(friendlyMessage({ code: '42501' })).toMatch(/permission/)
    expect(friendlyMessage({ code: '23505', message: 'duplicate key value violates unique constraint "patients_bht_unique"' })).toMatch(/BHT/)
  })
})

describe('amended rounds', () => {
  const a = round({ id: 'a', created_at: '2026-10-20T01:00:00Z' })
  const b = round({ id: 'b', amended_of: 'a', pain_rest: 3, created_at: '2026-10-20T02:00:00Z' })
  const c = round({ id: 'c', amended_of: 'b', pain_rest: 4, created_at: '2026-10-20T03:00:00Z' })
  const other = round({ id: 'd', round_date: '2026-10-19' })
  it('hides rounds that were replaced', () => {
    expect(effectiveRounds([a, b, c, other]).map((r) => r.id).sort()).toEqual(['c', 'd'])
  })
  it('lists earlier versions newest first', () => {
    expect(previousVersions(c, [a, b, c]).map((r) => r.id)).toEqual(['b', 'a'])
  })
  it('does not loop forever on a broken chain', () => {
    const x = round({ id: 'x', amended_of: 'y' })
    const y = round({ id: 'y', amended_of: 'x' })
    expect(previousVersions(x, [x, y]).length).toBeLessThanOrEqual(2)
  })
  it('finds the latest pain round and ignores ward rounds', () => {
    const ward = round({ id: 'w', kind: 'ward', round_date: '2026-10-21', pain_rest: null, pain_move: null })
    expect(latestPainRound([a, b, c, other, ward])?.id).toBe('c')
  })
})
