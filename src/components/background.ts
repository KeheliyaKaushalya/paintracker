import { useQueryClient } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { useToast } from './Toast'
import { db } from '../lib/db'
import { supabase } from '../lib/supabase'
import { flushOutbox } from '../features/rounds/outbox'

/** Live updates: when anyone changes a patient or round, refresh what is on screen. */
export function useRealtimeSync(enabled: boolean) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    let timer: number | undefined
    const refresh = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'profiles' }), 300)
    }
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_meds' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_alerts' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, refresh)
      .subscribe()
    // Phones pause connections in the background: catch up when the app comes back.
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [enabled, qc])
}

export function useOutboxItems(userId: string | undefined) {
  return useLiveQuery(() => (userId ? db.outbox.where('userId').equals(userId).sortBy('createdAt') : []), [userId]) ?? []
}

/** Sends rounds saved while offline: on start, when the connection returns, when the app is reopened, and every 10 s while any are waiting. */
export function useOutboxFlusher(userId: string | undefined) {
  const qc = useQueryClient()
  const toast = useToast()
  const items = useOutboxItems(userId)
  const waiting = items.length

  useEffect(() => {
    if (!userId) return
    const run = async () => {
      try {
        const sent = await flushOutbox(userId)
        if (sent > 0) {
          toast(sent === 1 ? '1 saved round was sent' : `${sent} saved rounds were sent`)
          void qc.invalidateQueries()
        }
      } catch {
        // network not ready yet; the timer will try again
      }
    }
    void run()
    const onOnline = () => void run()
    const onVisible = () => { if (document.visibilityState === 'visible') void run() }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    const timer = waiting > 0 ? window.setInterval(() => void run(), 10_000) : undefined
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [userId, waiting > 0, qc, toast]) // eslint-disable-line react-hooks/exhaustive-deps
}