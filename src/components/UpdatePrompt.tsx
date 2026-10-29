import { useRegisterSW } from 'virtual:pwa-register/react'

/** Asks before updating, so a refresh never wipes a half-filled form. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div role="status" className="update-bar">
      <span>A new version is ready.</span>
      <button className="btn btn-sm" onClick={() => void updateServiceWorker(true)}>Update now</button>
    </div>
  )
}
