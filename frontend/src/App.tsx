import { BrowserRouter } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import AppRoutes from './AppRoutes'

function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#7c3aed', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: '10px 16px', fontSize: 14, fontWeight: 600,
    }}>
      <span>Có phiên bản mới</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff',
          padding: '4px 14px', borderRadius: 6, fontWeight: 700,
          cursor: 'pointer', fontSize: 13,
        }}
      >Cập nhật ngay</button>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <UpdateBanner />
      <AppRoutes />
    </BrowserRouter>
  )
}
