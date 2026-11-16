import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchTracks, imgSrc } from '../api'
import { usePlayer } from '../PlayerContext'
import FavoritePill from '../components/FavoritePill'
import LibraryStatsBar from '../components/LibraryStatsBar'
import Spinner from '../components/Spinner'
import { MUSIC_FALLBACK_COVER } from '../coverPlaceholder'

// Small cover thumbnail for a track row — shows the album art, falling back to
// the designed placeholder while loading / when there's no cover.
function TrackThumb({ albumId }: { albumId?: string }) {
  return (
    <img
      className="track-thumb"
      src={albumId ? imgSrc(`/api/covers/${albumId}`, 80) : MUSIC_FALLBACK_COVER}
      alt=""
      loading="lazy"
      onError={e => { (e.currentTarget as HTMLImageElement).src = MUSIC_FALLBACK_COVER }}
    />
  )
}

const AZ = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]
function letterOf(name: string) {
  const c = (name ?? '').trim().charAt(0).toUpperCase()
  return /[A-Z]/.test(c) ? c : '#'
}

// Full library track list — reached by tapping the "N tracks" figure in the
// ArtistsPage stats bar. Sorted by title with an A-Z rail (like Artists);
// playing a row seeds the whole sorted list as the queue.
export default function TracksPage() {
  const { t } = useTranslation()
  const { play, track: current, isPlaying } = usePlayer()
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ['tracks', 'all'],
    queryFn: () => fetchTracks(''),
    staleTime: 5 * 60_000,
  })

  const sorted = useMemo(() => [...tracks].sort((a, b) => a.title.localeCompare(b.title)), [tracks])
  const availableLetters = useMemo(() => new Set(sorted.map(t2 => letterOf(t2.title))), [sorted])
  const [params] = useSearchParams()
  const q = params.get('q')?.trim().toLowerCase() ?? ''
  const shown = q ? sorted.filter(t2 => t2.title.toLowerCase().includes(q) || (t2.artist_name ?? '').toLowerCase().includes(q) || (t2.album_title ?? '').toLowerCase().includes(q)) : sorted
  let lastLetter = ''

  if (isLoading) return <div className="loading"><Spinner size={28} label={t('library.loading')} /></div>

  return (
    <div className="page">
      <div className="library-head">
        <h1 className="page-title">{t('search.tracks')}</h1>
        <LibraryStatsBar current="tracks" />
      </div>
      <div className="artist-grid-wrap">
        <table className="track-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th>{t('search.title_col')}</th>
              <th className="col-fav"></th>
              <th className="col-album">{t('search.album_col')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t2, i) => {
              const letter = letterOf(t2.title)
              const isFirstOfLetter = !q && letter !== lastLetter
              if (isFirstOfLetter) lastLetter = letter
              const isCurrent = current?.id === t2.id
              return (
                <tr
                  key={t2.id}
                  className={isCurrent ? 'track-row track-row--playing' : 'track-row'}
                  id={isFirstOfLetter ? `track-letter-${letter}` : undefined}
                  onClick={() => play(t2, shown)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(t2, shown) } }}
                >
                  <td className="col-num">
                    {isCurrent
                      ? <span className={isPlaying ? 'track-eq' : 'track-eq track-eq--paused'} aria-label="Đang phát"><i/><i/><i/></span>
                      : <span className="track-num-text">{i + 1}</span>}
                  </td>
                  <td className="track-title">
                    <div className="track-title-cell">
                      <TrackThumb albumId={t2.album_id} />
                      <span className="tt-clamp">{t2.title}</span>
                    </div>
                  </td>
                  <td className="col-fav" onClick={e => e.stopPropagation()}>
                    <FavoritePill trackId={t2.id} />
                  </td>
                  <td className="col-album">
                    <Link
                      to={`/album/${t2.album_id}`}
                      className="text-muted"
                      onClick={e => e.stopPropagation()}
                    >
                      {t2.album_title}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!q && (
          <div className="artist-az-rail">
            {AZ.map(letter => (
              <button
                key={letter}
                className="artist-az-btn"
                disabled={!availableLetters.has(letter)}
                onClick={() => document.getElementById(`track-letter-${letter}`)?.scrollIntoView({ block: 'start' })}
              >
                {letter}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
