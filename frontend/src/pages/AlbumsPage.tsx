import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchAlbums, imgSrc } from '../api'
import BackButton from '../components/BackButton'
import Spinner from '../components/Spinner'

// Full library album grid — reached by tapping the "N albums" figure in the
// ArtistsPage stats bar. Reuses the existing .album-grid / .album-card
// markup (same as SearchPage's album section) so no new styling is needed.
export default function AlbumsPage() {
  const { t } = useTranslation()
  const { data: albums = [], isLoading } = useQuery({
    queryKey: ['albums', 'all'],
    queryFn: () => fetchAlbums(),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <div className="loading"><Spinner size={28} label={t('library.loading')} /></div>

  return (
    <div className="page">
      <BackButton to="/" label={t('nav.artists')} />
      {/* clear the fixed top-left back button — this page opens with a bare
          title (no artwork above it) so the button would overlap it */}
      <h1 className="page-title" style={{ marginTop: 44 }}>{t('search.albums')}</h1>
      <div className="album-grid">
        {albums.map(al => (
          <Link key={al.id} to={`/album/${al.id}`} className="album-card">
            <div className="album-cover">
              {al.cover_url
                ? <img src={imgSrc(al.cover_url, 200)} alt={al.title} loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                : <span className="no-cover">♪</span>
              }
            </div>
            <div className="album-info">
              <span className="album-title">{al.title}</span>
              <span className="album-year">{al.artist_name}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
