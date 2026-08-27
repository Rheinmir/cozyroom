import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAlbums, imgSrc } from '../api'

function AlbumCoverImg({ url, title }: { url: string; title: string }) {
  const [err, setErr] = useState(false)
  if (!url || err) return <span className="no-cover">♪</span>
  return <img src={imgSrc(url, 300)} alt={title} loading="lazy" onError={() => setErr(true)} />
}

function ArtistHeroImg({ url, name }: { url: string; name: string }) {
  const [err, setErr] = useState(false)
  if (!url || err) return <>{name.charAt(0).toUpperCase()}</>
  return <img src={imgSrc(url, 400)} alt={name} onError={() => setErr(true)} />
}

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>()
  const { data: albums = [], isLoading } = useQuery({
    queryKey: ['albums', id],
    queryFn: () => fetchAlbums(id),
    staleTime: 5 * 60_000,
  })

  const artistName     = albums[0]?.artist_name ?? ''
  const artistImageUrl = albums[0]?.artist_image_url ?? ''

  if (isLoading) return <div className="loading">Loading…</div>

  return (
    <div className="page">
      <Link to="/" className="back-btn">← Artists</Link>
      <div className="artist-hero">
        <div className="artist-hero-avatar">
          <ArtistHeroImg url={artistImageUrl} name={artistName} />
        </div>
        <div>
          <p className="hero-type">Artist</p>
          <h1 className="hero-title">{artistName}</h1>
          <p className="hero-meta">{albums.length} album{albums.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <h2 className="section-title">Albums</h2>
      <div className="album-grid">
        {albums.map(al => (
          <Link key={al.id} to={`/album/${al.id}`} className="album-card">
            <div className="album-cover">
              <AlbumCoverImg url={al.cover_url} title={al.title} />
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
