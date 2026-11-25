import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ROUTES, isRoute } from '../routes'

export default function Header() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Search the CURRENT tab's own content instead of always jumping to the music
  // search. Each list page reads ?q= and filters its own list; music is default.
  const ctx =
    isRoute(pathname, ROUTES.ebooks) ? { path: ROUTES.ebooks, label: t('nav.ebooks') } :
    isRoute(pathname, ROUTES.comics) ? { path: ROUTES.comics, label: t('nav.comics') } :
    isRoute(pathname, ROUTES.videos) || isRoute(pathname, ROUTES.video) ? { path: ROUTES.videos, label: t('nav.films') } :
    isRoute(pathname, ROUTES.albums) ? { path: ROUTES.albums, label: t('search.albums') } :
    isRoute(pathname, ROUTES.tracks) ? { path: ROUTES.tracks, label: t('search.tracks') } :
    { path: ROUTES.search, label: '' }

  const placeholder = ctx.path === ROUTES.search ? t('search.placeholder') : `Tìm trong ${ctx.label}…`

  const go = (q: string) => {
    if (q.trim()) navigate(`${ctx.path}?q=${encodeURIComponent(q)}`, { replace: true })
    else navigate(ctx.path, { replace: true })
  }
  // Debounced while typing. Blur no longer cancels it (closing the iPhone keyboard dropped the
  // search); Enter runs it at once.
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => go(q), 300)
  }
  // The box is uncontrolled: follow ?q= when the page changes (it kept the old text on other pages).
  const urlQ = params.get('q') ?? ''
  useEffect(() => {
    const el = inputRef.current
    if (el && document.activeElement !== el) el.value = urlQ
  }, [urlQ, pathname])

  return (
    <header className="top-header">
      <div className="search-bar">
        <svg className="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input
          ref={inputRef}
          className="search-input"
          type="search"
          placeholder={placeholder}
          defaultValue={params.get('q') ?? ''}
          onChange={handleInput}
          onKeyDown={e => { if (e.key === 'Enter') { clearTimeout(timerRef.current); go(e.currentTarget.value) } }}
        />
      </div>
    </header>
  )
}
