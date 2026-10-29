export type PainLevel = 'low' | 'mid' | 'high'

/** 0-3 mild, 4-6 moderate, 7-10 severe. */
export function painLevel(n: number): PainLevel {
  if (n >= 7) return 'high'
  if (n >= 4) return 'mid'
  return 'low'
}

/** Words as well as colour, so severity never depends on colour alone. */
export function painWord(n: number): string {
  return { low: 'Mild', mid: 'Moderate', high: 'Severe' }[painLevel(n)]
}
