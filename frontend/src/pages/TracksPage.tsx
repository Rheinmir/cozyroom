import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchTracks, trackArt } from '../api'
import { usePlayer } from '../PlayerContext'
import FavoritePill from '../components/FavoritePill'
import LibraryStatsBar from '../components/LibraryStatsBar'
import Spinner from '../components/Spinner'
import { paths } from '../routes'
import type { Track } from '../types'

const AZ = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]
function letterOf(name: string) {
  const c = (name ?? '').trim().charAt(0).toUpperCase()
  return /[A-Z]/.test(c) ? c : '#'
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const hrs = (s: number) => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h} h ${m} min` : `${m} min` }

// Sort keys follow the music-dashboard pattern (uiux.giatbh.io.vn/patterns/music-dashboard.html):
// a segmented control above a table with a cover + artist line per row and an EQ on the playing row.
type SortKey = 'title' | 'artist' | 'album' | 'long'
const SORTS: SortKey[] = ['title', 'artist', 'album', 'long']
const SORT_LABEL: Record<SortKey, string> = { title: 'Title', artist: 'Artist', album: 'Album', long: 'Longest' }
const cmp: Record<SortKey, (a: Track, b: Track) => number> = {
  title: (a, b) => a.title.localeCompare(b.title),
  artist: (a, b) => (a.artist_name ?? '').localeCompare(b.artist_name ?? '') || a.title.localeCompare(b.title),
  album: (a, b) => (a.album_title ?? '').localeCompare(b.album_title ?? '') || a.track_num - b.track_num,
  long: (a, b) => b.duration_s - a.duration_s,
}

export default function TracksPage() {
  const { t } = useTranslation()
  const { play, track: current, isPlaying } = usePlayer()
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ['tracks', 'all'],
    queryFn: () => fetchTracks(''),
    staleTime: 5 * 60_000,
  })
  const [sort, setSort] = useState<SortKey>('title')
  const [params, setParams] = useSearchParams()
  const qRaw = params.get('q') ?? ''
  const q = qRaw.trim().toLowerCase()

  const sorted = useMemo(() => [...tracks].sort(cmp[sort]), [tracks, sort])
  const shown = useMemo(() => q ? sorted.filter(x => `${x.title} ${x.artist_name ?? ''} ${x.album_title ?? ''}`.toLowerCase().includes(q)) : sorted, [sorted, q])
  const availableLetters = useMemo(() => new Set(sorted.map(x => letterOf(x.title))), [sorted])
  const total = useMemo(() => tracks.reduce((n, x) => n + (x.duration_s || 0), 0), [tracks])
  const rail = !q && sort === 'title'
  let lastLetter = ''

  if (isLoading) return <div className="loading"><Spinner size={28} label={t('library.loading')} /></div>

  const shuffle = () => {
    const l = [...shown]
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]] }
    if (l.length) play(l[0], l)
  }

  return (
    <div className="page">
      <LibraryStatsBar current="tracks" />
      <div className="tl-head">
        <div>
          <h1 className="page-title">{t('search.tracks')}</h1>
          <p className="tl-sub">{tracks.length} tracks · {hrs(total)} of music</p>
        </div>
        <div className="tl-actions">
          <button type="button" className="tl-play" disabled={!shown.length} onClick={() => play(shown[0], shown)}>▶ Play all</button>
          <button type="button" className="tl-ghost" disabled={!shown.length} onClick={shuffle} aria-label="Phát ngẫu nhiên danh sách đang hiện">Shuffle</button>
        </div>
      </div>
      <div className="tl-bar">
        <input
          className="tl-search" type="search" value={qRaw} placeholder="Search your tracks" aria-label="Tìm trong danh sách bài hát"
          onChange={e => setParams(p => { const v = e.target.value; if (v) p.set('q', v); else p.delete('q'); return p }, { replace: true })}
        />
        <div className="tl-seg" role="group" aria-label="Sắp xếp danh sách bài hát">
          {SORTS.map(k => <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>{SORT_LABEL[k]}</button>)}
        </div>
        {q && <span className="tl-sub">{shown.length} found</span>}
      </div>
      <div className="artist-grid-wrap">
        <table className="track-table tl-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th>{t('search.title_col')}</th>
              <th className="col-album">{t('search.album_col')}</th>
              <th className="col-fav"></th>
              <th className="col-dur">{t('search.duration_col')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((x, i) => {
              const letter = letterOf(x.title)
              const isFirstOfLetter = rail && letter !== lastLetter
              if (isFirstOfLetter) lastLetter = letter
              const on = current?.id === x.id
              return (
                <tr
                  key={x.id}
                  className={'track-row' + (on ? ' track-row--active' : '')}
                  id={isFirstOfLetter ? `track-letter-${letter}` : undefined}
                  onClick={() => play(x, shown)}
                  role="button"
                  tabIndex={0}
                  aria-current={on ? 'true' : undefined}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(x, shown) } }}
                >
                  <td className="col-num">
                    {on
                      ? <span className={'tl-eq' + (isPlaying ? '' : ' tl-eq--paused')} aria-label={isPlaying ? 'Đang phát' : 'Đang dừng'}><i /><i /><i /></span>
                      : <span className="track-num-text">{i + 1}</span>}
                  </td>
                  <td>
                    <span className="tl-t">
                      <img className="tl-cv" src={trackArt(x, 96)} alt="" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
                      <span className="tl-meta">
                        <span className="track-title tt-clamp">{x.title}</span>
                        <span className="track-artist">{x.artist_name}</span>
                      </span>
                    </span>
                  </td>
                  <td className="col-album">
                    <Link to={paths.album(x.album_id)} className="text-muted" onClick={e => e.stopPropagation()}>{x.album_title}</Link>
                  </td>
                  <td className="col-fav" onClick={e => e.stopPropagation()}><FavoritePill trackId={x.id} /></td>
                  <td className="col-dur">{x.duration_s ? mmss(x.duration_s) : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rail && (
          <div className="artist-az-rail">
            {AZ.map(letter => (
              <button
                key={letter}
                className="artist-az-btn"
                disabled={!availableLetters.has(letter)}
                onClick={() => document.getElementById(`track-letter-${letter}`)?.scrollIntoView({ block: 'start' })}
              >
                {letter}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
