import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchTracks } from '../api'
import { usePlayer } from '../PlayerContext'
import FavoritePill from '../components/FavoritePill'
import LibraryStatsBar from '../components/LibraryStatsBar'
import Spinner from '../components/Spinner'

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
  const { play } = usePlayer()
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ['tracks', 'all'],
    queryFn: () => fetchTracks(''),
    staleTime: 5 * 60_000,
  })

  const sorted = useMemo(() => [...tracks].sort((a, b) => a.title.localeCompare(b.title)), [tracks])
  const availableLetters = useMemo(() => new Set(sorted.map(t2 => letterOf(t2.title))), [sorted])
  let lastLetter = ''

  if (isLoading) return <div className="loading"><Spinner size={28} label={t('library.loading')} /></div>

  return (
    <div className="page">
      <LibraryStatsBar current="tracks" />
      <h1 className="page-title">{t('search.tracks')}</h1>
      <div className="artist-grid-wrap">
        <table className="track-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th>{t('search.title_col')}</th>
              <th className="col-fav"></th>
              <th>{t('search.album_col')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t2, i) => {
              const letter = letterOf(t2.title)
              const isFirstOfLetter = letter !== lastLetter
              if (isFirstOfLetter) lastLetter = letter
              return (
                <tr
                  key={t2.id}
                  className="track-row"
                  id={isFirstOfLetter ? `track-letter-${letter}` : undefined}
                  onClick={() => play(t2, sorted)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(t2, sorted) } }}
                >
                  <td className="col-num"><span className="track-num-text">{i + 1}</span></td>
                  <td className="track-title"><span className="tt-clamp">{t2.title}</span></td>
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
      </div>
    </div>
  )
}
