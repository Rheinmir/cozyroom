// Client-side "continue watching / reading" memory. Kept in localStorage on
// purpose: it's a per-device convenience, needs no backend/DB change, and the
// server-side ebook `progress` field stays the source of truth for the page.

type VideoProg = { t: number; d: number; at: number }

const VKEY = 'video-progress'
const EKEY = 'ebook-last-opened'

function read<T>(key: string): Record<string, T> {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}

export function getVideoProgress(): Record<string, VideoProg> {
  return read<VideoProg>(VKEY)
}

export function saveVideoProgress(id: string, t: number, d: number) {
  if (!d || !isFinite(d)) return
  const all = getVideoProgress()
  all[id] = { t: Math.round(t), d: Math.round(d), at: Date.now() }
  try { localStorage.setItem(VKEY, JSON.stringify(all)) } catch {}
}

/** 0..1 watched fraction; ≥0.95 counts as finished. */
export function watchedFraction(p?: VideoProg) {
  return p && p.d ? Math.min(1, p.t / p.d) : 0
}

export function markEbookOpened(id: string) {
  const all = read<number>(EKEY)
  all[id] = Date.now()
  try { localStorage.setItem(EKEY, JSON.stringify(all)) } catch {}
}

export function getEbookOpened(): Record<string, number> {
  return read<number>(EKEY)
}

// ── Episode parsing ─────────────────────────────────────
// Library titles look like "Xem Phim Arcane- Liên Minh Huyền Thoại Vietsub -
// Arcane - Ep10": pull the episode number out and drop the scraped noise so
// cards can say "Tập 10" instead of repeating the whole string.
export function parseEpisode(title: string): number | null {
  const m = title.match(/(?:\bep(?:isode)?|\btập|\bt)\s*\.?\s*(\d{1,4})\b/i)
  return m ? parseInt(m[1], 10) : null
}

export function cleanVideoTitle(title: string): string {
  return title
    .replace(/^xem phim\s*/i, '')
    .replace(/\s*-\s*(?:ep(?:isode)?|tập)\s*\d+\s*$/i, '')
    .replace(/\bvietsub\b/ig, '')
    .replace(/\s+-\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
