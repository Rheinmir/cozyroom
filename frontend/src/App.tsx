import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import AppRoutes from './AppRoutes'

// vite.config.ts sets registerType: 'autoUpdate' — the whole point of that
// mode is that a new deploy activates without the user having to notice and
// click anything. Waiting on a manual banner defeated that: every deploy in
// practice meant "tell the user to find and click Cập nhật ngay," which they
// reliably forgot or didn't see, and kept debugging phantom "the fix isn't
// live" reports that were actually just stale service-worker cache. Auto-
// applying the update (skipWaiting + clientsClaim are already on in the
// workbox config, so the new SW can take over immediately) removes that
// whole failure mode — the cost is an occasional unprompted reload, which is
// an acceptable trade for a self-hosted single-owner app.
function AutoUpdateServiceWorker() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  useEffect(() => {
    if (needRefresh) updateServiceWorker(true)
  }, [needRefresh, updateServiceWorker])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AutoUpdateServiceWorker />
      <AppRoutes />
    </BrowserRouter>
  )
}
