import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '../../components/ui'
import { useAuth } from './AuthProvider'

export function RequireAuth() {
  const { loading, session, profile, profileError, refreshProfile, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner label="Checking your sign-in" />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (profileError || !profile) {
    return (
      <main className="stack">
        <h1>Account problem</h1>
        <p className="muted">{profileError ?? 'Your account has no profile yet. Ask an administrator.'}</p>
        <div className="row">
          <button className="btn btn-primary" onClick={() => void refreshProfile()}>Try again</button>
          <button className="btn btn-outline" onClick={() => void signOut()}>Sign out</button>
        </div>
      </main>
    )
  }

  if (!profile.active) {
    return (
      <main className="stack" aria-live="polite">
        <h1>Waiting for approval</h1>
        <p className="muted">
          Your account ({session.user.email}) is not active. An administrator must approve it before you can see any patients.
        </p>
        <div className="row">
          <button className="btn btn-primary" onClick={() => void refreshProfile()}>Check again</button>
          <button className="btn btn-outline" onClick={() => void signOut()}>Sign out</button>
        </div>
      </main>
    )
  }
  return <Outlet />
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  if (profile?.role !== 'admin') {
    return (
      <div className="empty">
        <p style={{ fontWeight: 600, color: 'var(--ink)' }}>Administrators only</p>
        <p>You don't have access to this page.</p>
      </div>
    )
  }
  return <>{children}</>
}
