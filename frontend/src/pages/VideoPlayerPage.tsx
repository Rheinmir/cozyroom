import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Hls from 'hls.js'

export default function VideoPlayerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !id) return

    const src = `/hls/${id}/index.m3u8`

    if (Hls.isSupported()) {
      const hlsInstance = new Hls()
      hlsInstance.loadSource(src)
      hlsInstance.attachMedia(video)
      return () => hlsInstance.destroy()
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari supports HLS natively
      video.src = src
    }
  }, [id])

  return (
    <div className="video-player-page">
      <button onClick={() => navigate('/videos')} className="video-player-back-btn">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        Back to Films
      </button>
      <div className="video-player-wrap">
        <video ref={videoRef} controls autoPlay>
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  )
}
