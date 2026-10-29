import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { discardOutboxItem, flushOutbox } from '../features/rounds/outbox'
import { useAuth } from '../features/auth/AuthProvider'
import { useOutboxItems } from './background'
import { useToast } from './Toast'
import { ConfirmDialog } from './ui'

/** Never lets an unsent entry go unnoticed. */
export function OutboxBanner() {
  const { session } = useAuth()
  const userId = session?.user.id
  const items = useOutboxItems(userId)
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [discard, setDiscard] = useState<number | null>(null)

  if (!userId || items.length === 0) return null
  const stuck = items.filter((i) => i.tries > 0)

  async function sendNow() {
    setBusy(true)
    const sent = await flushOutbox(userId!)
    setBusy(false)
    if (sent > 0) void qc.invalidateQueries()
    else toast('Still cannot reach the server. Entries stay saved on this device.', 'error')
  }

  return (
    <>
      <div className="banner banner-warn" role="status">
        <span>
          <strong>{items.length} {items.length === 1 ? 'entry' : 'entries'} not yet sent.</strong>{' '}
          {stuck.length > 0 ? 'Some were refused by the server and need attention.' : 'Saved on this device and will send when you are back online.'}
        </span>
        <button className="btn btn-outline btn-sm" onClick={() => void sendNow()} disabled={busy}>{busy ? 'Sending…' : 'Send now'}</button>
      </div>
      {stuck.map((i) => (
        <div key={i.id} className="banner banner-warn" role="alert">
          <span>Round on {i.payload.round_date} was refused: {i.lastError}</span>
          <button className="btn btn-outline btn-sm" onClick={() => setDiscard(i.id!)}>Discard</button>
        </div>
      ))}
      {discard != null && (
        <ConfirmDialog
          title="Discard this entry?"
          message="It has not been saved anywhere else. Discarding deletes it from this device permanently."
          confirmLabel="Discard" danger
          onCancel={() => setDiscard(null)}
          onConfirm={() => { void discardOutboxItem(discard); setDiscard(null) }}
        />
      )}
    </>
  )
}
