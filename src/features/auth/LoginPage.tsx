import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Field, Spinner } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'

export function LoginPage() {
  const { loading, session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <Spinner label="Checking your sign-in" />
  if (session) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
if (error) {
  const code = (error as { code?: string }).code
  if (/network|fetch/i.test(error.message)) {
    setError("Can't reach the server. Check your connection.")
  } else if (code === 'invalid_credentials') {
    setError('Email or password is not correct.')
  } else if (code === 'email_not_confirmed') {
    setError('This email has not been confirmed yet. Ask an administrator to confirm it.')
  } else {
    setError(`Sign-in failed: ${error.message}`)
  }
  return
}
    const from = (location.state as { from?: string } | null)?.from
    navigate(from && from !== '/login' ? from : '/', { replace: true })
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="row">
          <div className="brand-mark" style={{ background: 'var(--primary-dark)', color: '#fff' }}>DP<br />M&amp;R</div>
          <div>
            <h1 style={{ fontSize: 20 }}>DP M&amp;R</h1>
            <span className="faint">Pain management ward rounds</span>
          </div>
        </div>
        <Field id="email" label="Email">
          <input id="email" className="input" type="email" inputMode="email" autoComplete="username" autoCapitalize="off" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field id="password" label="Password">
          <input id="password" className="input" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="faint">
          There is no sign-up. Ask an administrator to invite you. Use fake patient data until your hospital has approved this system.
        </p>
      </form>
    </div>
  )
}
