const pad = (n: number) => String(n).padStart(2, '0')

/** Today's date as YYYY-MM-DD in the device's local time (not UTC). */
export function todayISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function nowHHMM(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "08:05:00" -> "08:05" */
export function hhmm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : ''
}

function parseISO(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000)
}

/** Post-operative day. POD 0 is the day of surgery. Returns null when there is no surgery date. */
export function computePOD(surgeryDate: string | null | undefined, today: string = todayISO()): number | null {
  if (!surgeryDate) return null
  const n = daysBetween(surgeryDate, today)
  return n < 0 ? null : n
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10-20" -> "20 Oct" */
export function fmtDate(date: string | null | undefined): string {
  if (!date) return ''
  const d = parseISO(date)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** "2026-10-20" -> "20 Oct 2026" */
export function fmtDateLong(date: string | null | undefined): string {
  if (!date) return ''
  return `${fmtDate(date)} ${parseISO(date).getFullYear()}`
}

/** Unix seconds for a local date + time (used by the chart). */
export function toUnixSeconds(date: string, time: string | null | undefined, session?: string | null): number {
  const t = time ? hhmm(time) : session === 'Evening' ? '18:00' : '08:00'
  const [h, m] = t.split(':').map(Number)
  const d = parseISO(date)
  d.setHours(h, m, 0, 0)
  return Math.floor(d.getTime() / 1000)
}
