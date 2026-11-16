import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Which list the global search box should search: the current tab's own list
// (each of these pages reads ?q= and filters/searches itself), music otherwise.
// Shared by the desktop header island and the mobile search island so the two
// can't drift apart.
export function useSearchContext() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const ctx =
    pathname.startsWith('/ebooks') ? { path: '/ebooks', label: t('nav.ebooks') } :
    pathname.startsWith('/comics') ? { path: '/comics', label: t('nav.comics') } :
    pathname.startsWith('/videos') || pathname.startsWith('/video/') ? { path: '/videos', label: t('nav.films') } :
    pathname.startsWith('/albums') ? { path: '/albums', label: t('search.albums') } :
    pathname.startsWith('/tracks') ? { path: '/tracks', label: t('search.tracks') } :
    { path: '/search', label: '' }
  const placeholder = ctx.path === '/search' ? t('search.placeholder') : `Tìm trong ${ctx.label}…`
  return { ...ctx, placeholder }
}
