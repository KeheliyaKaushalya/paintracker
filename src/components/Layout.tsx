import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { useIdleLogout } from '../features/auth/useIdleLogout'
import { useTheme } from '../styles/useTheme'
import { useOutboxFlusher, useRealtimeSync } from './background'
import { Icon } from './Icon'
import { OutboxBanner } from './OutboxBanner'
import { UpdatePrompt } from './UpdatePrompt'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function Layout() {
  const { profile, session } = useAuth()
  const theme = useTheme()
  const location = useLocation()
  useIdleLogout()
  useRealtimeSync(true)
  useOutboxFlusher(session?.user.id)

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const isAdmin = profile?.role === 'admin'
  const onBoard = location.pathname === '/'

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="DP M&R home">
          <div className="brand-mark" aria-hidden="true">DP<br />M&amp;R</div>
          <div>
            <div className="brand-title">DP M&amp;R</div>
            <div className="brand-sub">Pain Management &amp; Record</div>
          </div>
        </Link>
        <div className="topbar-right">
          <span className="date-pill">{today}</span>
          <button className="theme-btn" onClick={theme.toggle} aria-label={theme.effective === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <Icon name={theme.effective === 'dark' ? 'sun' : 'moon'} />
          </button>
          <Link to="/profile" className="pill-btn" aria-label="Your profile">
            <Icon name="user" />
            <span>{profile?.full_name ? initials(profile.full_name) : 'Me'}</span>
          </Link>
        </div>
      </header>

      <OutboxBanner />
      {profile && !profile.full_name.trim() && !location.pathname.startsWith('/profile') && (
        <div className="banner banner-info" role="status">
          <span>Add your name so rounds show who recorded them.</span>
          <Link to="/profile" className="btn btn-outline btn-sm">Add name</Link>
        </div>
      )}
      <main id="main">
        <Outlet />
      </main>

      {onBoard && (
        <div className="fab-wrap">
          <Link to="/patients/new" className="fab" aria-label="Add patient"><Icon name="plus" /></Link>
        </div>
      )}

      <nav className="bottomnav" aria-label="Main">
        <NavLink to="/" end className={({ isActive }) => `navbtn ${isActive ? 'active' : ''}`}><Icon name="board" />Board</NavLink>
        <NavLink to="/discharged" className={({ isActive }) => `navbtn ${isActive ? 'active' : ''}`}><Icon name="archive" />Discharged</NavLink>
        {isAdmin && <NavLink to="/team" className={({ isActive }) => `navbtn ${isActive ? 'active' : ''}`}><Icon name="users" />Team</NavLink>}
      </nav>
      <UpdatePrompt />
    </>
  )
}
