import { useEffect, useState } from 'react'
import { usePlayer } from '../PlayerContext'
import { fetchLyrics } from '../api'
import type { LyricsData } from '../api'
import type { Track } from '../types'
import { cache, pickBest } from './LyricsView'
import { pickLine } from './lyricLine'

// Current + next lyric line for the vinyl screen. Shares LyricsView's sessionStorage cache.
// Fallback: first 2 plain lines, then track title + artist.
export function useLyricsLine(track: Track | null): { cur: string; next: string } {
  const { progress } = usePlayer()
  const id = track?.id
  const [data, setData] = useState<LyricsData | null>(null)

  useEffect(() => {
    setData(null)
    if (!id) return
    if (cache.has(id)) { const r = cache.get(id).results; setData(r[pickBest(r)] ?? null); return }
    const ac = new AbortController()
    fetchLyrics(id, ac.signal)
      .then(d => { cache.set(id, d.results, d.sources ?? [], d.cached); setData(d.results[pickBest(d.results)] ?? null) })
      .catch(() => {})
    return () => ac.abort()
  }, [id])

  const synced = data?.synced ?? []
  if (synced.length > 0) return pickLine(synced, progress)
  const plain = (data?.plain ?? '').split('\n').map(l => l.trim()).filter(Boolean)
  if (plain.length > 0) return { cur: plain[0], next: plain[1] ?? '' }
  return { cur: track?.title ?? '', next: track?.artist_name ?? '' }
}
