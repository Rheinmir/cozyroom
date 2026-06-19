import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchArtists, fetchStats, imgSrc } from '../api'

function ArtistAvatar({ imageUrl, name }: { imageUrl: string; name: string }) {
  const [failed, setFailed] = useState(false)
  if (!imageUrl || failed) return <>{name.charAt(0).toUpperCase()}</>
  return <img src={imgSrc(imageUrl, 200)} alt={name} loading="lazy" onError={() => setFailed(true)} />
}

export default function ArtistsPage() {
  const { t } = useTranslation()
  const { data: artists = [], isLoading } = useQuery({ queryKey: ['artists'], queryFn: fetchArtists, staleTime: 5 * 60_000 })
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: fetchStats, staleTime: 5 * 60_000 })

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
              <ArtistAvatar imageUrl={a.image_url ?? ''} name={a.name} />
            </div>
            <span className="artist-name">{a.name}</span>
            <span className="artist-sub">{t('library.artist')}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
