import { useRef } from 'react'
import { useNavigate, useSearchParams, useLocation, matchPath } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ROUTES } from '../routes'

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
    pathname.startsWith(ROUTES.ebooks) ? { path: ROUTES.ebooks, label: t('nav.ebooks') } :
    pathname.startsWith(ROUTES.comics) ? { path: ROUTES.comics, label: t('nav.comics') } :
    pathname.startsWith(ROUTES.videos) || matchPath({ path: ROUTES.video, end: false }, pathname) ? { path: ROUTES.videos, label: t('nav.films') } :
    pathname.startsWith(ROUTES.albums) ? { path: ROUTES.albums, label: t('search.albums') } :
    pathname.startsWith(ROUTES.tracks) ? { path: ROUTES.tracks, label: t('search.tracks') } :
    { path: ROUTES.search, label: '' }

  const placeholder = ctx.path === ROUTES.search ? t('search.placeholder') : `Tìm trong ${ctx.label}…`

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (q.trim()) navigate(`${ctx.path}?q=${encodeURIComponent(q)}`, { replace: true })
      else navigate(ctx.path, { replace: true })
    }, 300)
  }

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
          onBlur={() => clearTimeout(timerRef.current)}
        />
      </div>
    </header>
  )
}
