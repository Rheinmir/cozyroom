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

export const detectLyricsLanguage = (text: string) =>
  get<{ lang: string; confidence: number }>(`/api/lyrics/detect-language?text=${encodeURIComponent(text)}`)

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

// ---- Play stats ----
export const recordPlay = (trackId: string): Promise<void> =>
  fetch(`/api/tracks/${trackId}/play`, { method: 'POST' }).then(() => {})

export type TopPlayedTrack = {
  id: string
  title: string
  artist_name: string
  album_title: string
  cover_url: string
  plays: number
}
export type DailyPlayCount = { date: string; plays: number }
export type PlayStats = { top: TopPlayedTrack[]; daily: DailyPlayCount[] }

export const fetchPlayStats = (days = 30): Promise<PlayStats> =>
  get<PlayStats>(`/api/stats/plays?days=${days}`)

export const fetchMusicInsight = (): Promise<{ insight: string }> =>
  get<{ insight: string }>('/api/ai/music-insight')

export const backfillLastfmPlayCounts = (): Promise<void> =>
  fetch('/api/lastfm/backfill-play-counts', { method: 'POST' }).then(r => {
    if (!r.ok) throw new Error('backfill failed')
  })

export type LastfmBackfillStatus = { running: boolean; done: number; total: number; error: string }
export const fetchLastfmBackfillStatus = () => get<LastfmBackfillStatus>('/api/lastfm/backfill-play-counts')

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

// ---- Kanban ----
// Every kanban call carries EITHER the owner password (admin mode, unchanged
// since the original Kanban Quick Note feature) OR a logged-in user's
// session token — never both, never neither once past the gate screen.
export type KanbanCreds = { password?: string; token?: string }

const kanbanHeaders = (creds: KanbanCreds): Record<string, string> =>
  creds.password ? { 'X-Owner-Password': creds.password }
    : creds.token ? { 'X-Kanban-Session': creds.token }
    : {}

const kanbanFetch = <T>(url: string, creds: KanbanCreds, init: RequestInit = {}, action = 'kanban request'): Promise<T> =>
  fetch(url, { ...init, headers: { ...kanbanHeaders(creds), ...(init.headers || {}) } }).then(async r => {
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      throw new Error(err || `Failed ${action}: ${r.status}`)
    }
    return r.status === 204 ? (undefined as T) : (r.json() as Promise<T>)
  })

const kanbanJSON = <T>(url: string, method: string, body: unknown, creds: KanbanCreds, action = 'kanban request'): Promise<T> =>
  kanbanFetch<T>(url, creds, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, action)

// -- Auth (register/login are unauthenticated by definition; no creds yet) --
export const registerKanbanUser = (username: string, password: string): Promise<{ username: string; status: string }> =>
  fetch('/api/kanban/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).then(async r => {
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      throw new Error(err || `Đăng ký thất bại: ${r.status}`)
    }
    return r.json()
  })

export const loginKanbanUser = (username: string, password: string): Promise<{ token: string; username: string; color: string; expires_at: number }> =>
  fetch('/api/kanban/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).then(async r => {
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      throw new Error(err || `Đăng nhập thất bại: ${r.status}`)
    }
    return r.json()
  })

export const logoutKanbanUser = (token: string): Promise<void> =>
  fetch('/api/kanban/logout', { method: 'POST', headers: { 'X-Kanban-Session': token } }).then(() => undefined)

export type KanbanUser = { id: string; username: string; color: string }
export type KanbanPendingUser = { id: string; username: string; created_at: number }

export const listApprovedKanbanUsers = (creds: KanbanCreds) =>
  kanbanFetch<KanbanUser[]>('/api/kanban/users', creds, {}, 'to list users')
export const listPendingKanbanUsers = (password: string) =>
  kanbanFetch<KanbanPendingUser[]>('/api/kanban/admin/pending', { password }, {}, 'to list pending users')
export const approveKanbanUser = (id: string, password: string, boardId?: string, roleId?: string) =>
  kanbanJSON<void>(`/api/kanban/admin/users/${encodeURIComponent(id)}/approve`, 'POST',
    { board_id: boardId, role_id: roleId }, { password }, 'to approve user')
export const rejectKanbanUser = (id: string, password: string) =>
  kanbanFetch<void>(`/api/kanban/admin/users/${encodeURIComponent(id)}/reject`, { password }, { method: 'POST' }, 'to reject user')

// -- Boards / columns / labels --
export type KanbanBoard = { id: string; name: string; position: number; created_at: number }
export type KanbanColumn = { id: string; board_id: string; name: string; position: number }
export type KanbanLabel = { id: string; board_id: string; name: string; color: string }

export const listBoards = (creds: KanbanCreds) =>
  kanbanFetch<KanbanBoard[]>('/api/boards', creds, {}, 'to list boards')
export const createBoard = (name: string, creds: KanbanCreds) =>
  kanbanJSON<KanbanBoard>('/api/boards', 'POST', { name }, creds, 'to create board')
export const updateBoard = (id: string, patch: { name: string; position: number }, creds: KanbanCreds) =>
  kanbanJSON<void>(`/api/boards/${encodeURIComponent(id)}`, 'PUT', patch, creds, 'to update board')
export const deleteBoard = (id: string, creds: KanbanCreds) =>
  kanbanFetch<void>(`/api/boards/${encodeURIComponent(id)}`, creds, { method: 'DELETE' }, 'to delete board')

export const listColumns = (boardId: string, creds: KanbanCreds) =>
  kanbanFetch<KanbanColumn[]>(`/api/boards/${encodeURIComponent(boardId)}/columns`, creds, {}, 'to list columns')
export const createColumn = (boardId: string, name: string, creds: KanbanCreds) =>
  kanbanJSON<KanbanColumn>(`/api/boards/${encodeURIComponent(boardId)}/columns`, 'POST', { name }, creds, 'to create column')
export const updateColumn = (boardId: string, columnId: string, patch: { name: string; position: number }, creds: KanbanCreds) =>
  kanbanJSON<void>(`/api/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}`, 'PUT', patch, creds, 'to update column')
export const deleteColumn = (boardId: string, columnId: string, creds: KanbanCreds) =>
  kanbanFetch<void>(`/api/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}`, creds, { method: 'DELETE' }, 'to delete column')

export const listLabels = (boardId: string, creds: KanbanCreds) =>
  kanbanFetch<KanbanLabel[]>(`/api/boards/${encodeURIComponent(boardId)}/labels`, creds, {}, 'to list labels')
export const createLabel = (boardId: string, label: { name: string; color: string }, creds: KanbanCreds) =>
  kanbanJSON<KanbanLabel>(`/api/boards/${encodeURIComponent(boardId)}/labels`, 'POST', label, creds, 'to create label')
export const deleteLabel = (boardId: string, labelId: string, creds: KanbanCreds) =>
  kanbanFetch<void>(`/api/boards/${encodeURIComponent(boardId)}/labels/${encodeURIComponent(labelId)}`, creds, { method: 'DELETE' }, 'to delete label')

// -- Roles / members (per-board — role is a membership fact, not a global user attribute) --
export type KanbanBoardRole = { id: string; board_id: string; name: string; is_system: boolean }
export type KanbanBoardMember = { user_id: string; username: string; role_id: string; role_name: string }

export const listBoardRoles = (boardId: string, creds: KanbanCreds) =>
  kanbanFetch<KanbanBoardRole[]>(`/api/boards/${encodeURIComponent(boardId)}/roles`, creds, {}, 'to list roles')
export const listBoardMembers = (boardId: string, creds: KanbanCreds) =>
  kanbanFetch<KanbanBoardMember[]>(`/api/boards/${encodeURIComponent(boardId)}/members`, creds, {}, 'to list members')
export const upsertBoardMember = (boardId: string, userId: string, roleId: string, creds: KanbanCreds) =>
  kanbanJSON<void>(`/api/boards/${encodeURIComponent(boardId)}/members`, 'POST', { user_id: userId, role_id: roleId }, creds, 'to assign role')

// -- Notes --
export type KanbanNote = {
  id: string
  board_id: string
  column_id: string
  title: string
  content: string
  position: number
  priority: string
  due_date: number | null
  assigned_user_id: string
  label_ids: string[]
  subtask_total: number
  subtask_done: number
  created_at: number
  updated_at: number
}

export type KanbanNoteInput = {
  board_id: string
  column_id: string
  title: string
  content: string
  priority: string
  due_date: number | null
  assigned_user_id: string
  label_ids: string[]
}

export const listNotes = (boardId: string, creds: KanbanCreds) =>
  kanbanFetch<KanbanNote[]>(`/api/notes?board_id=${encodeURIComponent(boardId)}`, creds, {}, 'to list notes')
export const createNote = (note: KanbanNoteInput, creds: KanbanCreds) =>
  kanbanJSON<KanbanNote>('/api/notes', 'POST', note, creds, 'to create note')
export const updateNote = (id: string, note: KanbanNoteInput & { position: number }, creds: KanbanCreds) =>
  kanbanJSON<void>(`/api/notes/${encodeURIComponent(id)}`, 'PUT', note, creds, 'to update note')
export const deleteNote = (id: string, creds: KanbanCreds) =>
  kanbanFetch<void>(`/api/notes/${encodeURIComponent(id)}`, creds, { method: 'DELETE' }, 'to delete note')

// -- Subtasks / comments --
export type KanbanSubtask = { id: string; note_id: string; title: string; done: boolean; position: number }
export type KanbanComment = { id: string; note_id: string; author_label: string; content: string; created_at: number }

export const listSubtasks = (noteId: string, creds: KanbanCreds) =>
  kanbanFetch<KanbanSubtask[]>(`/api/notes/${encodeURIComponent(noteId)}/subtasks`, creds, {}, 'to list subtasks')
export const createSubtask = (noteId: string, title: string, creds: KanbanCreds) =>
  kanbanJSON<KanbanSubtask>(`/api/notes/${encodeURIComponent(noteId)}/subtasks`, 'POST', { title }, creds, 'to create subtask')
export const updateSubtask = (noteId: string, subtaskId: string, patch: { title: string; done: boolean; position: number }, creds: KanbanCreds) =>
  kanbanJSON<void>(`/api/notes/${encodeURIComponent(noteId)}/subtasks/${encodeURIComponent(subtaskId)}`, 'PUT', patch, creds, 'to update subtask')
export const deleteSubtask = (noteId: string, subtaskId: string, creds: KanbanCreds) =>
  kanbanFetch<void>(`/api/notes/${encodeURIComponent(noteId)}/subtasks/${encodeURIComponent(subtaskId)}`, creds, { method: 'DELETE' }, 'to delete subtask')

export const listComments = (noteId: string, creds: KanbanCreds) =>
  kanbanFetch<KanbanComment[]>(`/api/notes/${encodeURIComponent(noteId)}/comments`, creds, {}, 'to list comments')
export const createComment = (noteId: string, content: string, creds: KanbanCreds) =>
  kanbanJSON<KanbanComment>(`/api/notes/${encodeURIComponent(noteId)}/comments`, 'POST', { content }, creds, 'to create comment')
export const deleteComment = (noteId: string, commentId: string, creds: KanbanCreds) =>
  kanbanFetch<void>(`/api/notes/${encodeURIComponent(noteId)}/comments/${encodeURIComponent(commentId)}`, creds, { method: 'DELETE' }, 'to delete comment')

// ---- Debug / Request Log ----
export type RequestEntry = {
  time: number       // unix millis
  method: string
  path: string
  status: number
  duration_ms: number
}

export const fetchRequestLog = () => get<RequestEntry[]>('/api/debug/requests')
