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
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={() => navigate('/videos')}
        style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', marginBottom: '20px', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        Back to Films
      </button>

      <div style={{ flex: 1, background: '#000', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
        <video
          ref={videoRef}
          controls
          autoPlay
          style={{ width: '100%', height: '100%', outline: 'none' }}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  )
}
