// Allowed values. They MUST match the check constraints in supabase/migrations.

export const CATEGORIES = ['Surgery', 'Difficult airway', 'Anaphylaxis', 'Medical issue', 'Other'] as const
export const WARDS_DEFAULT = ['7A', '23B', '39', 'OT Complex', 'ICU', 'Other'] as const
export const SEXES = ['M', 'F'] as const
export const ANAESTHESIA_MODES = ['GA', 'Spinal', 'CSE', 'Regional'] as const
export const NERVE_TYPES = ['Supraclavicular', 'Rectus sheath', 'Femoral', 'Other'] as const
export const MED_DRUGS = [
  'Paracetamol', 'Tramadol', 'Morphine', 'Pregabalin', 'Gabapentin',
  'Celecoxib (Cox-2)', 'Diclofenac (NSAID)', 'Other',
] as const
export const MED_ROUTES = ['Oral', 'IV', 'IM', 'SC', 'PR', 'IT', 'Epidural'] as const
export const MED_FREQS = ['Every 4h', 'Every 6h', 'Every 8h', 'Every 12h', 'Other'] as const
export const MED_DOSINGS = ['single', 'loading'] as const
export const SESSIONS = ['Morning', 'Evening'] as const
export const MOBILIZATION = ['Mobilized', 'Not mobilized'] as const
export const ROUND_TAGS = [
  'Top-up given', 'Line removed', 'Dose changed', 'Catheter concern', 'Discharge planned', 'Urgent review',
] as const

export const ROLES = ['nurse', 'resident', 'consultant', 'admin'] as const

/** Epidural level suggestions for the type-ahead list (free text is also allowed). */
export const EPIDURAL_LEVELS: string[] = (() => {
  const single = [
    ...Array.from({ length: 12 }, (_, i) => `T${i + 1}`),
    ...Array.from({ length: 5 }, (_, i) => `L${i + 1}`),
  ]
  const pairs = single.slice(0, -1).map((l, i) => `${l}-${single[i + 1]}`)
  return [...pairs, ...single]
})()

/** Sign out after this long without touching the app (also counts time spent in the background). */
export const IDLE_LOGOUT_MS = 5 * 60 * 1000
export const APP_VERSION = '1.0.0'
export const MIN_PASSWORD_LENGTH = 12
