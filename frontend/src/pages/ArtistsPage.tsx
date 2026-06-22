import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchArtists, fetchStats, imgSrc } from '../api'

const AVATAR_GRADIENTS = [
  'radial-gradient(125% 125% at 30% 22%, oklch(0.64 0.17 262) 0%, oklch(0.4 0.13 300) 46%, oklch(0.17 0.06 340) 100%)',
  'radial-gradient(125% 125% at 30% 22%, oklch(0.70 0.18 45) 0%, oklch(0.46 0.15 20) 46%, oklch(0.20 0.06 355) 100%)',
  'radial-gradient(125% 125% at 70% 78%, oklch(0.65 0.14 185) 0%, oklch(0.42 0.12 210) 46%, oklch(0.18 0.05 230) 100%)',
  'radial-gradient(125% 125% at 30% 22%, oklch(0.67 0.19 345) 0%, oklch(0.43 0.14 310) 46%, oklch(0.18 0.06 280) 100%)',
  'radial-gradient(125% 125% at 70% 22%, oklch(0.65 0.15 145) 0%, oklch(0.41 0.12 170) 46%, oklch(0.18 0.05 200) 100%)',
  'radial-gradient(125% 125% at 30% 78%, oklch(0.55 0.20 240) 0%, oklch(0.35 0.15 270) 46%, oklch(0.15 0.07 300) 100%)',
  'radial-gradient(125% 125% at 30% 22%, oklch(0.60 0.22 290) 0%, oklch(0.38 0.16 320) 46%, oklch(0.16 0.07 350) 100%)',
  'radial-gradient(125% 125% at 70% 78%, oklch(0.62 0.20 20) 0%, oklch(0.40 0.15 350) 46%, oklch(0.18 0.06 320) 100%)',
]

function gradientFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length]
}

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
      <div className="library-tag">Thư viện</div>
      <h1 className="page-title">{t('nav.artists')}</h1>
      <div className="artist-grid">
        {artists.map(a => (
          <Link key={a.id} to={`/artist/${a.id}`} className="artist-card">
            <div className="artist-avatar" style={{ background: gradientFor(a.name) }}>
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
