import { useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

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
    pathname.startsWith('/ebooks') ? { path: '/ebooks', label: t('nav.ebooks') } :
    pathname.startsWith('/comics') ? { path: '/comics', label: t('nav.comics') } :
    pathname.startsWith('/videos') || pathname.startsWith('/video/') ? { path: '/videos', label: t('nav.films') } :
    pathname.startsWith('/albums') ? { path: '/albums', label: t('search.albums') } :
    pathname.startsWith('/tracks') ? { path: '/tracks', label: t('search.tracks') } :
    { path: '/search', label: '' }

  const placeholder = ctx.path === '/search' ? t('search.placeholder') : `Tìm trong ${ctx.label}…`

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
