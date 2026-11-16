import type { Playlist } from './api'

// Accent-insensitive fold so "nhac buon" finds "Nhạc buồn".
export const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()

// Playlists whose name contains the query. Names that start with it come first,
// then shorter names; duplicates (same id local + server) keep the first one.
export function matchPlaylists(lists: Playlist[], q: string): Playlist[] {
  const needle = fold(q)
  if (needle.length < 1) return []
  const seen = new Set<string>()
  return lists
    .filter(p => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return fold(p.name).includes(needle)
    })
    .map(p => ({ p, n: fold(p.name) }))
    .sort((a, b) => Number(b.n.startsWith(needle)) - Number(a.n.startsWith(needle)) || a.n.length - b.n.length)
    .map(x => x.p)
}
