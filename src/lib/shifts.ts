import { hhmm, todayISO, toUnixSeconds } from './dates'

/** Add (or subtract) days from a YYYY-MM-DD date. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return todayISO(new Date(y, m - 1, d + n))
}

/** Start and end of a shift that begins on `date`, in unix seconds. A shift whose end is not after its start runs overnight. */
export function shiftWindow(date: string, start: string, end: string) {
  const s = hhmm(start)
  const e = hhmm(end)
  return { start: toUnixSeconds(date, s), end: toUnixSeconds(e <= s ? addDays(date, 1) : date, e) }
}

/** Shifts running right now. After midnight, a night shift still belongs to yesterday's date. */
export function currentShifts<T extends { id: string; start_time: string; end_time: string }>(
  templates: T[],
  now: number = Date.now(),
): { date: string; template: T }[] {
  const nowSec = Math.floor(now / 1000)
  const out: { date: string; template: T }[] = []
  const today = todayISO(new Date(now))
  for (const template of templates) {
    for (const date of [addDays(today, -1), today]) {
      const w = shiftWindow(date, template.start_time, template.end_time)
      if (w.start <= nowSec && nowSec < w.end) out.push({ date, template })
    }
  }
  return out
}