import type { Artist, Album, Track, Stats } from './types'

const RESIZABLE_RE = /^\/api\/(covers|artist-images|ebook-covers)\//
export const imgSrc = (url: string | undefined, w: number): string => {
  if (!url) return ''
  return RESIZABLE_RE.test(url) ? `${url}?w=${w}` : url
}

const get = <T>(url: string): Promise<T> =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`${r.status} ${url}`)
    return r.json() as Promise<T>
  })

export type ArtistDetail = { id: string; name: string; album_count: number; track_count: number; genres: string[] }

export const fetchStats        = ()               => get<Stats>('/api/stats')
export const fetchArtistDetail = (id: string)     => get<ArtistDetail>(`/api/artists/${id}`)
export const fetchArtists = ()              => get<Artist[]>('/api/artists')
export const fetchAlbums  = (artistId?: string) =>
  get<Album[]>(`/api/albums${artistId ? `?artist_id=${artistId}` : ''}`)
export const fetchAlbum   = (albumId: string)   => get<Album>(`/api/albums/${albumId}`)
export const fetchTracks  = (albumId: string)   =>
  get<Track[]>(`/api/tracks?album_id=${albumId}`)
export const streamUrl        = (trackId: string)   => `/stream/${trackId}`
export const fetchSmartQueue  = (trackId: string)   => get<Track[]>(`/api/smart-queue?track_id=${trackId}&limit=30`)

export type LyricLine    = { time: number; text: string }
export type LyricsData   = { synced: LyricLine[]; plain: string; source: string }
export type SourceInfo   = { source: string; found: boolean; lines: number; err?: string }
export type LyricsMulti  = { results: LyricsData[]; sources: SourceInfo[]; cached: boolean }

export const fetchLyrics = (trackId: string, signal?: AbortSignal) =>
  signal
    ? fetch(`/api/lyrics/${trackId}`, { signal }).then(r => {
        if (!r.ok) throw new Error(`${r.status} /api/lyrics/${trackId}`)
        return r.json() as Promise<LyricsMulti>
      })
    : get<LyricsMulti>(`/api/lyrics/${trackId}`)

export const saveLyrics = (trackId: string, lrc: string): Promise<void> =>
  fetch(`/api/lyrics/${trackId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lrc }),
  }).then(async r => {
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      throw new Error(`HTTP ${r.status}${body ? ': ' + body.trim() : ''}`)
    }
  })

export const bustLyricsCache = (trackId: string): Promise<void> =>
  fetch(`/api/lyrics/${trackId}`, { method: 'DELETE' }).then(() => {})

export const fetchLyricsTranslation = (trackId: string, lang = 'vi') =>
  get<{ lines: string[] }>(`/api/lyrics/${trackId}/translate?lang=${lang}`)

// Last.fm
export type LastfmStatus = { connected: boolean; username: string; configured: boolean }

export const fetchLastfmStatus = () => get<LastfmStatus>('/api/lastfm/status')

export const lastfmNowPlaying = (artist: string, track: string, album: string): Promise<void> =>
  fetch('/api/lastfm/now-playing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artist, track, album }),
  }).then(() => {})

export const lastfmScrobble = (artist: string, track: string, album: string, timestamp: number): Promise<void> =>
  fetch('/api/lastfm/scrobble', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artist, track, album, timestamp }),
  }).then(() => {})

// ---- Scraper (Comics) ----
export type ComicResult = {
  id: string; name?: string; title?: string; token?: string
  cover: string; uploader?: string; description?: string
  status?: string; year?: number; tags?: string | string[]; language?: string
  fileSize?: number; pages?: number; link: string; rating?: string
}

export type ComicsDownload = {
  id: string
  source: string
  title: string
  cover: string
  token?: string
  local_dir: string
  page_count: number
  downloaded: number
  status: 'idle' | 'queued' | 'downloading' | 'done' | 'failed'
  error?: string
  created_at: number
  updated_at: number
}

export type LocalChapter = { id: string; page_count: number }

export const fetchDownloads = () => get<ComicsDownload[]>('/api/scraper/downloads')
export const deleteDownload = (id: string): Promise<void> =>
  fetch(`/api/scraper/downloads/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => {})
export const retryDownload = (id: string): Promise<void> =>
  fetch(`/api/scraper/downloads/${encodeURIComponent(id)}/retry`, { method: 'POST' }).then(() => {})
export const enqueueEHDownload = (gid: string, token: string): Promise<void> =>
  fetch(`/api/scraper/enqueue/eh/${encodeURIComponent(gid)}/${encodeURIComponent(token)}`, { method: 'POST' }).then(() => {})
export const enqueueMDDownload = (mangaId: string): Promise<void> =>
  fetch(`/api/scraper/enqueue/md/${encodeURIComponent(mangaId)}`, { method: 'POST' }).then(() => {})
export const fetchLocalChapters = (id: string) =>
  get<LocalChapter[]>(`/api/scraper/local/${encodeURIComponent(id)}/chapters`)

export type EHentaiPage = { index: number; link: string }

export type LatestResponse = { results: ComicResult[]; fetchedAt?: string }

export const fetchLatestMangaDex = () =>
  get<LatestResponse>('/api/scraper/md/latest')

export const fetchLatestEHentai = () =>
  get<LatestResponse>('/api/scraper/eh/latest')

export const searchMangaDex = (q: string) =>
  get<{ results: ComicResult[] }>(`/api/scraper/md/search?q=${encodeURIComponent(q)}`)

export const fetchMangaChapters = (id: string) =>
  get<Array<{ id: string; chapter: string; title: string; volume: string; group: string; uploaded: string }>>(
    `/api/scraper/md/chapters/${id}`
  )

export const fetchMangaPages = (id: string) =>
  get<string[]>(`/api/scraper/md/pages/${id}`)

export const searchEHentai = (q: string, page?: number) =>
  get<{ results: ComicResult[]; nextPage: number }>(
    `/api/scraper/eh/search?q=${encodeURIComponent(q)}${page ? '&page=' + page : ''}`
  )

export const fetchEHentaiDetail = (url: string) =>
  get<ComicResult>(`/api/scraper/eh/detail?url=${encodeURIComponent(url)}`)

export const fetchEHentaiPages = (url: string) =>
  get<EHentaiPage[]>(`/api/scraper/eh/pages?url=${encodeURIComponent(url)}`)

// ---- Trending ----
export type TrendingRepo = {
  id: string
  name: string
  url: string
  language: string
  topics: string[]
  stars: number
  star_delta: number
  problem_solved: string
  tech_used: string
  simple_flow: string
  impact_score: number
  impact_label: string
}

export type StarPoint = { sampled_at: string; stars: number }

// ---- YouTube ----
export type YouTubeResult = {
  id: string
  title: string
  duration: number
  thumbnail: string
  uploader: string
  channel_url: string
}

export const searchYoutube = (q: string): Promise<YouTubeResult[]> =>
  get<YouTubeResult[]>(`/api/youtube/search?q=${encodeURIComponent(q)}`)

export const fetchYouTubeChannel = (url: string, offset = 0, q = ''): Promise<YouTubeResult[]> => {
  const params = new URLSearchParams({ url, offset: String(offset) })
  if (q) params.set('q', q)
  return get<YouTubeResult[]>(`/api/youtube/channel?${params}`)
}

export const downloadYoutube = (id: string, title?: string, artist?: string): Promise<{ status: string; tracks_scanned: number }> =>
  fetch('/api/youtube/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, title, artist }),
  }).then(r => {
    if (!r.ok) throw new Error(`download failed: ${r.status}`)
    return r.json()
  })

export const fetchTrending = (date?: string) =>
  get<TrendingRepo[]>(`/api/trending${date ? `?date=${date}` : ''}`)

export const fetchTrendingDates = () => get<string[]>('/api/trending/dates')

export const fetchTrendingHistory = (id: string) =>
  get<StarPoint[]>(`/api/trending/history?id=${encodeURIComponent(id)}`)

export const triggerTrendingRefresh = () =>
  fetch('/api/trending/refresh', { method: 'POST' }).then(r => r.json())

// ---- Playlists ----
export type Playlist = {
  id: string
  name: string
  created_at?: number
  track_ids: string[]
  cover_ids?: string[]
  is_local?: boolean
}

export const fetchPlaylists = (): Promise<Playlist[]> =>
  get<Playlist[]>('/api/playlists')

export const fetchPlaylistTracks = (id: string): Promise<Track[]> =>
  get<Track[]>(`/api/playlists/${encodeURIComponent(id)}/tracks`)

export const createPlaylist = (name: string, password?: string): Promise<Playlist> =>
  fetch('/api/playlists', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(password ? { 'X-Owner-Password': password } : {})
    },
    body: JSON.stringify({ name }),
  }).then(async r => {
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      throw new Error(err || `Failed to create playlist: ${r.status}`)
    }
    return r.json() as Promise<Playlist>
  })

export const deletePlaylist = (id: string, password?: string): Promise<void> =>
  fetch(`/api/playlists/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: password ? { 'X-Owner-Password': password } : {},
  }).then(async r => {
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      throw new Error(err || `Failed to delete playlist: ${r.status}`)
    }
  })

export const addTrackToPlaylist = (playlistId: string, trackId: string, password?: string): Promise<void> =>
  fetch(`/api/playlists/${encodeURIComponent(playlistId)}/tracks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(password ? { 'X-Owner-Password': password } : {})
    },
    body: JSON.stringify({ track_id: trackId }),
  }).then(async r => {
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      throw new Error(err || `Failed to add track: ${r.status}`)
    }
  })

export const removeTrackFromPlaylist = (playlistId: string, trackId: string, password?: string): Promise<void> =>
  fetch(`/api/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`, {
    method: 'DELETE',
    headers: password ? { 'X-Owner-Password': password } : {},
  }).then(async r => {
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      throw new Error(err || `Failed to remove track: ${r.status}`)
    }
  })
