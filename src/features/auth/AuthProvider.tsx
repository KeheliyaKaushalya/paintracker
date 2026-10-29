import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Profile } from '../../lib/models'
import { supabase } from '../../lib/supabase'

interface AuthState {
  loading: boolean
  session: Session | null
  profile: Profile | null
  profileError: string | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const userId = session?.user.id ?? null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const load = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      return
    }
    setProfileLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfileLoading(false)
    if (error) setProfileError("Couldn't load your account. Check your connection and try again.")
    else {
      setProfileError(null)
      setProfile((data as Profile | null) ?? null)
    }
  }, [userId])

  useEffect(() => {
    // loading the profile after the session is known (never inside the auth callback itself)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  // Re-check the account every 2 minutes and whenever the app is reopened, so approval,
  // deactivation and role changes show up without signing in again.
  useEffect(() => {
    if (!userId) return
    const timer = window.setInterval(() => void load(), 120_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [userId, load])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ loading: sessionLoading || (!!userId && profileLoading && !profile), session, profile, profileError, refreshProfile: load, signOut }),
    [sessionLoading, userId, profileLoading, profile, session, profileError, load, signOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
