import { useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlayer } from '../PlayerContext'
import QueueList from './QueueList'

// Mobile-only floating "search island", mirroring the media-control pill
// directly above it — the desktop/top-header search bar (Header.tsx) stays
// as-is; this is a separate mount point (grid-area: search-island) so it can
// occupy its own row in the mobile .shell grid, stacked below .player.
//
// Also hosts the queue-toggle button: the Up Next panel used to only be
// reachable from inside the fullscreen Now Playing overlay, but the queue
// island is visible on every screen, so a button here reaches it without
// opening NPO first. queueOpen/setQueueOpen live in PlayerContext (not
// local state) specifically so this button and NPO's own queue button
// toggle the same panel instance.
export default function MobileSearchBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { track, queueOpen, setQueueOpen, npoOpen } = usePlayer()
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (q.trim()) navigate(`/search?q=${encodeURIComponent(q)}`, { replace: true })
      else navigate(-1)
    }, 300)
  }

  return (
    <div className="mobile-search-island">
      {/* Skip rendering when NPO is open — it renders this exact same
          panel itself, and both are always-mounted components watching
          the same shared queueOpen, so without this guard two copies of
          .queue-panel would exist in the DOM at once (the "invisible" one
          still intercepting clicks). */}
      {queueOpen && !npoOpen && (
        <>
          <div className="queue-panel-backdrop" onClick={() => setQueueOpen(false)} />
          <div className="queue-panel">
            <QueueList />
          </div>
        </>
      )}
      {track && (
        <button
          className={'search-island-queue-btn' + (queueOpen ? ' search-island-queue-btn--active' : '')}
          onClick={() => setQueueOpen(v => !v)}
          title={t('player.queue')}
          aria-label={t('player.queue')}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M4 6h13v2H4V6zm0 5h13v2H4v-2zm0 5h9v2H4v-2zm16-8v10l-5-5 5-5z"/>
          </svg>
        </button>
      )}
      <div className="search-bar">
        <svg className="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input
          ref={inputRef}
          className="search-input"
          type="search"
          placeholder={t('search.placeholder')}
          defaultValue={params.get('q') ?? ''}
          onChange={handleInput}
          onBlur={() => clearTimeout(timerRef.current)}
        />
      </div>
    </div>
  )
}
