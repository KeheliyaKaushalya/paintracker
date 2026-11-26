import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { WardsPanel, ExportsPanel, AccountTools } from './Panels'
import { ShiftTemplatesAdmin } from './ShiftTemplatesAdmin'
import { useToast } from '../../components/Toast'
import { Empty, ErrorBox, Spinner, Tag, Segmented } from '../../components/ui'
import { ROLES } from '../../lib/constants'
import type { Profile, Role } from '../../lib/models'
import { useAuth } from '../auth/AuthProvider'
import { updateProfile } from '../patients/api'
import { useProfiles } from '../patients/hooks'
import { InviteUserForm } from './InviteUserForm' // NEW

function Accounts() {
  const q = useProfiles()
  const { profile: me } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function change(p: Profile, patch: { active?: boolean; role?: Role }) {
    setBusyId(p.id)
    try {
      await updateProfile(p.id, patch)
      await qc.invalidateQueries({ queryKey: ['profiles'] })
      toast('Saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const pending = (q.data ?? []).filter((p) => !p.active)
  const active = (q.data ?? []).filter((p) => p.active)

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <InviteUserForm />
      </div>

      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => void q.refetch()} />}
      {q.data && q.data.length === 0 && <Empty title="No users yet" />}

      {pending.length > 0 && (
        <>
          <h2 className="section-title">Waiting for Approval ({pending.length})</h2>
          <div className="card">
            {pending.map((p) => (
              <div className="user-row" key={p.id}>
                <div><strong>{p.full_name || 'Unnamed user'}</strong><div className="faint mono">{p.id.slice(0, 8)}</div></div>
                <button className="btn btn-primary btn-sm" disabled={busyId === p.id} onClick={() => void change(p, { active: true })}>Approve</button>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Active users ({active.length})</h2>
      <div className="card">
        {active.map((p) => {
          const self = p.id === me?.id
          return (
            <div className="user-row" key={p.id}>
              <div>
                <strong>{p.full_name || 'Unnamed user'}</strong> {self && <Tag tone="primary">You</Tag>}
              </div>
              <div className="row">
                <label className="sr-only" htmlFor={`role-${p.id}`}>Role for {p.full_name}</label>
                <select id={`role-${p.id}`} className="input" style={{ width: 'auto' }} value={p.role} disabled={self || busyId === p.id}
                  onChange={(e) => void change(p, { role: e.target.value as Role })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button className="btn btn-outline btn-sm" disabled={self || busyId === p.id} onClick={() => void change(p, { active: false })}>Deactivate</button>
              </div>
            </div>
          )
        })}
        <p className="hint" style={{ marginTop: 8 }}>
          You can't change your own role or deactivate yourself, so there is always one admin. The moment someone is deactivated the server stops giving them any patient data, and their screen follows within about two minutes.
        </p>
      </div>
    </div>
  )
}

export function TeamPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab = requested === 'wards' || requested === 'exports' ? requested : 'team'
  return <div className="stack">
    <div className="page-head"><div><h1>Team</h1><p className="muted">Accounts, wards and exports</p></div></div>
    <Segmented<'team' | 'wards' | 'exports'> value={tab} onChange={value => setParams({tab:value})} label="Team sections" options={[{value:'team',label:'Team'},{value:'wards',label:'Wards'},{value:'exports',label:'Exports'}]} />
    {tab === 'team' && <><Accounts/><AccountTools/><ShiftTemplatesAdmin/><Link className="btn btn-outline" to="/deleted">Deleted patients</Link></>}
    {tab === 'wards' && <WardsPanel/>}
    {tab === 'exports' && <ExportsPanel/>}
  </div>
}
