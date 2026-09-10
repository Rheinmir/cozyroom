import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchPlayStats, fetchAlbums, fetchArtists, imgSrc } from '../api'
import type { Track } from '../types'
import { usePlayer } from '../PlayerContext'
import LibraryStatsBar from '../components/LibraryStatsBar'
import Spinner from '../components/Spinner'

// "Khám phá" — an editorial landing page (Apple Music /new-inspired): a hero row
// of featured albums, a multi-column "most played" track list, and horizontal
// album/artist shelves. Keeps the Midnight Deck palette; just borrows the
// section-layout variety (hero / multi-col list / shelf) so it isn't one flat grid.
export default function DiscoverPage() {
  const { t } = useTranslation()
  const { play } = usePlayer()
  const { data: playStats } = useQuery({ queryKey: ['stats', 'plays', 30], queryFn: () => fetchPlayStats(30), staleTime: 5 * 60_000 })
  const { data: albums = [], isLoading: albumsLoading } = useQuery({ queryKey: ['albums', 'all'], queryFn: () => fetchAlbums(), staleTime: 5 * 60_000 })
  const { data: artists = [] } = useQuery({ queryKey: ['artists'], queryFn: fetchArtists, staleTime: 5 * 60_000 })

  if (albumsLoading) return <div className="loading"><Spinner size={28} label={t('library.loading')} /></div>

  // TopPlayedTrack lacks album_id (the player needs it, e.g. for cover art);
  // derive it from cover_url (= /api/covers/<album_id>) so playing works.
  const toTrack = (tk: { id: string; title: string; artist_name: string; album_title: string; cover_url: string }): Track =>
    ({ ...tk, album_id: (tk.cover_url || '').split('/').pop() || '' }) as unknown as Track

  const top = playStats?.top ?? []
  const hero = albums.slice(0, 3)
  const shelfAlbums = albums.slice(3, 21)
  const shelfArtists = artists.slice(0, 18)
  const topTracks = top.slice(0, 12)

  return (
    <div className="page discover-page">
      <LibraryStatsBar />

      {hero.length > 0 && (
        <div className="discover-hero">
          {hero.map(al => (
            <Link key={al.id} to={`/album/${al.id}`} className="discover-hero-card">
              {al.cover_url
                ? <img src={imgSrc(al.cover_url, 600)} alt={al.title} loading="lazy" />
                : <div className="discover-hero-nocover">♪</div>}
              <div className="discover-hero-cap">
                <div className="discover-hero-title">{al.title}</div>
                <div className="discover-hero-sub">{al.artist_name}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {topTracks.length > 0 && (
        <section className="discover-section">
          <h2 className="discover-section-title">Nghe nhiều</h2>
          <div className="discover-tracks">
            {topTracks.map((tk, i) => (
              <button
                key={tk.id}
                className="discover-track"
                onClick={() => play(toTrack(tk), topTracks.map(toTrack))}
              >
                <span className="discover-track-num">{i + 1}</span>
                <span className="discover-track-cover">
                  {tk.cover_url ? <img src={imgSrc(tk.cover_url, 80)} alt="" loading="lazy" /> : <span className="no-cover">♪</span>}
                </span>
                <span className="discover-track-meta">
                  <span className="discover-track-title">{tk.title}</span>
                  <span className="discover-track-artist">{tk.artist_name}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {shelfAlbums.length > 0 && (
        <section className="discover-section">
          <h2 className="discover-section-title">{t('search.albums')}</h2>
          <div className="discover-shelf">
            {shelfAlbums.map(al => (
              <Link key={al.id} to={`/album/${al.id}`} className="discover-shelf-album">
                <div className="discover-shelf-cover">
                  {al.cover_url ? <img src={imgSrc(al.cover_url, 240)} alt={al.title} loading="lazy" /> : <span className="no-cover">♪</span>}
                </div>
                <div className="discover-shelf-title">{al.title}</div>
                <div className="discover-shelf-sub">{al.artist_name}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {shelfArtists.length > 0 && (
        <section className="discover-section">
          <h2 className="discover-section-title">{t('nav.artists')}</h2>
          <div className="discover-shelf">
            {shelfArtists.map(a => (
              <Link key={a.id} to={`/artist/${a.id}`} className="discover-shelf-artist">
                <div className="discover-shelf-avatar">
                  {a.image_url ? <img src={imgSrc(a.image_url, 200)} alt={a.name} loading="lazy" /> : <span>{a.name.charAt(0).toUpperCase()}</span>}
                </div>
                <div className="discover-shelf-title discover-shelf-title--center">{a.name}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
