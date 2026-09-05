import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { usePlayer } from '../PlayerContext'
import { imgSrc, searchYoutube, fetchYouTubeChannel, downloadYoutube, fetchGenres, fetchGenreDetail } from '../api'
import type { Artist, Album, Track } from '../types'
import type { YouTubeResult, Genre } from '../api'
import FavoritePill from '../components/FavoritePill'
import Spinner from '../components/Spinner'
import BackButton from '../components/BackButton'

type SearchResult = {
  artists: Artist[]
  albums:  Album[]
  tracks:  (Track & { album_title: string })[]
}

const fetchSearch = (q: string): Promise<SearchResult> =>
  fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json())

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

// ── YouTube result row (shared between search & channel mode) ─────────────
function YouTubeRow({
  r,
  localTracks,
  downloading,
  onStream,
  onDownload,
  onChannelClick,
}: {
  r: YouTubeResult
  localTracks: { title: string }[]
  downloading: Record<string, 'loading' | 'done' | 'failed'>
  onStream: (r: YouTubeResult) => void
  onDownload: (r: YouTubeResult) => void
  onChannelClick: (r: YouTubeResult) => void
}) {
  const { t } = useTranslation()
  const isLocal  = localTracks.some(t => t.title.toLowerCase() === r.title.toLowerCase())
  const dlState  = downloading[r.id] || (isLocal ? 'done' : undefined)

  return (
    <div className="youtube-result">
      <img
        className="youtube-thumb"
        src={`https://i.ytimg.com/vi/${r.id}/mqdefault.jpg`}
        alt={r.title}
        loading="lazy"
      />
      <div className="youtube-info">
        <div className="youtube-title">{r.title}</div>
        {r.channel_url ? (
          <button
            className="youtube-uploader youtube-uploader--link"
            onClick={() => onChannelClick(r)}
            title={`Xem video của kênh ${r.uploader}`}
          >
            {r.uploader}
          </button>
        ) : (
          <div className="youtube-uploader">{r.uploader}</div>
        )}
      </div>
      <span className="youtube-dur">{fmtDuration(r.duration)}</span>
      <div className="youtube-actions">
        <button
          className="youtube-btn youtube-btn--stream"
          onClick={() => onStream(r)}
        >
          {t('youtube.stream')}
        </button>
        <button
          className={`youtube-btn youtube-btn--download${dlState === 'loading' ? ' youtube-btn--downloading' : ''}${dlState === 'done' ? ' youtube-btn--done' : ''}`}
          onClick={() => onDownload(r)}
          disabled={!!dlState}
        >
          {dlState === 'loading' ? t('youtube.downloading') :
           dlState === 'done'    ? t('youtube.downloaded')  :
           dlState === 'failed'  ? t('youtube.failed')      :
           t('youtube.download')}
        </button>
      </div>
    </div>
  )
}

// ── Channel view ──────────────────────────────────────────────────────────
function ChannelView({
  channelUrl,
  channelName,
  localTracks,
  downloading,
  onStream,
  onDownload,
  onBack,
}: {
  channelUrl: string
  channelName: string
  localTracks: { title: string }[]
  downloading: Record<string, 'loading' | 'done' | 'failed'>
  onStream: (r: YouTubeResult) => void
  onDownload: (r: YouTubeResult) => void
  onBack: () => void
}) {
  const { t } = useTranslation()

  // Browse mode state
  const [videos, setVideos] = useState<YouTubeResult[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  // Search mode state
  const [searchInput, setSearchInput] = useState('')
  const [activeQuery, setActiveQuery] = useState('')   // committed query
  const [searchResults, setSearchResults] = useState<YouTubeResult[]>([])

  // Shared loading state
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)

  const isSearchMode = activeQuery !== ''

  // Initial browse load
  useEffect(() => {
    setVideos([])
    setOffset(0)
    setHasMore(true)
    loadPage(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelUrl])

  const loadPage = async (pageOffset: number) => {
    setIsLoading(true)
    setIsError(false)
    try {
      const result = await fetchYouTubeChannel(channelUrl, pageOffset)
      setVideos(prev => {
        const seen = new Set(prev.map(v => v.id))
        return [...prev, ...result.filter(v => !seen.has(v.id))]
      })
      if (result.length < 20) setHasMore(false)
      setOffset(pageOffset + 20)
    } catch {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }

  const doSearch = async (q: string) => {
    if (!q.trim()) return
    setActiveQuery(q)
    setSearchResults([])
    setIsLoading(true)
    setIsError(false)
    try {
      const result = await fetchYouTubeChannel(channelUrl, 0, q)
      setSearchResults(result)
    } catch {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }

  const clearSearch = () => {
    setSearchInput('')
    setActiveQuery('')
    setSearchResults([])
    setIsError(false)
  }

  const displayedVideos = isSearchMode ? searchResults : videos

  return (
    <div className="page">
      <BackButton onClick={onBack} label={t('search.title')} />

      <div className="channel-header">
        <div className="channel-avatar">{channelName.charAt(0).toUpperCase()}</div>
        <div>
          <p className="hero-type">YouTube Channel</p>
          <h1 className="hero-title">{channelName}</h1>
          {!isSearchMode && videos.length > 0 && (
            <p className="hero-meta">{videos.length} videos loaded</p>
          )}
          {isSearchMode && (
            <p className="hero-meta">Search results for "{activeQuery}"</p>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="channel-search-bar">
        <div className="channel-search-input-wrap">
          <span className="channel-search-icon">🔍</span>
          <input
            className="channel-search-input"
            type="text"
            placeholder={`Search in ${channelName}…`}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') doSearch(searchInput)
              if (e.key === 'Escape') clearSearch()
            }}
          />
          {searchInput && (
            <button className="channel-search-clear" onClick={clearSearch} title="Clear">✕</button>
          )}
        </div>
        <button
          className="channel-search-btn"
          onClick={() => doSearch(searchInput)}
          disabled={!searchInput.trim() || isLoading}
        >
          Search
        </button>
      </div>

      <h2 className="section-title">
        {isSearchMode
          ? `Results for "${activeQuery}"`
          : t('youtube.latest_videos', { defaultValue: 'Latest Videos' })}
      </h2>

      {isError && displayedVideos.length === 0 && (
        <p className="text-muted">
          {isSearchMode ? 'Search failed. Please try again.' : 'Failed to load channel videos. Please try again.'}
        </p>
      )}

      {!isLoading && !isError && displayedVideos.length === 0 && (
        <p className="text-muted">
          {isSearchMode ? `No results found for "${activeQuery}".` : 'No videos found for this channel.'}
        </p>
      )}

      {displayedVideos.length > 0 && (
        <div className="youtube-list">
          {displayedVideos.map(r => (
            <YouTubeRow
              key={r.id}
              r={r}
              localTracks={localTracks}
              downloading={downloading}
              onStream={onStream}
              onDownload={onDownload}
              onChannelClick={() => {}}
            />
          ))}
        </div>
      )}

      {/* Load more — only in browse mode */}
      {!isSearchMode && (
        <div className="channel-load-more">
          {isLoading && (
            <div className="channel-loading">
              <div className="channel-spinner" />
              <span>Loading…</span>
            </div>
          )}
          {!isLoading && hasMore && videos.length > 0 && (
            <button className="load-more-btn" onClick={() => loadPage(offset)}>
              Load 20 more
            </button>
          )}
          {!isLoading && !hasMore && videos.length > 0 && (
            <p className="text-muted" style={{ textAlign: 'center', padding: '16px 0' }}>
              All videos loaded ({videos.length} total)
            </p>
          )}
          {isError && videos.length > 0 && (
            <p className="text-muted" style={{ textAlign: 'center' }}>
              Failed to load more.{' '}
              <button className="load-more-btn" onClick={() => loadPage(offset)}>Retry</button>
            </p>
          )}
        </div>
      )}

      {/* Search loading indicator */}
      {isSearchMode && isLoading && (
        <div className="channel-loading" style={{ padding: '40px 0' }}>
          <div className="channel-spinner" />
          <span>Searching…</span>
        </div>
      )}
    </div>
  )
}

// ── Browse-by-genre grid (Apple-Music-style duotone tiles) ────────────────
// Deliberate, scoped exception to the One Accent Rule — see "The Genre Tile
// Color Rule" in DESIGN.md. Palette is local to this grid only.
const GENRE_PALETTE_SIZE = 6

function GenreGrid({ genres, onSelect }: { genres: Genre[]; onSelect: (name: string) => void }) {
  return (
    <div className="genre-grid">
      {genres.map((g, i) => (
        <button
          key={g.name}
          type="button"
          className={`genre-tile genre-tile--${i % GENRE_PALETTE_SIZE}`}
          onClick={() => onSelect(g.name)}
        >
          {g.cover_url && (
            <img className="genre-tile-img" src={imgSrc(g.cover_url, 300)} alt="" loading="lazy" />
          )}
          <div className="genre-tile-overlay" />
          <span className="genre-tile-label">{g.name}</span>
        </button>
      ))}
    </div>
  )
}

// ── Main SearchPage ───────────────────────────────────────────────────────
export default function SearchPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const { play } = usePlayer()

  const [downloading, setDownloading] = useState<Record<string, 'loading' | 'done' | 'failed'>>({})

  // channel mode state
  const [selectedChannel, setSelectedChannel] = useState<{ url: string; name: string } | null>(null)

  // Browse-by-genre state (only relevant while the search box is empty)
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  useEffect(() => { if (q) setSelectedGenre(null) }, [q])

  const { data: genres } = useQuery({
    queryKey: ['genres'],
    queryFn:  fetchGenres,
    enabled:  !q,
  })

  const { data: genreDetail, isLoading: genreLoading } = useQuery({
    queryKey: ['genre-detail', selectedGenre],
    queryFn:  () => fetchGenreDetail(selectedGenre!),
    enabled:  !q && !!selectedGenre,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['search', q],
    queryFn:  () => fetchSearch(q),
    enabled:  q.length >= 2,
  })

  const { data: ytResults } = useQuery({
    queryKey: ['youtube-search', q],
    queryFn:  () => searchYoutube(q),
    enabled:  q.length >= 2,
  })

  const handleStream = (r: YouTubeResult) => {
    const ytTrack: Track = {
      id: `yt:${r.id}`,
      album_id: `yt:${r.id}`,
      title: r.title,
      track_num: 1,
      duration_s: r.duration,
      artist_name: r.uploader,
      artist_id: '',
      album_title: r.uploader,
    }
    play(ytTrack)
  }

  const handleDownload = async (r: YouTubeResult) => {
    setDownloading(prev => ({ ...prev, [r.id]: 'loading' }))
    try {
      await downloadYoutube(r.id, r.title, r.uploader)
      setDownloading(prev => ({ ...prev, [r.id]: 'done' }))
    } catch {
      setDownloading(prev => ({ ...prev, [r.id]: 'failed' }))
    }
  }

  const handleChannelClick = (r: YouTubeResult) => {
    if (r.channel_url) {
      setSelectedChannel({ url: r.channel_url, name: r.uploader })
    }
  }

  // ── Channel mode ─────────────────────────────────────────────────────────
  if (selectedChannel) {
    return (
      <ChannelView
        channelUrl={selectedChannel.url}
        channelName={selectedChannel.name}
        localTracks={data?.tracks ?? []}
        downloading={downloading}
        onStream={handleStream}
        onDownload={handleDownload}
        onBack={() => setSelectedChannel(null)}
      />
    )
  }

  // ── Empty query: Browse-by-genre (or genre drill-down) ───────────────────
  if (!q) {
    if (selectedGenre) {
      const genreAlbums = genreDetail?.albums ?? []
      const genreTracks = genreDetail?.tracks ?? []
      return (
        <div className="page">
          <BackButton onClick={() => setSelectedGenre(null)} label={t('search.back_to_genres')} />
          <h1 className="page-title">{selectedGenre}</h1>

          {genreLoading ? (
            <div className="loading"><Spinner size={28} label={t('search.searching')} /></div>
          ) : (
            <>
              {genreAlbums.length > 0 && (
                <section className="search-section">
                  <h2 className="section-title">{t('search.albums')}</h2>
                  <div className="album-grid">
                    {genreAlbums.map(al => (
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
                </section>
              )}

              {genreTracks.length > 0 && (
                <section className="search-section">
                  <h2 className="section-title">{t('search.tracks')}</h2>
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
                      {genreTracks.map((t2, i) => (
                        <tr
                          key={t2.id}
                          className="track-row"
                          onClick={() => play(t2)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(t2) } }}
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
                </section>
              )}

              {genreAlbums.length === 0 && genreTracks.length === 0 && (
                <p className="text-muted">{t('search.no_results')}</p>
              )}
            </>
          )}
        </div>
      )
    }

    return (
      <div className="page">
        <h1 className="page-title">{t('search.title')}</h1>
        {genres && genres.length > 0 ? (
          <>
            <h2 className="section-title">{t('search.browse_genres')}</h2>
            <GenreGrid genres={genres} onSelect={setSelectedGenre} />
          </>
        ) : (
          <p className="text-muted">{t('search.hint')}</p>
        )}
      </div>
    )
  }

  if (isLoading) return <div className="loading"><Spinner size={28} label={t('search.searching')} /></div>

  const { artists = [], albums = [], tracks = [] } = data ?? {}
  const empty = artists.length + albums.length + tracks.length === 0

  return (
    <div className="page">
      <h1 className="page-title">{t('search.results_for', { q })}</h1>

      {empty && (
        <div className="search-empty-ai">
          <p className="text-muted">{t('search.no_results')}</p>
          <p className="text-muted">{t('search.ask_ai')}</p>
          <Link to="/ai" state={{ prompt: q }} className="search-ask-ai-btn">
            {t('search.ask_ai_button')}
          </Link>
        </div>
      )}

      {artists.length > 0 && (
        <section className="search-section">
          <h2 className="section-title">{t('search.artists')}</h2>
          <div className="search-artist-list">
            {artists.map(a => (
              <Link key={a.id} to={`/artist/${a.id}`} className="search-artist-row">
                <div className="search-avatar">{a.name.charAt(0).toUpperCase()}</div>
                <div>
                  <p className="search-row-title">{a.name}</p>
                  <p className="search-row-sub">{t('search.artist')}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {albums.length > 0 && (
        <section className="search-section">
          <h2 className="section-title">{t('search.albums')}</h2>
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
        </section>
      )}

      {tracks.length > 0 && (
        <section className="search-section">
          <h2 className="section-title">{t('search.tracks')}</h2>
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
                  onClick={() => play(t2)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(t2) } }}
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
        </section>
      )}

      {ytResults && ytResults.length > 0 && (
        <section className="search-section">
          <h2 className="section-title">{t('youtube.title')}</h2>
          <div className="youtube-list">
            {ytResults.map(r => (
              <YouTubeRow
                key={r.id}
                r={r}
                localTracks={tracks}
                downloading={downloading}
                onStream={handleStream}
                onDownload={handleDownload}
                onChannelClick={handleChannelClick}
              />
            ))}
          </div>
        </section>
      )}

      {ytResults && ytResults.length === 0 && empty && (
        <p className="text-muted">{t('youtube.no_results')}</p>
      )}
    </div>
  )
}
