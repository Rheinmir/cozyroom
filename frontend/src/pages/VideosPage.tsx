import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchVideos, Video, LIBRARY_STALE_TIME } from '../api'
import Spinner from '../components/Spinner'
import { getVideoProgress, watchedFraction, parseEpisode, cleanVideoTitle } from '../mediaProgress'
import { relTime } from '../roomVoice'

function formatDuration(s: number) {
  if (!s) return ''
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatSize(bytes: number) {
  if (!bytes) return ''
  const gb = bytes / 1024 ** 3
  return gb >= 1 ? `${gb.toFixed(1).replace('.', ',')} GB` : `${Math.round(bytes / 1024 ** 2)} MB`
}

// created_at is stored as a unix timestamp (seconds); tolerate ms just in case.
function isNew(createdAt: number) {
  if (!createdAt) return false
  const sec = createdAt > 1e12 ? createdAt / 1000 : createdAt
  const ageDays = (Date.now() / 1000 - sec) / 86400
  return ageDays >= 0 && ageDays <= 14
}

const posterOf = (v: Video) => v.poster_url || `/api/video-posters/${v.id}`

// Dark-tuned placeholder (canvas): --img bg + a muted film/play glyph.
const FALLBACK_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 300'%3E%3Crect width='200' height='300' fill='%23141414'/%3E%3Crect x='46' y='120' width='108' height='72' rx='8' fill='none' stroke='%234a4a52' stroke-width='3'/%3E%3Cpath d='M90 138l30 18-30 18z' fill='%234a4a52'/%3E%3C/svg%3E"
const onPosterError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const t = e.currentTarget
  if (t.src !== FALLBACK_SVG) t.src = FALLBACK_SVG
}

type Episode = { v: Video; ep: number }
type Series = { name: string; eps: Episode[]; poster: string; bytes: number }

function VideoCard({ v, showGroup = false }: { v: Video; showGroup?: boolean }) {
  return (
    <Link to={`/video/${v.id}`} className="video-poster-card">
      <div className="video-poster-img">
        <img src={posterOf(v)} alt={v.title} loading="lazy" onError={onPosterError} />
        <div className="video-poster-scrim" aria-hidden="true">
          <span className="ms video-poster-play">play_arrow</span>
        </div>
        {isNew(v.created_at) && <span className="video-poster-badge">MỚI</span>}
        {v.duration_s ? <span className="video-poster-duration">{formatDuration(v.duration_s)}</span> : null}
      </div>
      <div className="video-poster-info">
        <div className="video-poster-title">{cleanVideoTitle(v.title) || v.title}</div>
        {showGroup && v.group_name ? <div className="video-poster-meta">{v.group_name}</div> : null}
      </div>
    </Link>
  )
}

// Episode tile: every episode in the library shares one poster, so instead of
// repeating the same artwork 15 times each tile shows a different, heavily
// zoomed + darkened crop of it behind a large episode numeral — the poster
// becomes texture and the number carries the identity.
export function EpisodeTile({ e, series, index, compact = false, current = false }: {
  e: Episode; series: Series; index: number; compact?: boolean; current?: boolean
}) {
  const prog = getVideoProgress()[e.v.id]
  const frac = watchedFraction(prog)
  const done = frac >= 0.95
  // zoom origin walks around the frame (20–80%) so neighbouring tiles differ
  const crop = { transformOrigin: `${20 + (index * 37) % 61}% ${25 + (index * 53) % 51}%` } as CSSProperties
  return (
    <Link to={`/video/${e.v.id}`} className={'ep-tile' + (compact ? ' ep-tile--compact' : '') + (current ? ' ep-tile--current' : '')} aria-current={current ? 'true' : undefined}>
      <div className="ep-tile-art">
        <img src={series.poster} alt="" loading="lazy" style={crop} onError={onPosterError} />
        <span className="ep-tile-num" aria-hidden>{e.ep}</span>
        <span className="ep-tile-play ms" aria-hidden>play_arrow</span>
        {done && <span className="ep-tile-done ms" aria-label="Đã xem">check_circle</span>}
        {current && <span className="ep-tile-now">Đang xem</span>}
        {frac > 0.02 && !done && <span className="ep-tile-bar"><i style={{ width: `${frac * 100}%` }} /></span>}
      </div>
      <div className="ep-tile-info">
        <span className="ep-tile-title">Tập {e.ep}</span>
        <span className="ep-tile-meta">
          {prog && !done && frac > 0.02 ? `Còn ${Math.max(1, Math.round((prog.d - prog.t) / 60))} phút` : formatSize(e.v.size_bytes)}
        </span>
      </div>
    </Link>
  )
}

export function buildSeries(videos: Video[]): { series: Series[]; singles: Video[] } {
  const byGroup: Record<string, Episode[]> = {}
  const singles: Video[] = []
  for (const v of videos) {
    const ep = parseEpisode(v.title)
    if (ep == null) { singles.push(v); continue }
    const key = v.group_name || cleanVideoTitle(v.title)
    ;(byGroup[key] ||= []).push({ v, ep })
  }
  const series: Series[] = []
  for (const [name, eps] of Object.entries(byGroup)) {
    if (eps.length < 2) { singles.push(...eps.map(e => e.v)); continue }
    eps.sort((a, b) => a.ep - b.ep)
    series.push({ name, eps, poster: posterOf(eps[0].v), bytes: eps.reduce((n, e) => n + (e.v.size_bytes || 0), 0) })
  }
  series.sort((a, b) => b.eps.length - a.eps.length)
  return { series, singles }
}

// What "Play" should mean for a series: resume the most recently touched
// episode, or move on to the next one if that episode was finished.
export function nextUp(s: Series): { e: Episode; resume: boolean } {
  const prog = getVideoProgress()
  let last: Episode | null = null, lastAt = 0
  for (const e of s.eps) { const p = prog[e.v.id]; if (p && p.at > lastAt) { lastAt = p.at; last = e } }
  if (!last) return { e: s.eps[0], resume: false }
  const frac = watchedFraction(prog[last.v.id])
  if (frac < 0.95) return { e: last, resume: frac > 0.02 }
  const i = s.eps.indexOf(last)
  return { e: s.eps[Math.min(i + 1, s.eps.length - 1)], resume: false }
}

function Billboard({ s }: { s: Series }) {
  const { e, resume } = nextUp(s)
  const watched = s.eps.filter(x => watchedFraction(getVideoProgress()[x.v.id]) >= 0.95).length
  return (
    <section className="film-billboard">
      <div className="film-billboard-bg" aria-hidden>
        <img src={s.poster} alt="" onError={onPosterError} />
      </div>
      <div className="film-billboard-body">
        <div className="film-billboard-text">
          <p className="film-eyebrow">Series</p>
          <h2 className="film-billboard-title">{s.name}</h2>
          <p className="hero-meta film-billboard-meta">
            <span>{s.eps.length} tập</span>
            {s.bytes > 0 && <span>{formatSize(s.bytes)}</span>}
            {watched > 0 && <span>Đã xem {watched}/{s.eps.length}</span>}
          </p>
          {resume && (() => { const p = getVideoProgress()[e.v.id]; return p ? <p className="room-voice room-voice--onmedia">Bạn dừng ở phút {Math.floor(p.t / 60)} của Tập {e.ep}, {relTime(p.at)}.</p> : null })()}
          <div className="hero-actions">
            <Link to={`/video/${e.v.id}`} className="btn-primary">
              <span className="ms" style={{ fontSize: 22 }} aria-hidden>play_arrow</span>
              {resume ? `Xem tiếp Tập ${e.ep}` : e.ep === s.eps[0].ep ? 'Xem Tập 1' : `Xem Tập ${e.ep}`}
            </Link>
            <a href={`#series-${encodeURIComponent(s.name)}`} className="btn-secondary">
              <span className="ms" style={{ fontSize: 19 }} aria-hidden>format_list_numbered</span>Danh sách tập
            </a>
          </div>
        </div>
        <img className="film-billboard-poster" src={s.poster} alt={s.name} onError={onPosterError} />
      </div>
    </section>
  )
}

export default function VideosPage() {
  const { data: videos = [], isLoading: loading } = useQuery({ queryKey: ['videos'], queryFn: fetchVideos, staleTime: LIBRARY_STALE_TIME })
  const [params] = useSearchParams()
  const q = params.get('q')?.trim().toLowerCase() ?? ''
  const { series, singles } = useMemo(() => buildSeries(videos), [videos])

  if (loading) return <div className="loading"><Spinner size={28} label="Đang tải…" /></div>

  if (videos.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Phim</h1>
        <div className="videos-empty">
          <span className="ms videos-empty-glyph">movie</span>
          <p className="videos-empty-note">Thả poster phim của bạn vào đây</p>
        </div>
      </div>
    )
  }

  // Search: a flat, focused result grid.
  if (q) {
    const filtered = videos.filter(v => v.title.toLowerCase().includes(q) || (v.group_name ?? '').toLowerCase().includes(q))
    return (
      <div className="page">
        <div className="videos-head">
          <h1 className="page-title">Phim</h1>
          <span className="videos-count">{filtered.length} kết quả · “{q}”</span>
        </div>
        {filtered.length === 0 ? (
          <div className="videos-empty">
            <span className="ms videos-empty-glyph">search_off</span>
            <p className="videos-empty-note">Không có phim nào khớp với “{q}”</p>
          </div>
        ) : (
          <div className="video-poster-grid">
            {filtered.map(v => <VideoCard key={v.id} v={v} showGroup />)}
          </div>
        )}
      </div>
    )
  }

  const prog = getVideoProgress()
  const inProgress = videos
    .filter(v => { const f = watchedFraction(prog[v.id]); return f > 0.02 && f < 0.95 })
    .sort((a, b) => prog[b.id].at - prog[a.id].at)
  const seriesOf = (v: Video) => series.find(s => s.eps.some(e => e.v.id === v.id))

  return (
    <div className="page films-page">
      {series[0] && <Billboard s={series[0]} />}
      {!series[0] && (
        <div className="videos-head">
          <h1 className="page-title">Phim</h1>
          <span className="videos-count">{videos.length} phim</span>
        </div>
      )}

      {inProgress.length > 0 && (
        <section className="film-section">
          <h2 className="discover-section-title">Đang xem dở</h2>
          <div className="ep-row">
            {inProgress.map(v => {
              const s = seriesOf(v)
              const e = s?.eps.find(x => x.v.id === v.id)
              return s && e
                ? <EpisodeTile key={v.id} e={e} series={s} index={s.eps.indexOf(e)} />
                : <VideoCard key={v.id} v={v} />
            })}
          </div>
        </section>
      )}

      {series.map(s => (
        <section key={s.name} className="film-section" id={`series-${encodeURIComponent(s.name)}`}>
          <div className="discover-section-head">
            <h2 className="discover-section-title">{s.name}</h2>
            <span className="videos-count">{s.eps.length} tập</span>
          </div>
          <div className="ep-grid">
            {s.eps.map((e, i) => <EpisodeTile key={e.v.id} e={e} series={s} index={i} />)}
          </div>
        </section>
      ))}

      {singles.length > 0 && (
        <section className="film-section">
          <h2 className="discover-section-title">{series.length ? 'Phim lẻ' : 'Tất cả phim'}</h2>
          <div className="video-poster-grid">
            {singles.map(v => <VideoCard key={v.id} v={v} showGroup />)}
          </div>
        </section>
      )}
    </div>
  )
}
