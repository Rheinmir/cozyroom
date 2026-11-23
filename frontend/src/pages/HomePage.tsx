import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { usePlayer } from '../PlayerContext'
import { fetchStats, fetchAlbums, fetchVideos, fetchEbooks, imgSrc } from '../api'
import { MEDIA } from '../endpoints'
import { ROUTES } from '../routes'

const Ico = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const ICONS: Record<string, ReactNode> = {
  music:   <Ico><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></Ico>,
  video:   <Ico><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9.5v5l4.5-2.5z" /></Ico>,
  read:    <Ico><path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z" /><path d="M12 6.5v13" /></Ico>,
  ai:      <Ico><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></Ico>,
  notes:   <Ico><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h4" /></Ico>,
  explore: <Ico><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></Ico>,
  system:  <Ico><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></Ico>,
}

// One link per module. Order = DOM/tab order; the grid places Music as the big tile.
const TILES = [
  { key: 'music',   to: ROUTES.music },
  { key: 'video',   to: ROUTES.videos },
  { key: 'read',    to: ROUTES.ebooks },
  { key: 'ai',      to: ROUTES.ai },
  { key: 'notes',   to: ROUTES.notes },
  { key: 'explore', to: ROUTES.trending },
  { key: 'system',  to: ROUTES.tools },
] as const

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// Module hub at "/": greeting + library counts, a Continue card (player state only — no new
// endpoint) and one tile per module. Colours come from the existing tokens (One Accent Rule).
export default function HomePage() {
  const { t } = useTranslation()
  const { track, isPlaying, progress, duration, toggle, setNpoOpen } = usePlayer()
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: fetchStats, staleTime: 5 * 60_000 })

  // Real library art behind the media tiles; cached queries other pages already use.
  const { data: albums } = useQuery({ queryKey: ['albums'], queryFn: () => fetchAlbums(), staleTime: 5 * 60_000 })
  const { data: videos } = useQuery({ queryKey: ['videos'], queryFn: fetchVideos, staleTime: 5 * 60_000 })
  const { data: ebooks } = useQuery({ queryKey: ['ebooks'], queryFn: fetchEbooks, staleTime: 5 * 60_000 })
  const pick = <T,>(xs: T[] | undefined, f: (x: T) => string | undefined) => xs?.map(f).find(Boolean)
  const art: Record<string, string | undefined> = {
    music: pick(albums, a => a.cover_url && imgSrc(a.cover_url, 640)),
    // the videos API has no poster_url today: the Videos page falls back to /media/video-posters/<id>, so do the same
    video: pick(videos, v => imgSrc(v.poster_url || `${MEDIA}/video-posters/${v.id}`, 480)),
    // never put an NSFW cover on the hub (the Ebooks page blurs and gates them)
    read:  pick(ebooks, b => !b.is_nsfw && b.cover_url ? imgSrc(b.cover_url, 480) : undefined),
  }

  const h = new Date().getHours()
  const greeting = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0
  const cover = track?.album_id?.startsWith('yt:')
    ? `https://i.ytimg.com/vi/${track.album_id.slice(3)}/mqdefault.jpg`
    : track ? imgSrc(`${MEDIA}/covers/${track.album_id}`, 160) : ''

  return (
    <div className="page hub-page">
      <header className="hub-head">
        <h1 className="hub-title">{t(`hub.greeting_${greeting}`)}</h1>
        <p className="hub-sub">{t('hub.subtitle')}</p>
      </header>

      <section className="hub-continue" aria-label={t('hub.continue')}>
        {track ? (
          <>
            <div className="hub-continue-cover">
              {cover && <img src={cover} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
            </div>
            <div className="hub-continue-info">
              <span className="hub-continue-label">{t('hub.continue')}</span>
              <strong className="hub-continue-title">{track.title}</strong>
              <span className="hub-continue-artist">{track.artist_name ?? ''}</span>
              <div className="hub-continue-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-valuetext={`${fmt(progress)} / ${fmt(duration)}`}>
                <i style={{ width: `${pct}%` }} />
              </div>
            </div>
            <button className="hub-continue-link hub-continue-open" onClick={() => setNpoOpen(true)}>{t('hub.open_player')}</button>
            <button className="play-btn" onClick={toggle} aria-label={isPlaying ? t('hub.pause') : t('hub.resume')}>
              {isPlaying
                ? <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                : <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><polygon points="6,3 20,12 6,21" /></svg>}
            </button>
          </>
        ) : (
          <>
            <div className="hub-continue-info">
              <span className="hub-continue-label">{t('hub.continue')}</span>
              <strong className="hub-continue-title">{t('hub.nothing')}</strong>
            </div>
            <Link className="hub-continue-link" to={ROUTES.music}>{t('hub.start')}</Link>
          </>
        )}
      </section>

      <nav className="hub-grid" aria-label={t('hub.modules')}>
        {TILES.map(({ key, to }) => (
          <Link key={key} to={to} className={`hub-tile hub-tile--${key}${art[key] ? ' has-art' : ''}`}>
            {art[key] && <img className="hub-tile-art" src={art[key]} alt="" loading="lazy" onError={e => { (e.target as HTMLImageElement).remove() }} />}
            <span className="hub-tile-ico">{ICONS[key]}</span>
            <span className="hub-tile-text">
              <span className="hub-tile-name">{t(`hub.tiles.${key}.name`)}</span>
              <span className="hub-tile-desc">{t(`hub.tiles.${key}.desc`)}</span>
              {key === 'music' && stats && <span className="hub-tile-count">{t('hub.tracks_count', { count: stats.tracks })}</span>}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
