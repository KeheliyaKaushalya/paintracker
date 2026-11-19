import type { PatientMed } from './models'

export const isActiveMed = (m: Pick<PatientMed, 'status'>) => m.status === 'active'

/** "Every 6h", or the custom text when the frequency is "Other". */
export const medFreqLabel = (m: Pick<PatientMed, 'freq' | 'freq_custom'>) =>
  m.freq === 'Other' ? m.freq_custom || 'Other' : m.freq ?? '—'