import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field, Spinner } from '../../components/ui'
import { MIN_PASSWORD_LENGTH } from '../../lib/constants'
import { supabase } from '../../lib/supabase'

type State = 'checking' | 'ready' | 'invalid'

export function SetPasswordPage() {
  const navigate = useNavigate()
  const started = useRef(false)
  const [state, setState] = useState<State>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true
    async function init() {
      // The client has detectSessionInUrl turned off, so read the invite link ourselves.
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      if (accessToken && refreshToken) {
        const { error: e } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        window.history.replaceState(null, '', window.location.pathname)
        setState(e ? 'invalid' : 'ready')
        return
      }
      // Page refreshed after the link was already used: fine if still signed in.
      const { data } = await supabase.auth.getSession()
      setState(data.session ? 'ready' : 'invalid')
    }
    void init()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) { setError(`Use at least ${MIN_PASSWORD_LENGTH} characters`); return }
    if (password !== confirm) { setError('The two passwords do not match'); return }
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) { setError(err.message); return }
    navigate('/', { replace: true })
  }

  if (state === 'checking') return <Spinner label="Checking your invite" />

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit} noValidate>
        <h1 style={{ fontSize: 20 }}>Set your password</h1>
        {state === 'invalid' ? (
          <div className="error-box" role="alert">
            This invite link is invalid or has expired. Ask an administrator to send a new one.
          </div>
        ) : (
          <>
            <Field id="sp-pw" label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters`}>
              <input id="sp-pw" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field id="sp-pw2" label="Confirm password">
              <input id="sp-pw2" className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            {error && <div className="error-box" role="alert">{error}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy || !password || !confirm}>
              {busy ? 'Saving…' : 'Save password'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}