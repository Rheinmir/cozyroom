import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import './i18n/i18n'

const queryClient = new QueryClient()

// A music cover that fails to load shows a vinyl disc instead of the browser's broken-image icon.
// One capture listener covers every <img> in the app ('error' does not bubble, capture still sees it).
const VINYL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23181818'/%3E%3Ccircle cx='50' cy='50' r='40' fill='%230b0b0b'/%3E%3Cg fill='none' stroke='%23262626'%3E%3Ccircle cx='50' cy='50' r='34'/%3E%3Ccircle cx='50' cy='50' r='28'/%3E%3Ccircle cx='50' cy='50' r='22'/%3E%3C/g%3E%3Ccircle cx='50' cy='50' r='13' fill='%23444'/%3E%3Ccircle cx='50' cy='50' r='2.5' fill='%23181818'/%3E%3C/svg%3E"
const isMusicArt = (src: string) => /\/(covers|track-covers|artist-images)\/|ytimg\.com/.test(src)
document.addEventListener('error', e => {
  const img = e.target
  if (img instanceof HTMLImageElement && img.src !== VINYL && isMusicArt(img.src)) img.src = VINYL
}, true)

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
