import { db } from '../../lib/db'
import { isNetworkError, toError } from '../../lib/errors'
import type { RoundInsert } from '../../lib/models'
import { supabase } from '../../lib/supabase'

export type SaveResult = 'saved' | 'queued'

/**
 * Save a round. If the server can't be reached, keep it on this device and send it later.
 * The round's id is created on the device, so a retry can never make a duplicate.
 */
export async function saveRound(round: RoundInsert, userId: string): Promise<SaveResult> {
  const { error } = await supabase.from('rounds').insert(round)
  if (!error || error.code === '23505') return 'saved' // 23505 = this exact round was already saved
  if (isNetworkError(error)) {
    await db.outbox.add({ userId, payload: round, createdAt: Date.now(), tries: 0 })
    return 'queued'
  }
  throw toError(error)
}

let flushing = false

/** Try to send everything waiting for this user. Returns how many were sent. */
export async function flushOutbox(userId: string): Promise<number> {
  if (flushing) return 0
  flushing = true
  try {
    const items = await db.outbox.where('userId').equals(userId).sortBy('createdAt')
    let sent = 0
    for (const it of items) {
      const { error } = await supabase.from('rounds').insert(it.payload)
      if (!error || error.code === '23505') {
        await db.outbox.delete(it.id!)
        sent++
        continue
      }
      if (isNetworkError(error)) break // still offline: stop and try again later
      // The server answered but refused it (bad data or no permission): keep it and flag it.
      await db.outbox.update(it.id!, { tries: it.tries + 1, lastError: toError(error).message })
    }
    return sent
  } finally {
    flushing = false
  }
}

export async function discardOutboxItem(id: number): Promise<void> {
  await db.outbox.delete(id)
}
