import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchLastfmStatus } from '../api'
import type { LastfmStatus } from '../api'
import CozyroomMark from './CozyroomMark'

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
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    localStorage.getItem('cozyroom-theme') === 'light' ? 'light' : 'dark'
  )
  const passRef = useRef<HTMLInputElement>(null)

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('cozyroom-theme', next)
    if (next === 'light') document.documentElement.setAttribute('data-theme', 'light')
    else document.documentElement.removeAttribute('data-theme')
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
      const r = await fetch('/api/lastfm/login', {
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
    fetch('/api/lastfm/disconnect', { method: 'DELETE' })
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
        <CozyroomMark />
        {!collapsed && <span>Cozyroom</span>}
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
        <NavLink to="/" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.artists')}>
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <rect x="7" y="2" width="6" height="10" rx="3" fill="currentColor" />
              <path d="M4 9a6 6 0 0 0 12 0" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              <rect x="9" y="15" width="2" height="3" rx="1" fill="currentColor" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">{t('nav.artists')}</span>}
        </NavLink>
        <NavLink to="/videos" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.films')}>
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <rect x="2" y="6" width="16" height="11" rx="1.5" fill="currentColor" />
              <path d="M2 6l2-4h3l-2 4zM8 6l2-4h3l-2 4zM14 6l1.5-4h2.5l-2 4z" fill="var(--bg)" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">{t('nav.films')}</span>}
        </NavLink>
        <NavLink to="/ebooks" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.ebooks')}>
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path d="M2 4c2-1 5-1 8 1v11c-3-2-6-2-8-1z" fill="currentColor" />
              <path d="M18 4c-2-1-5-1-8 1v11c3-2 6-2 8-1z" fill="currentColor" opacity="0.6" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">{t('nav.ebooks')}</span>}
        </NavLink>
        <NavLink to="/comics" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.comics')}>
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
        <NavLink to="/trending" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.trending')}>
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path d="M2 15l5-5 3 3 6-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 6h4v4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">{t('nav.trending')}</span>}
        </NavLink>
        <NavLink to="/playlists" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.playlists', { defaultValue: 'Playlists' })}>
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <circle cx="5" cy="15" r="2.5" fill="currentColor" />
              <circle cx="14" cy="13" r="2.5" fill="currentColor" />
              <path d="M7.5 15V4l9-2v9" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">{t('nav.playlists', { defaultValue: 'Playlists' })}</span>}
        </NavLink>
        <NavLink to="/notes" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title="Notes">
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
        <NavLink to="/ai" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.ai')}>
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path d="M10 1l1.8 5.2L17 8l-5.2 1.8L10 15l-1.8-5.2L3 8l5.2-1.8z" fill="currentColor" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">{t('nav.ai')}</span>}
        </NavLink>
        <NavLink to="/stats/music" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title="Số liệu nghe nhạc">
          <span className="nav-link-icon">
            <svg viewBox="0 0 20 20" width="18" height="18">
              <rect x="2" y="10" width="3.5" height="8" rx="1" fill="currentColor" />
              <rect x="8.2" y="5" width="3.5" height="13" rx="1" fill="currentColor" />
              <rect x="14.4" y="8" width="3.5" height="10" rx="1" fill="currentColor" />
            </svg>
          </span>
          {!collapsed && <span className="nav-link-text">Số liệu nghe</span>}
        </NavLink>
        <NavLink to="/debug" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title="Request Log">
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
        <div className="lang-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
          <span className="toggle-icon" aria-hidden="true">
            {theme === 'dark'
              ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>}
          </span>
          <span className={theme === 'dark' ? 'lang-opt lang-opt--active' : 'lang-opt'}>Dark</span>
          <span className="lang-sep">·</span>
          <span className={theme === 'light' ? 'lang-opt lang-opt--active' : 'lang-opt'}>Light</span>
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
