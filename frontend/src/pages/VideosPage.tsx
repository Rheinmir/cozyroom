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

const getFallbackPoster = (id: string) => `/api/video-posters/${id}`
const FALLBACK_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 300'%3E%3Crect width='200' height='300' fill='%23222'/%3E%3Cpath d='M60 100h80v20H60zm0 40h80v10H60zm0 30h80v10H60zm0 30h50v10H60z' fill='%23555'/%3E%3C/svg%3E"

function VideoCard({ v }: { v: Video }) {
  return (
    <Link to={`/video/${v.id}`} className="video-poster-card" style={{ textDecoration: 'none' }}>
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
        {v.duration_s ? (
          <span className="video-poster-duration">{formatDuration(v.duration_s)}</span>
        ) : null}
      </div>
      <div className="video-poster-info">
        <div className="video-poster-title">{v.title}</div>
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
        <p className="videos-empty-note">Thả poster phim của bạn vào đây</p>
      </div>
    )
  }

  const groups: Record<string, Video[]> = {}
  for (const v of (q ? videos.filter(v => v.title.toLowerCase().includes(q)) : videos)) {
    const key = v.group_name || 'Phim'
    if (!groups[key]) groups[key] = []
    groups[key].push(v)
  }
  const groupEntries = Object.entries(groups)

  return (
    <div className="page">
      <h1 className="page-title">Phim</h1>

      {groupEntries.map(([groupName, groupVideos]) => (
        <div key={groupName} className="video-group">
          {groupEntries.length > 1 && (
            <h2 className="video-group-title">{groupName}</h2>
          )}
          <div className="video-poster-grid">
            {groupVideos.map(v => <VideoCard key={v.id} v={v} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
