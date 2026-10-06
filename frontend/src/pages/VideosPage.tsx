import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchVideos, Video, LIBRARY_STALE_TIME } from '../api'
import Spinner from '../components/Spinner'

function formatDuration(s: number) {
  if (!s) return ''
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// created_at is stored as a unix timestamp (seconds); tolerate ms just in case.
function isNew(createdAt: number) {
  if (!createdAt) return false
  const sec = createdAt > 1e12 ? createdAt / 1000 : createdAt
  const ageDays = (Date.now() / 1000 - sec) / 86400
  return ageDays >= 0 && ageDays <= 14
}

const getFallbackPoster = (id: string) => `/api/video-posters/${id}`

// Dark-tuned placeholder (TIDAL canvas): --img bg + a muted film/play glyph.
const FALLBACK_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 300'%3E%3Crect width='200' height='300' fill='%23141414'/%3E%3Crect x='46' y='120' width='108' height='72' rx='8' fill='none' stroke='%234a4a52' stroke-width='3'/%3E%3Cpath d='M90 138l30 18-30 18z' fill='%234a4a52'/%3E%3C/svg%3E"

function VideoCard({ v }: { v: Video }) {
  return (
    <Link to={`/video/${v.id}`} className="video-poster-card">
      <div className="video-poster-img">
        <img
          src={v.poster_url || getFallbackPoster(v.id)}
          alt={v.title}
          loading="lazy"
          onError={e => {
            const target = e.target as HTMLImageElement
            if (target.src !== FALLBACK_SVG) target.src = FALLBACK_SVG
          }}
        />
        <div className="video-poster-scrim" aria-hidden="true">
          <span className="ms video-poster-play">play_arrow</span>
        </div>
        {isNew(v.created_at) && <span className="video-poster-badge">MỚI</span>}
        {v.duration_s ? (
          <span className="video-poster-duration">{formatDuration(v.duration_s)}</span>
        ) : null}
      </div>
      <div className="video-poster-info">
        <div className="video-poster-title">{v.title}</div>
        {v.duration_s ? (
          <div className="video-poster-meta">{formatDuration(v.duration_s)}</div>
        ) : null}
      </div>
    </Link>
  )
}

export default function VideosPage() {
  const { data: videos = [], isLoading: loading } = useQuery({ queryKey: ['videos'], queryFn: fetchVideos, staleTime: LIBRARY_STALE_TIME })
  const [params] = useSearchParams()
  const q = params.get('q')?.trim().toLowerCase() ?? ''

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

  const filtered = q ? videos.filter(v => v.title.toLowerCase().includes(q)) : videos

  // Group by group_name. Shelves when multiple real categories exist and we're
  // not searching; otherwise a single responsive grid.
  const groups: Record<string, Video[]> = {}
  for (const v of filtered) {
    const key = v.group_name || 'Phim'
    if (!groups[key]) groups[key] = []
    groups[key].push(v)
  }
  const groupEntries = Object.entries(groups)
  const useShelves = !q && groupEntries.length > 1

  if (filtered.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Phim</h1>
        <div className="videos-empty">
          <span className="ms videos-empty-glyph">search_off</span>
          <p className="videos-empty-note">Không có phim nào khớp với “{q}”</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="videos-head">
        <h1 className="page-title">Phim</h1>
        <span className="videos-count">{filtered.length} phim{q ? ` · “${q}”` : ''}</span>
      </div>

      {useShelves ? (
        groupEntries.map(([groupName, groupVideos]) => (
          <section key={groupName} className="video-shelf">
            <div className="video-shelf-head">
              <h2 className="video-shelf-title">{groupName}</h2>
              <span className="video-shelf-count">{groupVideos.length}</span>
            </div>
            <div className="video-shelf-track">
              {groupVideos.map(v => <VideoCard key={v.id} v={v} />)}
            </div>
          </section>
        ))
      ) : (
        <div className="video-poster-grid">
          {filtered.map(v => <VideoCard key={v.id} v={v} />)}
        </div>
      )}
    </div>
  )
}
