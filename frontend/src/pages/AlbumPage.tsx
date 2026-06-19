import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fetchTracks, fetchAlbum, imgSrc } from '../api'
import { usePlayer } from '../PlayerContext'
import FavoritePill from '../components/FavoritePill'

function HeroCoverImg({ url, title }: { url: string; title: string }) {
  const [err, setErr] = useState(false)
  if (!url || err) return <span className="no-cover-lg">♪</span>
  return <img src={imgSrc(url, 400)} alt={title} onError={() => setErr(true)} />
}

const fmt = (s: number) => {
  if (!s) return '--:--'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function AlbumPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { play, track: current, isPlaying } = usePlayer()

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ['tracks', id],
    queryFn: () => fetchTracks(id!),
    staleTime: 5 * 60_000,
  })

  const { data: album } = useQuery({
    queryKey: ['album', id],
    queryFn: () => fetchAlbum(id!),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className="loading">{t('library.loading')}</div>

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)}>{t('library.back')}</button>

      <div className="album-hero">
        <div className="album-hero-cover">
          <HeroCoverImg url={album?.cover_url ?? ''} title={album?.title ?? ''} />
        </div>
        <div className="album-hero-info">
          <p className="hero-type">{t('library.album')}</p>
          <h1 className="hero-title">{album?.title ?? ''}</h1>
          <p className="hero-meta">
            {album?.artist_name}
            {album?.year ? ` · ${album.year}` : ''}
            {` · ${t('library.tracks_count', { n: tracks.length })}`}
          </p>
        </div>
      </div>

      <table className="track-table">
        <thead>
          <tr>
            <th className="col-num">#</th>
            <th>{t('search.title_col')}</th>
            <th className="col-fav"></th>
            <th className="col-dur">{t('search.duration_col')}</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((t, i) => {
            const isCurrent = current?.id === t.id
            return (
              <tr
                key={t.id}
                className={'track-row' + (isCurrent ? ' track-row--active' : '')}
                onClick={() => play(t, tracks)}
              >
                <td className="col-num">
                  {isCurrent && isPlaying
                    ? <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--green)"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    : <span className="track-num-text">{t.track_num || i + 1}</span>
                  }
                </td>
                <td className={'track-title' + (isCurrent ? ' track-title--active' : '')}>{t.title}</td>
                <td className="col-fav" onClick={e => e.stopPropagation()}>
                  <FavoritePill trackId={t.id} />
                </td>
                <td className="col-dur">{fmt(t.duration_s)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
