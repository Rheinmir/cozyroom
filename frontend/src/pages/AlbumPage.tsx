import { useState } from 'react'
import { MUSIC_FALLBACK_COVER } from '../coverPlaceholder'
import { useParams, useNavigate, Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fetchTracks, fetchAlbum, imgSrc } from '../api'
import { usePlayer } from '../PlayerContext'
import FavoritePill from '../components/FavoritePill'
import Spinner from '../components/Spinner'
import BackButton from '../components/BackButton'
import { useDominantColor } from '../useDominantColor'

function HeroCoverImg({ url, title }: { url: string; title: string }) {
  const [err, setErr] = useState(false)
  if (!url || err) return <img className="no-cover-lg" src={MUSIC_FALLBACK_COVER} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  return <img src={imgSrc(url, 400)} alt={title} onError={() => setErr(true)} />
}

const fmt = (s: number) => {
  if (!s) return '--:--'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// Album running time, Apple-Music style: "42 phút" / "1 giờ 12 phút".
const fmtTotal = (s: number) => {
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)} giờ ${m % 60} phút` : `${m} phút`
}

export default function AlbumPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { play, track: current, isPlaying, setShuffleMode } = usePlayer()

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

  const tint = useDominantColor(album?.cover_url ? imgSrc(album.cover_url, 400) : undefined)
  const totalS = tracks.reduce((n, tr) => n + (tr.duration_s || 0), 0)
  const playAll = () => { if (tracks.length) play(tracks[0], tracks) }
  const shuffleAll = () => {
    if (!tracks.length) return
    setShuffleMode('shuffle')
    play(tracks[Math.floor(Math.random() * tracks.length)], tracks)
  }

  if (isLoading) return <div className="loading"><Spinner size={28} label={t('library.loading')} /></div>

  return (
    <div className="page album-page" style={{ paddingTop: 0 }}>
      <BackButton onClick={() => navigate(-1)} label={t('library.back')} />

      <div className="album-hero detail-hero" style={{ '--tint': tint } as CSSProperties}>
        <div className="album-hero-cover">
          <HeroCoverImg url={album?.cover_url ?? ''} title={album?.title ?? ''} />
        </div>
        <div className="album-hero-info">
          <p className="hero-type">{t('library.album')}</p>
          <h1 className="hero-title">{album?.title ?? ''}</h1>
          <p className="hero-meta">
            {album?.artist_id
              ? <Link to={`/artist/${album.artist_id}`} className="hero-meta-strong">{album?.artist_name}</Link>
              : <span className="hero-meta-strong">{album?.artist_name}</span>}
            {album?.year ? <span>{album.year}</span> : null}
            <span>{t('library.tracks_count', { n: tracks.length })}</span>
            {totalS > 0 && <span>{fmtTotal(totalS)}</span>}
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={playAll} disabled={!tracks.length}>
              <span className="ms" style={{ fontSize: 22 }} aria-hidden>play_arrow</span>{t('player.play')}
            </button>
            <button className="btn-secondary" onClick={shuffleAll} disabled={!tracks.length}>
              <span className="ms" style={{ fontSize: 19 }} aria-hidden>shuffle</span>{t('library.shuffle')}
            </button>
          </div>
        </div>
      </div>

      <table className="track-table">
        <thead>
          <tr>
            <th className="col-num">#</th>
            <th>{t('search.title_col')}</th>
            <th className="col-fav"></th>
            <th className="col-dur" aria-label={t('search.duration_col')} title={t('search.duration_col')}>
              <span className="ms ms--outline" style={{ fontSize: 17, verticalAlign: 'middle' }} aria-hidden>schedule</span>
            </th>
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
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(t, tracks) } }}
              >
                <td className="col-num">
                  {isCurrent && isPlaying
                    ? <span className="track-eq" aria-label="Đang phát"><i/><i/><i/></span>
                    : <span className="track-num-text">{t.track_num || i + 1}</span>
                  }
                </td>
                <td className={'track-title' + (isCurrent ? ' track-title--active' : '')}>
                  <span className="tt-clamp">{t.title}</span>
                  {t.artist_name && t.artist_name !== album?.artist_name && <span className="track-artist">{t.artist_name}</span>}
                </td>
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
