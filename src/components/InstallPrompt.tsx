import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

/** Android/Chrome offer a real install button; iPhone has none, so show the steps instead. */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  if (standalone) return <p className="faint">Installed on this device.</p>
  if (evt) {
    return (
      <button className="btn btn-outline" onClick={async () => { await evt.prompt(); setEvt(null) }}>
        Install app on this phone
      </button>
    )
  }
  if (isIOS) return <p className="faint">To install: tap the Share button in Safari, then "Add to Home Screen".</p>
  return <p className="faint">To install: open your browser menu and choose "Install app" or "Add to Home screen".</p>
}
