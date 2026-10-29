import { useEffect } from 'react'
import { IDLE_LOGOUT_MS } from '../../lib/constants'
import { useAuth } from './AuthProvider'

/**
 * Signs out after a period without use. Phones get locked and left on desks, so time spent
 * in the background counts too (timers are paused while a phone sleeps).
 */
export function useIdleLogout(ms: number = IDLE_LOGOUT_MS) {
  const { signOut } = useAuth()
  useEffect(() => {
    let last = Date.now()
    const touch = () => { last = Date.now() }
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))

    const check = () => {
      if (Date.now() - last >= ms) void signOut()
    }
    const timer = window.setInterval(check, 15_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch))
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ms, signOut])
}
