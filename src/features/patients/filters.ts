import type { PatientFull } from '../../lib/models'
import { latestRound } from '../../lib/rounds'

export interface BoardFilters {
  category: string // 'All' or a category
  search: string
  ward: string // '' = all wards
  from: string // surgery date range, '' = open
  to: string
}

export const emptyFilters: BoardFilters = { category: 'All', search: '', ward: '', from: '', to: '' }

export const isUrgent = (p: PatientFull) => latestRound(p.rounds)?.tags.includes('Urgent review') ?? false

export function filterPatients(list: PatientFull[], f: BoardFilters): PatientFull[] {
  const q = f.search.trim().toLowerCase()
  return list.filter((p) => {
    if (f.category !== 'All' && p.category !== f.category) return false
    if (f.ward && p.ward !== f.ward) return false
    if (q && !p.full_name.toLowerCase().includes(q) && !p.bht.toLowerCase().includes(q)) return false
    if (f.from && (!p.surgery_date || p.surgery_date < f.from)) return false
    if (f.to && (!p.surgery_date || p.surgery_date > f.to)) return false
    return true
  })
}

/** Urgent patients first, then by ward, then by name. */
export function sortBoard(list: PatientFull[]): PatientFull[] {
  return [...list].sort((a, b) => {
    const u = Number(isUrgent(b)) - Number(isUrgent(a))
    if (u !== 0) return u
    return a.ward.localeCompare(b.ward) || a.full_name.localeCompare(b.full_name)
  })
}

export function categoryCounts(list: PatientFull[]): Record<string, number> {
  const out: Record<string, number> = { All: list.length }
  for (const p of list) out[p.category] = (out[p.category] ?? 0) + 1
  return out
}
