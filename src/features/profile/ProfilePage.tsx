import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/Toast'
import { updateProfile } from '../patients/api'
import { supabase } from '../../lib/supabase'
import { MIN_PASSWORD_LENGTH } from '../../lib/constants'
import { InstallPrompt } from '../../components/InstallPrompt'
import { useOutboxItems } from '../../components/background'
import { ConfirmDialog, Segmented } from '../../components/ui'
import { APP_VERSION } from '../../lib/constants'
import { useTheme, type ThemePref } from '../../styles/useTheme'
import { useAuth } from '../auth/AuthProvider'

export function ProfilePage() {
  const { profile, session, signOut, refreshProfile } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const theme = useTheme()
  const waiting = useOutboxItems(session?.user.id).length
  const [confirm, setConfirm] = useState(false)

  async function changePassword() {
    setPwError(null)
    if (pw.length < MIN_PASSWORD_LENGTH) return setPwError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    if (pw !== pw2) return setPwError('The two passwords do not match.')
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwBusy(false)
    if (error) return setPwError(error.message)
    setPw('')
    setPw2('')
    toast('Password changed')
  }

  async function saveName() {
    if (!profile) return
    setSavingName(true)
    try {
      await updateProfile(profile.id, { full_name: name.trim() })
      await refreshProfile()
      await qc.invalidateQueries({ queryKey: ['profiles'] })
      toast('Name saved')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save your name', 'error')
    } finally {
      setSavingName(false)
    }
  }

  return (
    <div className="stack">
      <h1>Your profile</h1>
      <div className="card stack">
        <span className="muted">{session?.user.email} · Role: {profile?.role}</span>
        <div className="field">
          <label htmlFor="my-name">Your name (shown as "Recorded by")</label>
          <input id="my-name" className="input" autoComplete="name" autoCapitalize="words" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. A. Silva" />
        </div>
        <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} disabled={savingName || !name.trim() || name.trim() === profile?.full_name} onClick={() => void saveName()}>
          {savingName ? 'Saving…' : 'Save name'}
        </button>
      </div>

      <div className="card stack">
        <h2>Change password</h2>
        <div className="field">
          <label htmlFor="pw1">New password</label>
          <input id="pw1" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw2">Type it again</label>
          <input id="pw2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        <span className="hint">At least {MIN_PASSWORD_LENGTH} characters. A few random words is a good password.</span>
        {pwError && <div className="error-box" role="alert">{pwError}</div>}
        <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} disabled={pwBusy || !pw} onClick={() => void changePassword()}>
          {pwBusy ? 'Saving…' : 'Change password'}
        </button>
      </div>

      <div className="card stack">
        <h2>Appearance</h2>
        <Segmented<ThemePref>
          label="Appearance"
          value={theme.pref}
          onChange={theme.set}
          options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
        />
        <span className="hint">Saved on this device only. System follows your phone's setting.</span>
      </div>

      <div className="card stack-s">
        <h2>Install</h2>
        <InstallPrompt />
      </div>

      <button className="btn btn-outline btn-block" onClick={() => (waiting > 0 ? setConfirm(true) : void signOut())}>Sign out</button>
      <p className="faint">DP M&amp;R · version {APP_VERSION}</p>

      {confirm && (
        <ConfirmDialog
          title="Sign out with unsent entries?"
          message={`${waiting} ${waiting === 1 ? 'entry has' : 'entries have'} not been sent yet. They stay saved on this device and send the next time you sign in on it.`}
          confirmLabel="Sign out anyway" danger
          onCancel={() => setConfirm(false)}
          onConfirm={() => void signOut()}
        />
      )}
    </div>
  )
}
