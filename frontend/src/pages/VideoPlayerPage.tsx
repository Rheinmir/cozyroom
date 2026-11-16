import { useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Hls from 'hls.js'
import { useQuery } from '@tanstack/react-query'
import { fetchVideos, LIBRARY_STALE_TIME } from '../api'
import BackButton from '../components/BackButton'
import { buildSeries, EpisodeTile } from './VideosPage'
import { getVideoProgress, saveVideoProgress, cleanVideoTitle } from '../mediaProgress'

export default function VideoPlayerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  // Same cached ['videos'] list the library uses — gives us the title for free.
  const { data: videos = [] } = useQuery({ queryKey: ['videos'], queryFn: fetchVideos, staleTime: LIBRARY_STALE_TIME })
  const meta = videos.find(v => v.id === id)
  const { series } = useMemo(() => buildSeries(videos), [videos])
  const s = series.find(x => x.eps.some(e => e.v.id === id))
  const idx = s ? s.eps.findIndex(e => e.v.id === id) : -1
  const cur = s && idx >= 0 ? s.eps[idx] : null
  const next = s && idx >= 0 ? s.eps[idx + 1] : undefined

  useEffect(() => {
    const video = videoRef.current
    if (!video || !id) return

    const src = `/hls/${id}/index.m3u8`

    // Resume where this device left off (skip if barely started or nearly done),
    // and remember the position every few seconds + on pause/leave.
    const saved = getVideoProgress()[id]
    const onMeta = () => {
      if (saved && saved.t > 10 && saved.t < (video.duration || saved.d) - 30) video.currentTime = saved.t
    }
    let lastSave = 0
    const save = () => saveVideoProgress(id, video.currentTime, video.duration)
    const onTime = () => { const now = Date.now(); if (now - lastSave > 5000) { lastSave = now; save() } }
    const onEnded = () => saveVideoProgress(id, video.duration, video.duration)
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('pause', save)
    video.addEventListener('ended', onEnded)
    const detach = () => {
      if (video.currentTime > 0) save()
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('pause', save)
      video.removeEventListener('ended', onEnded)
    }

    if (Hls.isSupported()) {
      const hlsInstance = new Hls()
      hlsInstance.loadSource(src)
      hlsInstance.attachMedia(video)
      return () => { detach(); hlsInstance.destroy() }
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari supports HLS natively
      video.src = src
    }
    return detach
  }, [id])

  return (
    <div className="video-player-page">
      <BackButton onClick={() => navigate('/videos')} label="Back to Films" />
      <div className="video-player-wrap">
        <video ref={videoRef} controls autoPlay>
          Your browser does not support the video tag.
        </video>
      </div>
      {meta && (
        <div className="video-player-meta">
          <div className="video-player-meta-text">
            {s && cur ? (
              <>
                <p className="film-eyebrow">{s.name}</p>
                <h1 className="video-player-title">Tập {cur.ep}</h1>
                <p className="video-player-sub">{idx + 1} / {s.eps.length} tập</p>
              </>
            ) : (
              <>
                <h1 className="video-player-title">{cleanVideoTitle(meta.title) || meta.title}</h1>
                {meta.group_name && <p className="video-player-sub">{meta.group_name}</p>}
              </>
            )}
          </div>
          {next && (
            <Link to={`/video/${next.v.id}`} className="btn-primary">
              Tập tiếp theo
              <span className="ms" style={{ fontSize: 20 }} aria-hidden>skip_next</span>
            </Link>
          )}
        </div>
      )}
      {s && (
        <section className="video-player-eps">
          <h2 className="discover-section-title">Các tập</h2>
          <div className="ep-row">
            {s.eps.map((e, i) => <EpisodeTile key={e.v.id} e={e} series={s} index={i} compact current={e.v.id === id} />)}
          </div>
        </section>
      )}
    </div>
  )
}
