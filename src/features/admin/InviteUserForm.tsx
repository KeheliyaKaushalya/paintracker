import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '../../components/Toast'
import { Field } from '../../components/ui'
import { ROLES } from '../../lib/constants'
import type { Role } from '../../lib/models'
import { inviteUser } from '../patients/api'

export function InviteUserForm() {
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('nurse')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!name.trim()) { setError('Enter the full name'); return }
    if (!email.trim()) { setError('Enter the email address'); return }
    setBusy(true)
    try {
      await inviteUser({ email: email.trim(), full_name: name.trim(), role })
      await qc.invalidateQueries({ queryKey: ['profiles'] })
      toast(`Invite sent to ${email.trim()}`)
      setName(''); setEmail(''); setRole('nurse'); setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the invite')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return <button className="btn btn-primary" onClick={() => setOpen(true)}>Invite new user</button>
  }

  return (
    <div className="card stack">
      <h2>Invite new user</h2>
      <Field id="iu-name" label="Full name">
        <input id="iu-name" className="input" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field id="iu-email" label="Email">
        <input id="iu-email" className="input" type="email" inputMode="email" autoCapitalize="off" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field id="iu-role" label="Role" hint="They can sign in as soon as they set a password. No further approval is needed.">
        <select id="iu-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      {error && <div className="error-box" role="alert">{error}</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={() => void submit()} disabled={busy}>{busy ? 'Sending…' : 'Send invite'}</button>
      </div>
    </div>
  )
}