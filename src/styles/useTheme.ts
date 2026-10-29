import { useSyncExternalStore } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'dpmr-theme-v1'
const CHROME = { light: '#0A4F61', dark: '#0B3F4E' } // browser toolbar colour

const listeners = new Set<() => void>()
const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function effectiveTheme(pref: ThemePref = readPref()): 'light' | 'dark' {
  if (pref !== 'system') return pref
  return mq?.matches ? 'dark' : 'light'
}

/** Sets the data-theme attribute that tokens.css reads. Call once before React renders. */
export function applyTheme(pref: ThemePref = readPref()): void {
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME[effectiveTheme(pref)])
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    /* private mode: the choice just won't be remembered */
  }
  applyTheme(pref)
  listeners.forEach((l) => l())
}

mq?.addEventListener?.('change', () => {
  if (readPref() === 'system') applyTheme()
  listeners.forEach((l) => l())
})

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const snapshot = () => `${readPref()}|${effectiveTheme()}`

export function useTheme() {
  const [pref, effective] = useSyncExternalStore(subscribe, snapshot, () => 'system|light').split('|') as [ThemePref, 'light' | 'dark']
  return {
    pref,
    effective,
    set: setThemePref,
    toggle: () => setThemePref(effective === 'dark' ? 'light' : 'dark'),
  }
}
