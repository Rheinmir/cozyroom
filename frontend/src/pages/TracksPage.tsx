import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchTracks } from '../api'
import { usePlayer } from '../PlayerContext'
import FavoritePill from '../components/FavoritePill'
import BackButton from '../components/BackButton'
import Spinner from '../components/Spinner'

// Full library track list — reached by tapping the "N tracks" figure in the
// ArtistsPage stats bar. Reuses the existing .track-table markup (same as
// SearchPage's tracks section). Playing a row seeds the whole list as the
// queue so next/prev walk the full library.
export default function TracksPage() {
  const { t } = useTranslation()
  const { play } = usePlayer()
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ['tracks', 'all'],
    queryFn: () => fetchTracks(''),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className="loading"><Spinner size={28} label={t('library.loading')} /></div>

  return (
    <div className="page">
      <BackButton to="/" label={t('nav.artists')} />
      {/* clear the fixed top-left back button — this page opens with a bare
          title (no artwork above it) so the button would overlap it */}
      <h1 className="page-title" style={{ marginTop: 44 }}>{t('search.tracks')}</h1>
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
          {tracks.map((t2, i) => (
            <tr
              key={t2.id}
              className="track-row"
              onClick={() => play(t2, tracks)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(t2, tracks) } }}
            >
              <td className="col-num"><span className="track-num-text">{i + 1}</span></td>
              <td className="track-title">{t2.title}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  )
}
