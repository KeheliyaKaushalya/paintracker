/** Blood pressure is typed as "120/80" but stored as two numbers. */
export function parseBp(text: string): { sys: number; dia: number } | null {
  const m = /^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/.exec(text)
  if (!m) return null
  return { sys: Number(m[1]), dia: Number(m[2]) }
}

export function formatBp(sys: number | null | undefined, dia: number | null | undefined): string {
  return sys != null && dia != null ? `${sys}/${dia}` : ''
}
