import type { Patient } from './models'

type CategoryFields = Pick<Patient, 'category' | 'category_note' | 'anaesthesia_mode' | 'pdph_level' | 'pdph_needle' | 'pdph_attempts' | 'pdph_condition'>

export const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/** The PDPH technique is the anaesthesia mode, but only when it is Spinal or CSE. */
export const pdphTechnique = (p: Pick<Patient, 'anaesthesia_mode'>) =>
  p.anaesthesia_mode === 'Spinal' || p.anaesthesia_mode === 'CSE' ? p.anaesthesia_mode : ''

/** The one line shown on the board card under the category tag. */
export function categoryLine(p: CategoryFields): string {
  if (p.category === 'PDPH') {
    const parts = [pdphTechnique(p), p.pdph_level, p.pdph_needle, p.pdph_attempts ? `${p.pdph_attempts} attempts` : '', p.pdph_condition]
    return trunc(parts.filter(Boolean).join(' · '), 140)
  }
  return p.category_note ?? ''
}