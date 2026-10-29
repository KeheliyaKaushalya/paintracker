import Dexie, { type Table } from 'dexie'
import type { RoundInsert } from './models'

/** A round that could not be sent yet. Only ever holds ids and clinical values, never names. */
export interface OutboxItem {
  id?: number
  userId: string // only this user's session may send it (it is signed with their id)
  payload: RoundInsert
  createdAt: number
  tries: number
  lastError?: string
}

class AppDB extends Dexie {
  outbox!: Table<OutboxItem, number>
  constructor() {
    super('paintracker')
    this.version(1).stores({ outbox: '++id, userId, createdAt' })
  }
}

export const db = new AppDB()
