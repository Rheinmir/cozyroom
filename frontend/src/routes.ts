import { generatePath, matchPath } from 'react-router-dom'

// Single source of truth for UI URLs. <Route path>, <Link to>, navigate() and
// pathname checks all take their strings from here.
//
// Scheme: /<module>/<collection>/<id>, plural collections.
//   music   /music ...            video   /video ...        read    /read/books, /read/comics
//   explore /explore/trending     system  /system/tools, /system/debug
//   ai      /ai, /ai/stats        notes   /notes
export const ROUTES = {
  home:       '/',                       // module hub (for now: redirects to /music)
  music:      '/music',                  // library home = Artists
  discover:   '/music/discover',
  artist:     '/music/artists/:id',
  album:      '/music/albums/:id',
  albums:     '/music/albums',
  tracks:     '/music/tracks',
  playlists:  '/music/playlists',
  search:     '/music/search',
  musicStats: '/music/stats',
  videos:     '/video',
  video:      '/video/:id',
  ebooks:     '/read/books',
  ebook:      '/read/books/:id',
  comics:     '/read/comics',
  trending:   '/explore/trending',
  notes:      '/notes',
  ai:         '/ai',
  aiStats:    '/ai/stats',
  tools:      '/system/tools',
  debug:      '/system/debug',
} as const

// Old URL -> new URL. Bookmarks, the installed PWA and links from other tools keep working.
// Each old path redirects (replace) and keeps ?query, #hash and router state.
// Remove after two releases (owner decides).
export const LEGACY_REDIRECTS: ReadonlyArray<readonly [old: string, to: string]> = [
  ['/discover',    ROUTES.discover],
  ['/artist/:id',  ROUTES.artist],
  ['/album/:id',   ROUTES.album],
  ['/albums',      ROUTES.albums],
  ['/tracks',      ROUTES.tracks],
  ['/playlists',   ROUTES.playlists],
  ['/search',      ROUTES.search],
  ['/stats/music', ROUTES.musicStats],
  ['/videos',      ROUTES.videos],
  ['/ebooks',      ROUTES.ebooks],
  ['/ebook/:id',   ROUTES.ebook],
  ['/comics',      ROUTES.comics],
  ['/trending',    ROUTES.trending],
  ['/tools',       ROUTES.tools],
  ['/debug',       ROUTES.debug],
]

type Id = string | number

// Builders for the routes that carry an id (or a query).
export const paths = {
  artist: (id: Id) => generatePath(ROUTES.artist, { id: String(id) }),
  album:  (id: Id) => generatePath(ROUTES.album,  { id: String(id) }),
  video:  (id: Id) => generatePath(ROUTES.video,  { id: String(id) }),
  ebook:  (id: Id) => generatePath(ROUTES.ebook,  { id: String(id) }),
  search: (q: string) => `${ROUTES.search}?q=${encodeURIComponent(q)}`,
}

// True when pathname is exactly this route (list pages), not a page below it.
export const isRoute = (pathname: string, route: string) => !!matchPath({ path: route, end: true }, pathname)
