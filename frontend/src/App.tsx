import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { useIsFetching } from '@tanstack/react-query'
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

// Thin top bar while any query loads: the origin is slow (~165 KB/s), so a
// page can wait seconds for its data and needs a visible "loading" signal.
function LoadingBar() {
  const busy = useIsFetching() > 0
  return busy ? <div className="route-loading-bar" role="progressbar" aria-label="Đang tải dữ liệu" /> : null
}

export default function App() {
  return (
    <BrowserRouter>
      <AutoUpdateServiceWorker />
      <LoadingBar />
      <AppRoutes />
    </BrowserRouter>
  )
}
