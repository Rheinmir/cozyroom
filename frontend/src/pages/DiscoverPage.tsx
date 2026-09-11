import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchPlayStats, fetchAlbums, fetchArtists, fetchTracks, fetchSmartQueue, imgSrc, COVER_PLACEHOLDER } from '../api'
import type { Track } from '../types'
import { usePlayer } from '../PlayerContext'
import LibraryStatsBar from '../components/LibraryStatsBar'
import Spinner from '../components/Spinner'

const cover = (albumId: string, w: number) => imgSrc(`/api/covers/${albumId}`, w)

// Fisher-Yates, seeded off the array length + a rotating salt so the mix is
// fresh-ish per mount but stable across a render pass (not re-shuffled on every
// re-render, which would make rows jump around).
function shuffle<T>(arr: T[], salt: number): T[] {
  const a = [...arr]
  let seed = a.length * 2654435761 + salt
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

function TrackList({ title, tracks, onPlay }: { title: string; tracks: Track[]; onPlay: (t: Track) => void }) {
  if (!tracks.length) return null
  return (
    <section className="discover-section">
      <h2 className="discover-section-title">{title}</h2>
      <div className="discover-tracks">
        {tracks.map((t, i) => (
          <button key={t.id + i} className="discover-track" onClick={() => onPlay(t)}>
            <span className="discover-track-num">{i + 1}</span>
            <span className="discover-track-cover">
              <img
                src={t.album_id ? cover(t.album_id, 80) : COVER_PLACEHOLDER}
                alt=""
                loading="lazy"
                onError={e => { const img = e.currentTarget; if (!img.src.endsWith(COVER_PLACEHOLDER)) img.src = COVER_PLACEHOLDER }}
              />
            </span>
            <span className="discover-track-meta">
              <span className="discover-track-title">{t.title}</span>
              <span className="discover-track-artist">{t.artist_name}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

// "Khám phá" — a discovery landing page. The centrepiece is an algorithmic mix
// (mostly tracks the listener has NOT been playing, sprinkled with a few
// familiar ones) plus a song-analysis row from the smart-queue engine — not
// just a "most played" list.
export default function DiscoverPage() {
  const { t } = useTranslation()
  const { play } = usePlayer()
  const { data: playStats } = useQuery({ queryKey: ['stats', 'plays', 90], queryFn: () => fetchPlayStats(90), staleTime: 5 * 60_000 })
  const { data: allTracks = [], isLoading } = useQuery({ queryKey: ['tracks', 'all'], queryFn: () => fetchTracks(''), staleTime: 5 * 60_000 })
  const { data: albums = [] } = useQuery({ queryKey: ['albums', 'all'], queryFn: () => fetchAlbums(), staleTime: 5 * 60_000 })
  const { data: artists = [] } = useQuery({ queryKey: ['artists'], queryFn: fetchArtists, staleTime: 5 * 60_000 })

  const top = playStats?.top ?? []
  const seed = top[0]
  const { data: smart = [] } = useQuery({
    queryKey: ['smart-queue', seed?.id],
    queryFn: () => fetchSmartQueue(seed!.id),
    enabled: !!seed?.id,
    staleTime: 5 * 60_000,
  })

  // The discovery mix: unplayed tracks shuffled, with a few familiar ones
  // sprinkled in so it feels grounded, not random noise.
  const discovery = useMemo(() => {
    if (!allTracks.length) return []
    const topIds = new Set(top.map(x => x.id))
    const familiar = allTracks.filter(x => topIds.has(x.id))
    const fresh = shuffle(allTracks.filter(x => !topIds.has(x.id)), top.length)
    const mix: Track[] = []
    let fi = 0
    fresh.slice(0, 12).forEach((tk, i) => {
      mix.push(tk)
      if ((i + 1) % 4 === 0 && fi < familiar.length && fi < 3) mix.push(familiar[fi++])
    })
    return mix.slice(0, 14)
  }, [allTracks, top])

  if (isLoading) return <div className="loading"><Spinner size={28} label={t('library.loading')} /></div>

  const hero = albums.slice(0, 3)
  const shelfAlbums = albums.slice(3, 21)
  const shelfArtists = artists.slice(0, 18)

  return (
    <div className="page discover-page">
      <LibraryStatsBar />

      {hero.length > 0 && (
        <div className="discover-hero">
          {hero.map(al => (
            <Link key={al.id} to={`/album/${al.id}`} className="discover-hero-card">
              <img
                src={al.cover_url ? imgSrc(al.cover_url, 600) : COVER_PLACEHOLDER}
                alt={al.title}
                loading="lazy"
                onError={e => { const img = e.currentTarget; if (!img.src.endsWith(COVER_PLACEHOLDER)) img.src = COVER_PLACEHOLDER }}
              />
              <div className="discover-hero-cap">
                <div className="discover-hero-title">{al.title}</div>
                <div className="discover-hero-sub">{al.artist_name}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <TrackList title="Khám phá cho bạn" tracks={discovery} onPlay={tk => play(tk, discovery)} />

      {seed && smart.length > 0 && (
        <TrackList title={`Gợi ý từ "${seed.title}"`} tracks={smart.slice(0, 12)} onPlay={tk => play(tk, smart)} />
      )}

      {shelfAlbums.length > 0 && (
        <section className="discover-section">
          <h2 className="discover-section-title">{t('search.albums')}</h2>
          <div className="discover-shelf">
            {shelfAlbums.map(al => (
              <Link key={al.id} to={`/album/${al.id}`} className="discover-shelf-album">
                <div className="discover-shelf-cover">
                  <img
                    src={al.cover_url ? imgSrc(al.cover_url, 240) : COVER_PLACEHOLDER}
                    alt={al.title}
                    loading="lazy"
                    onError={e => { const img = e.currentTarget; if (!img.src.endsWith(COVER_PLACEHOLDER)) img.src = COVER_PLACEHOLDER }}
                  />
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
