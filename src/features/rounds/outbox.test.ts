import { beforeEach, describe, expect, it, vi } from 'vitest'

const insert = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ insert }) },
}))

import { db } from '../../lib/db'
import type { RoundInsert } from '../../lib/models'
import { flushOutbox, saveRound } from './outbox'

const round = (n: number): RoundInsert => ({
  id: `00000000-0000-4000-8000-00000000000${n}`, patient_id: '00000000-0000-4000-8000-0000000000b1',
  kind: 'pain', round_date: '2026-10-20', pain_rest: n, pain_move: n,
})
const offline = { error: { message: 'TypeError: Failed to fetch', code: '' } }
const refused = { error: { message: 'new row violates check constraint', code: '23514' } }
const ok = { error: null }

beforeEach(async () => {
  insert.mockReset()
  await db.outbox.clear()
})

describe('saving a round', () => {
  it('saves straight away when online', async () => {
    insert.mockResolvedValue(ok)
    expect(await saveRound(round(1), 'u1')).toBe('saved')
    expect(await db.outbox.count()).toBe(0)
  })
  it('keeps it on the device when the network is down', async () => {
    insert.mockResolvedValue(offline)
    expect(await saveRound(round(1), 'u1')).toBe('queued')
    expect(await db.outbox.count()).toBe(1)
  })
  it('treats "already saved" as success (a retry never duplicates)', async () => {
    insert.mockResolvedValue({ error: { message: 'duplicate key', code: '23505' } })
    expect(await saveRound(round(1), 'u1')).toBe('saved')
    expect(await db.outbox.count()).toBe(0)
  })
  it('shows the problem instead of queueing data the server refuses', async () => {
    insert.mockResolvedValue(refused)
    await expect(saveRound(round(1), 'u1')).rejects.toThrow(/range/i)
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('sending the queue', () => {
  it('sends in the order they were made, then empties', async () => {
    insert.mockResolvedValue(offline)
    await saveRound(round(1), 'u1')
    await saveRound(round(2), 'u1')
    insert.mockReset()
    insert.mockResolvedValue(ok)
    expect(await flushOutbox('u1')).toBe(2)
    expect(insert.mock.calls.map((c) => c[0].pain_rest)).toEqual([1, 2])
    expect(await db.outbox.count()).toBe(0)
  })
  it('stops at the first failure and keeps the rest while still offline', async () => {
    insert.mockResolvedValue(offline)
    await saveRound(round(1), 'u1')
    await saveRound(round(2), 'u1')
    insert.mockReset()
    insert.mockResolvedValue(offline)
    expect(await flushOutbox('u1')).toBe(0)
    expect(insert).toHaveBeenCalledTimes(1)
    expect(await db.outbox.count()).toBe(2)
  })
  it('flags (and keeps) an item the server refuses, and carries on with the next', async () => {
    insert.mockResolvedValue(offline)
    await saveRound(round(1), 'u1')
    await saveRound(round(2), 'u1')
    insert.mockReset()
    insert.mockResolvedValueOnce(refused).mockResolvedValueOnce(ok)
    expect(await flushOutbox('u1')).toBe(1)
    const left = await db.outbox.toArray()
    expect(left).toHaveLength(1)
    expect(left[0].tries).toBe(1)
    expect(left[0].lastError).toBeTruthy()
  })
  it("never sends another user's items", async () => {
    insert.mockResolvedValue(offline)
    await saveRound(round(1), 'u1')
    insert.mockReset()
    insert.mockResolvedValue(ok)
    expect(await flushOutbox('u2')).toBe(0)
    expect(insert).not.toHaveBeenCalled()
    expect(await db.outbox.count()).toBe(1)
  })
})
