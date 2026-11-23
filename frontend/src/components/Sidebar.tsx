import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchLastfmStatus } from '../api'
import type { LastfmStatus } from '../api'
import CozyroomMark from './CozyroomMark'
import { ROUTES } from '../routes'
import { API } from '../endpoints'
import { THEMES, getTheme, setTheme, type Theme } from '../theme'

const THEME_LABEL: Record<Theme, string> = { dark: 'Tối', light: 'Sáng', warm: 'Ấm' }
const THEME_NAME: Record<Theme, string> = { dark: 'Dark', light: 'Light', warm: 'Warm' }

const COLLAPSED_W = '56px'
const EXPANDED_W  = '220px'

export default function Sidebar() {
  const { t, i18n } = useTranslation()
  const [lfm, setLfm]           = useState<LastfmStatus | null>(null)
  const [showForm, setShowForm]  = useState(false)
  const [user, setUser]          = useState('')
  const [pass, setPass]          = useState('')
  const [err, setErr]            = useState('')
  const [busy, setBusy]          = useState(false)
  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem('sidebar-collapsed') === 'true'
  )
  const [theme, setThemeState] = useState<Theme>(getTheme)
  const passRef = useRef<HTMLInputElement>(null)

  const chooseTheme = (next: Theme) => {
    setThemeState(next)
    setTheme(next)
  }

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
    document.documentElement.style.setProperty('--sidebar-w', next ? COLLAPSED_W : EXPANDED_W)
  }

  // Sync CSS var on mount
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', collapsed ? COLLAPSED_W : EXPANDED_W)
  }, [])

  useEffect(() => {
    fetchLastfmStatus().then(setLfm).catch(() => {})
  }, [])

  const handleLogin = async () => {
    if (!user || !pass) return
    setBusy(true); setErr('')
    try {
      const r = await fetch(`${API}/lastfm/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      })
      if (!r.ok) { setErr(await r.text()); return }
      const { username } = await r.json()
      setLfm(s => s ? { ...s, connected: true, username } : s)
      setShowForm(false); setUser(''); setPass('')
    } catch { setErr(t('auth.network_error')) }
    finally { setBusy(false) }
  }

  const handleDisconnect = () => {
    fetch(`${API}/lastfm/disconnect`, { method: 'DELETE' })
      .then(() => setLfm(s => s ? { ...s, connected: false, username: '' } : s))
      .catch(() => {})
  }

  const toggleLang = () => {
    const next = i18n.language === 'vi' ? 'en' : 'vi'
    i18n.changeLanguage(next)
    localStorage.setItem('app-language', next)
  }

  return (
    <nav className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar-brand">
        <Link to={ROUTES.home} className="sidebar-brand-home" aria-label="Cozyroom">
          <CozyroomMark />
          {!collapsed && <span>Cozyroom</span>}
        </Link>
        <button
          className="sidebar-collapse-btn"
          onClick={toggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <div className="sidebar-section">
        {!collapsed && <p className="sidebar-label">{t('nav.library')}</p>}
        <NavLink to={ROUTES.discover} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.discover')}>
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <polygon points="13.6 6.4 11 11 6.4 13.6 9 9" fill="currentColor" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">{t('nav.discover')}</span>}
        </NavLink>
        <NavLink to={ROUTES.videos} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.films')}>
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <rect x="2" y="6" width="16" height="11" rx="1.5" fill="currentColor" />
              <path d="M2 6l2-4h3l-2 4zM8 6l2-4h3l-2 4zM14 6l1.5-4h2.5l-2 4z" fill="var(--bg)" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">{t('nav.films')}</span>}
        </NavLink>
        <NavLink to={ROUTES.ebooks} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.ebooks')}>
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path d="M2 4c2-1 5-1 8 1v11c-3-2-6-2-8-1z" fill="currentColor" />
              <path d="M18 4c-2-1-5-1-8 1v11c3-2 6-2 8-1z" fill="currentColor" opacity="0.6" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">{t('nav.ebooks')}</span>}
        </NavLink>
        <NavLink to={ROUTES.comics} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.comics')}>
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <rect x="2" y="3" width="16" height="11" rx="2" fill="currentColor" />
              <path d="M6 14l-2 3 4-3z" fill="currentColor" />
              <circle cx="7" cy="8.5" r="1.3" fill="var(--bg)" />
              <circle cx="10" cy="8.5" r="1.3" fill="var(--bg)" />
              <circle cx="13" cy="8.5" r="1.3" fill="var(--bg)" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">{t('nav.comics')}</span>}
        </NavLink>
        <NavLink to={ROUTES.trending} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.trending')}>
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path d="M2 15l5-5 3 3 6-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 6h4v4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">{t('nav.trending')}</span>}
        </NavLink>
        <NavLink to={ROUTES.playlists} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.playlists', { defaultValue: 'Playlists' })}>
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <circle cx="5" cy="15" r="2.5" fill="currentColor" />
              <circle cx="14" cy="13" r="2.5" fill="currentColor" />
              <path d="M7.5 15V4l9-2v9" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">{t('nav.playlists', { defaultValue: 'Playlists' })}</span>}
        </NavLink>
        <NavLink to={ROUTES.notes} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title="Notes">
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <rect x="3" y="2" width="14" height="16" rx="1.5" fill="currentColor" />
              <rect x="5.5" y="0" width="2" height="4" rx="1" fill="currentColor" />
              <rect x="12.5" y="0" width="2" height="4" rx="1" fill="currentColor" />
              <path d="M6 7h8M6 10h8M6 13h5" stroke="var(--bg)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">Notes</span>}
        </NavLink>
        <NavLink to={ROUTES.ai} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.ai')}>
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v5A2.5 2.5 0 0 1 14.5 13H8l-3.5 3v-3H5.5A2.5 2.5 0 0 1 3 10.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="7" cy="8" r="1" fill="currentColor" />
              <circle cx="10" cy="8" r="1" fill="currentColor" />
              <circle cx="13" cy="8" r="1" fill="currentColor" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">{t('nav.ai')}</span>}
        </NavLink>
        <NavLink to={ROUTES.musicStats} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title="Số liệu nghe nhạc">
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <rect x="2" y="10" width="3.5" height="8" rx="1" fill="currentColor" />
              <rect x="8.2" y="5" width="3.5" height="13" rx="1" fill="currentColor" />
              <rect x="14.4" y="8" width="3.5" height="10" rx="1" fill="currentColor" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">Số liệu nghe</span>}
        </NavLink>
        <NavLink to={ROUTES.debug} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title="Request Log">
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <circle cx="10" cy="10" r="2" fill="currentColor" />
              <circle cx="10" cy="10" r="5" stroke="currentColor" strokeWidth="1.3" fill="none" opacity="0.55" />
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.3" fill="none" opacity="0.3" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">Request Log</span>}
        </NavLink>
      </div>

      {lfm?.configured && (
        <div className="sidebar-lastfm">
          {lfm.connected ? (
            <>
              <span className="sidebar-lastfm-user">
                <span className="sidebar-lastfm-dot" />
                {lfm.username}
              </span>
              <button className="sidebar-lastfm-btn" onClick={handleDisconnect}>{t('auth.disconnect')}</button>
            </>
          ) : showForm ? (
            <div className="sidebar-lastfm-form">
              <input
                className="sidebar-lastfm-input"
                placeholder={t('auth.username')}
                value={user}
                onChange={e => setUser(e.target.value)}
                onKeyDown={e => e.key === 'Tab' && (e.preventDefault(), passRef.current?.focus())}
                autoFocus
              />
              <input
                ref={passRef}
                className="sidebar-lastfm-input"
                type="password"
                placeholder={t('auth.password')}
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
              {err && <span className="sidebar-lastfm-err">{err}</span>}
              <div className="sidebar-lastfm-actions">
                <button className="sidebar-lastfm-btn sidebar-lastfm-btn--connect" onClick={handleLogin} disabled={busy}>
                  {busy ? '…' : t('auth.login')}
                </button>
                <button className="sidebar-lastfm-btn" onClick={() => { setShowForm(false); setErr('') }}>{t('auth.cancel')}</button>
              </div>
            </div>
          ) : (
            <button className="sidebar-lastfm-btn sidebar-lastfm-btn--connect" onClick={() => setShowForm(true)}>
              {t('auth.connect_lastfm')}
            </button>
          )}
        </div>
      )}

      <div className="sidebar-toggles">
        {/* One radio group: a click picks THAT theme at once (no stepping through the others). The collapsed rail shows one icon that cycles. */}
        <div className="lang-toggle" role="radiogroup" aria-label="Giao diện" onClick={collapsed ? () => chooseTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]) : undefined}
          title={collapsed ? `Giao diện: ${THEME_LABEL[theme]} → ${THEME_LABEL[THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]]}` : undefined}>
          <span className="toggle-icon" aria-hidden="true">
            {theme === 'dark'
              ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              : theme === 'warm'
              ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c1 3.5 5.5 5.5 5.5 10.2A5.5 5.5 0 0 1 12 19a5.5 5.5 0 0 1-5.5-5.8c0-2 1-3.4 2.2-4.6.3 1.4 1 2.2 1.8 2.6C10.2 8.2 10.5 5.5 12 3z"/></svg>
              : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>}
          </span>
          {THEMES.map((th, i) => (
            <Fragment key={th}>
              {i > 0 && <span className="lang-sep" aria-hidden="true">·</span>}
              <button type="button" role="radio" aria-checked={theme === th} className={theme === th ? 'lang-opt lang-opt--active' : 'lang-opt'}
                onClick={e => { e.stopPropagation(); chooseTheme(th) }}>{THEME_NAME[th]}</button>
            </Fragment>
          ))}
        </div>

        <div className="lang-toggle" onClick={toggleLang} title={i18n.language === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}>
          <span className="toggle-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </span>
          <span className={i18n.language === 'vi' ? 'lang-opt lang-opt--active' : 'lang-opt'}>VI</span>
          <span className="lang-sep">·</span>
          <span className={i18n.language === 'en' ? 'lang-opt lang-opt--active' : 'lang-opt'}>EN</span>
        </div>
      </div>
    </nav>
  )
}
