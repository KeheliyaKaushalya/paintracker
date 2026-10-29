export interface VitalsInput {
  pain_rest?: number | null
  pain_move?: number | null
  rr?: number | null
  spo2?: number | null
  hr?: number | null
  bp_sys?: number | null
  bp_dia?: number | null
  gcs?: number | null
}

/**
 * Soft warnings: shown on the form but NEVER block saving. A real emergency value
 * must always be recordable. The thresholds are common adult reference points;
 * adjust them to your unit's own protocol.
 */
export function vitalWarnings(v: VitalsInput): string[] {
  const out: string[] = []
  const pain = Math.max(v.pain_rest ?? -1, v.pain_move ?? -1)
  if (pain >= 7) out.push('Severe pain score (7 or more)')
  if (v.spo2 != null && v.spo2 < 94) out.push(`SpO2 ${v.spo2}% is low`)
  if (v.rr != null && (v.rr < 10 || v.rr > 24)) out.push(`Respiratory rate ${v.rr} is outside 10-24`)
  if (v.hr != null && (v.hr < 50 || v.hr > 110)) out.push(`Heart rate ${v.hr} is outside 50-110`)
  if (v.bp_sys != null && (v.bp_sys < 90 || v.bp_sys > 180)) out.push(`Systolic BP ${v.bp_sys} is outside 90-180`)
  if (v.bp_sys != null && v.bp_dia != null && v.bp_dia >= v.bp_sys) out.push('Diastolic is not lower than systolic. Check the order.')
  if (v.gcs != null && v.gcs < 15) out.push(`GCS ${v.gcs} is below 15`)
  return out
}
