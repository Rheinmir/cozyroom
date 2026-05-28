import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchArtists, fetchStats, imgSrc } from '../api'

export default function ArtistsPage() {
  const { t } = useTranslation()
  const { data: artists = [], isLoading } = useQuery({ queryKey: ['artists'], queryFn: fetchArtists })
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: fetchStats })

  if (isLoading) return <div className="loading">{t('library.loading')}</div>

  return (
    <div className="page">
      {stats && (
        <div className="stats-bar">
          <span>{stats.artists} {t('search.artists').toLowerCase()}</span>
          <span>{stats.albums} {t('search.albums').toLowerCase()}</span>
          <span>{stats.tracks} {t('search.tracks').toLowerCase()}</span>
        </div>
      )}
      <h1 className="page-title">{t('nav.artists')}</h1>
      <div className="artist-grid">
        {artists.map(a => (
          <Link key={a.id} to={`/artist/${a.id}`} className="artist-card">
            <div className="artist-avatar">
              {a.image_url
                ? <img src={imgSrc(a.image_url, 200)} alt={a.name} loading="lazy" />
                : a.name.charAt(0).toUpperCase()
              }
            </div>
            <span className="artist-name">{a.name}</span>
            <span className="artist-sub">{t('library.artist')}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
