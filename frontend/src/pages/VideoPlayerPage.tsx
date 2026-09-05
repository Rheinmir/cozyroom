import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Hls from 'hls.js'
import BackButton from '../components/BackButton'

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
      <BackButton onClick={() => navigate('/videos')} label="Back to Films" />
      <div className="video-player-wrap">
        <video ref={videoRef} controls autoPlay>
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  )
}
