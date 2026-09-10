import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchStats } from '../api'

type Section = 'artists' | 'albums' | 'tracks'

// The library cross-nav strip that sits atop the Artists / Albums / Tracks
// pages: three figure chips where the two sections you are NOT currently on
// are tappable links. Kept as one component so the three pages can't drift
// apart. The ['stats'] query is deduped by react-query, so mounting this on
// every library page costs a single shared request.
// `current` may be omitted (e.g. on the Discover page, which is none of the
// three sections) — then all three chips render as links.
export default function LibraryStatsBar({ current, style }: { current?: Section; style?: CSSProperties }) {
  const { t } = useTranslation()
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: fetchStats, staleTime: 5 * 60_000 })
  if (!stats) return null

  const chip = (section: Section, count: number, to: string) => {
    const label = `${count} ${t(`search.${section}`).toLowerCase()}`
    return section === current
      ? <span>{label}</span>
      : <Link to={to} className="stats-bar-link">{label}</Link>
  }

  return (
    <div className="stats-bar" style={style}>
      {chip('artists', stats.artists, '/')}
      {chip('albums', stats.albums, '/albums')}
      {chip('tracks', stats.tracks, '/tracks')}
    </div>
  )
}
