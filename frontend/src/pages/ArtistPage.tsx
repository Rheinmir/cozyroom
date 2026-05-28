import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAlbums, imgSrc } from '../api'

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>()
  const { data: albums = [], isLoading } = useQuery({
    queryKey: ['albums', id],
    queryFn: () => fetchAlbums(id),
  })

  const artistName     = albums[0]?.artist_name ?? ''
  const artistImageUrl = albums[0]?.artist_image_url ?? ''

  if (isLoading) return <div className="loading">Loading…</div>

  return (
    <div className="page">
      <Link to="/" className="back-btn">← Artists</Link>
      <div className="artist-hero">
        <div className="artist-hero-avatar">
          {artistImageUrl
            ? <img src={imgSrc(artistImageUrl, 400)} alt={artistName} />
            : artistName.charAt(0).toUpperCase()
          }
        </div>
        <div>
          <p className="hero-type">Artist</p>
          <h1 className="hero-title">{artistName}</h1>
          <p className="hero-meta">{albums.length} albums</p>
        </div>
      </div>

      <h2 className="section-title">Albums</h2>
      <div className="album-grid">
        {albums.map(al => (
          <Link key={al.id} to={`/album/${al.id}`} className="album-card">
            <div className="album-cover">
              {al.cover_url
                ? <img src={imgSrc(al.cover_url, 300)} alt={al.title} loading="lazy" />
                : <span className="no-cover">♪</span>
              }
              <div className="album-play-overlay">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
              </div>
            </div>
            <div className="album-info">
              <span className="album-title">{al.title}</span>
              {al.year > 0 && <span className="album-year">{al.year}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
