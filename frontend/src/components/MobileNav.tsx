import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const IconHome = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </svg>
)
const IconSearch = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </svg>
)
const IconVideo = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
  </svg>
)
const IconBook = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
  </svg>
)
const IconComics = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
  </svg>
)
const IconTrending = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
  </svg>
)
const IconPlaylist = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M4 10h12v2H4zm0-4h12v2H4zm0 8h8v2H4zm10 0v6l5-3z"/>
  </svg>
)
const IconAI = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2m0 8a5 5 0 0 0-5 5v3h10v-3a5 5 0 0 0-5-5m-2 6a1 1 0 0 1-1-1 1 1 0 0 1 1-1 1 1 0 0 1 1 1 1 1 0 0 1-1 1m4 0a1 1 0 0 1-1-1 1 1 0 0 1 1-1 1 1 0 0 1 1 1 1 1 0 0 1-1 1z"/>
  </svg>
)

const btn = ({ isActive }: { isActive: boolean }) => 'mobile-nav-btn' + (isActive ? ' active' : '')

export default function MobileNav() {
  const { t } = useTranslation()
  return (
    <nav className="mobile-nav">
      <NavLink to="/" end className={btn} title={t('nav.home')}><IconHome /></NavLink>
      <NavLink to="/search" className={btn} title={t('nav.search')}><IconSearch /></NavLink>
      <NavLink to="/videos" className={btn} title={t('nav.films')}><IconVideo /></NavLink>
      <NavLink to="/ebooks" className={btn} title={t('nav.books')}><IconBook /></NavLink>
      <NavLink to="/comics" className={btn} title={t('nav.comics')}><IconComics /></NavLink>
      <NavLink to="/trending" className={btn} title={t('nav.trending')}><IconTrending /></NavLink>
      <NavLink to="/playlists" className={btn} title={t('nav.playlists', { defaultValue: 'Playlists' })}><IconPlaylist /></NavLink>
      <NavLink to="/ai" className={btn} title={t('nav.ai')}><IconAI /></NavLink>
    </nav>
  )
}
