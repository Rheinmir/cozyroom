import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface Video {
  id: string
  title: string
  duration_s: number
  size_bytes: number
  created_at: number
  poster_url?: string
  group_name?: string
}

function formatDuration(s: number) {
  if (!s) return ''
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const getFallbackPoster = (id: string) => `/api/video-posters/${id}`
const FALLBACK_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%23222'/%3E%3Cpath d='M5 2.5v4l5-2z' fill='%23555'/%3E%3C/svg%3E"

function VideoCard({ v, videos, setFeaturedIdx }: { v: Video, videos: Video[], setFeaturedIdx: (i: number) => void }) {
  const [isHovered, setIsHovered] = useState(false)
  return (
    <Link
      to={`/video/${v.id}`}
      className="netflix-card"
      style={{ textDecoration: 'none' }}
      onClick={() => setFeaturedIdx(videos.indexOf(v))}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={v.poster_url || getFallbackPoster(v.id)}
        alt={v.title}
        loading="lazy"
        onError={e => {
          const target = e.target as HTMLImageElement;
          if (target.src !== FALLBACK_SVG) {
            target.src = FALLBACK_SVG;
          }
        }}
      />
      <div className="netflix-card-info">
        <div className="netflix-card-title">
          {isHovered && v.title.length > 20 ? (
            <div className="netflix-marquee"><span>{v.title}</span></div>
          ) : (
            v.title
          )}
        </div>
        <div className="netflix-card-meta">
          {v.duration_s ? <span className="netflix-card-duration">{formatDuration(v.duration_s)}</span> : null}
        </div>
      </div>
    </Link>
  )
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [featuredIdx, setFeaturedIdx] = useState(0)

  useEffect(() => {
    fetch('/api/videos')
      .then(res => res.json())
      .then(data => {
        setVideos(data || [])
        // Pick a video with a poster as hero if possible
        const withPoster = (data || []).findIndex((v: Video) => v.poster_url)
        setFeaturedIdx(withPoster >= 0 ? withPoster : 0)
        setLoading(false)
      })
      .catch(console.error)
  }, [])

  if (loading) return <div className="netflix-loading">Loading films…</div>

  if (videos.length === 0) {
    return (
      <div className="netflix-empty">
        <p>No videos found. Make sure <code>F:\Films</code> is mounted and contains video files.</p>
      </div>
    )
  }

  // Group by folder name
  const groups: Record<string, Video[]> = {}
  for (const v of videos) {
    const key = v.group_name || 'Films'
    if (!groups[key]) groups[key] = []
    groups[key].push(v)
  }
  const groupEntries = Object.entries(groups)

  const featured = videos[featuredIdx]

  return (
    <div className="netflix-page">
      {/* ── Hero banner ── */}
      <div
        className="netflix-hero"
        style={{
          backgroundImage: `url(${featured?.poster_url || getFallbackPoster(featured?.id || 'hero')})`
        }}
      >
        <div className="netflix-hero-overlay" />
        <div className="netflix-hero-content">
          <h1 className="netflix-hero-title">{featured?.title}</h1>
          {featured?.duration_s ? (
            <p className="netflix-hero-meta">{formatDuration(featured.duration_s)}</p>
          ) : null}
          <div className="netflix-hero-buttons">
            <Link
              to={`/video/${featured?.id}`}
              className="netflix-btn netflix-btn-play"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </Link>
            <button
              className="netflix-btn netflix-btn-info"
              onClick={() => {
                const next = (featuredIdx + 1) % videos.length
                setFeaturedIdx(next)
              }}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
              Next up
            </button>
          </div>
        </div>
      </div>

      {/* ── Rows ── */}
      <div className="netflix-rows">
        {groupEntries.map(([groupName, groupVideos]) => (
          <div key={groupName} className="netflix-row">
            <h2 className="netflix-row-title">{groupName}</h2>
            <div className="netflix-slider">
              {groupVideos.map((v) => (
                <VideoCard key={v.id} v={v} videos={videos} setFeaturedIdx={setFeaturedIdx} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
