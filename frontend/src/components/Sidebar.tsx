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
  const passRef = useRef<HTMLInputElement>(null)

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
          <span className="nav-link-icon">🏠</span>
          {!collapsed && <span className="nav-link-text">{t('nav.artists')}</span>}
        </NavLink>
        <NavLink to="/videos" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.films')}>
          <span className="nav-link-icon">🎬</span>
          {!collapsed && <span className="nav-link-text">{t('nav.films')}</span>}
        </NavLink>
        <NavLink to="/ebooks" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.ebooks')}>
          <span className="nav-link-icon">📚</span>
          {!collapsed && <span className="nav-link-text">{t('nav.ebooks')}</span>}
        </NavLink>
        <NavLink to="/comics" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.comics')}>
          <span className="nav-link-icon">📖</span>
          {!collapsed && <span className="nav-link-text">{t('nav.comics')}</span>}
        </NavLink>
        <NavLink to="/trending" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.trending')}>
          <span className="nav-link-icon">📈</span>
          {!collapsed && <span className="nav-link-text">{t('nav.trending')}</span>}
        </NavLink>
        <NavLink to="/playlists" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.playlists', { defaultValue: 'Playlists' })}>
          <span className="nav-link-icon">🎵</span>
          {!collapsed && <span className="nav-link-text">{t('nav.playlists', { defaultValue: 'Playlists' })}</span>}
        </NavLink>
        <NavLink to="/notes" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title="Notes">
          <span className="nav-link-icon">🗒️</span>
          {!collapsed && <span className="nav-link-text">Notes</span>}
        </NavLink>
        <NavLink to="/ai" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title={t('nav.ai')}>
          <span className="nav-link-icon">🤖</span>
          {!collapsed && <span className="nav-link-text">{t('nav.ai')}</span>}
        </NavLink>
        <NavLink to="/stats/music" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title="Số liệu nghe nhạc">
          <span className="nav-link-icon">📊</span>
          {!collapsed && <span className="nav-link-text">Số liệu nghe</span>}
        </NavLink>
        <NavLink to="/debug" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title="Request Log">
          <span className="nav-link-icon">📡</span>
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

      <div className="lang-toggle" onClick={toggleLang}>
        <span className={i18n.language === 'vi' ? 'lang-opt lang-opt--active' : 'lang-opt'}>VI</span>
        <span className="lang-sep">·</span>
        <span className={i18n.language === 'en' ? 'lang-opt lang-opt--active' : 'lang-opt'}>EN</span>
      </div>
    </nav>
  )
}
