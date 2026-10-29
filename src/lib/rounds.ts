import type { Round } from './models'

const defaultTime = (r: Round) => (r.round_time ? r.round_time.slice(0, 5) : r.session === 'Evening' ? '18:00' : '08:00')

/** Sort key: date, then time (or a default for the session), then when it was entered. */
export function roundKey(r: Round): string {
  return `${r.round_date} ${defaultTime(r)} ${r.created_at}`
}

export const newestFirst = (a: Round, b: Round) => (roundKey(a) < roundKey(b) ? 1 : -1)
export const oldestFirst = (a: Round, b: Round) => (roundKey(a) < roundKey(b) ? -1 : 1)

/** A correction points at the round it replaces. Hide the replaced ones. */
export function effectiveRounds(all: Round[]): Round[] {
  const replaced = new Set(all.map((r) => r.amended_of).filter((x): x is string => !!x))
  return all.filter((r) => !replaced.has(r.id))
}

/** The earlier versions of a corrected round, newest first. */
export function previousVersions(round: Round, all: Round[]): Round[] {
  const byId = new Map(all.map((r) => [r.id, r]))
  const out: Round[] = []
  let cur = round.amended_of ? byId.get(round.amended_of) : undefined
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    out.push(cur)
    seen.add(cur.id)
    cur = cur.amended_of ? byId.get(cur.amended_of) : undefined
  }
  return out
}

export function latestPainRound(all: Round[]): Round | undefined {
  return effectiveRounds(all).filter((r) => r.kind === 'pain').sort(newestFirst)[0]
}

export function latestRound(all: Round[]): Round | undefined {
  return effectiveRounds(all).sort(newestFirst)[0]
}
