import { generatePath } from 'react-router-dom'

// Single source of truth for UI URLs. <Route path>, <Link to>, navigate() and
// pathname checks all take their strings from here, so a later URL change
// (see the "mega homelab app" path standard) is an edit to this file only.
export const ROUTES = {
  home:       '/',            // library home = Artists
  discover:   '/discover',
  artist:     '/artist/:id',
  album:      '/album/:id',
  albums:     '/albums',
  tracks:     '/tracks',
  search:     '/search',
  videos:     '/videos',
  video:      '/video/:id',
  trending:   '/trending',
  ebooks:     '/ebooks',
  ebook:      '/ebook/:id',
  comics:     '/comics',
  playlists:  '/playlists',
  notes:      '/notes',
  ai:         '/ai',
  aiStats:    '/ai/stats',
  musicStats: '/stats/music',
  tools:      '/tools',
  debug:      '/debug',
} as const

type Id = string | number

// Builders for the routes that carry an id (or a query).
export const paths = {
  artist: (id: Id) => generatePath(ROUTES.artist, { id: String(id) }),
  album:  (id: Id) => generatePath(ROUTES.album,  { id: String(id) }),
  video:  (id: Id) => generatePath(ROUTES.video,  { id: String(id) }),
  ebook:  (id: Id) => generatePath(ROUTES.ebook,  { id: String(id) }),
  search: (q: string) => `${ROUTES.search}?q=${encodeURIComponent(q)}`,
}
