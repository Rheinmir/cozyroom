import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchAlbums, imgSrc } from '../api'
import LibraryStatsBar from '../components/LibraryStatsBar'
import Spinner from '../components/Spinner'

const AZ = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]
function letterOf(name: string) {
  const c = (name ?? '').trim().charAt(0).toUpperCase()
  return /[A-Z]/.test(c) ? c : '#'
}

// Full library album grid — reached by tapping the "N albums" figure in the
// ArtistsPage stats bar. Reuses the .album-grid / .album-card markup, plus the
// A-Z rail from ArtistsPage (list is sorted by title so the rail can jump).
export default function AlbumsPage() {
  const { t } = useTranslation()
  const { data: albums = [], isLoading } = useQuery({
    queryKey: ['albums', 'all'],
    queryFn: () => fetchAlbums(),
    staleTime: 5 * 60_000,
  })

  const sorted = useMemo(
    () => [...albums].sort((a, b) => a.title.localeCompare(b.title)),
    [albums]
  )
  const availableLetters = useMemo(() => new Set(sorted.map(a => letterOf(a.title))), [sorted])
  const [params] = useSearchParams()
  const q = params.get('q')?.trim().toLowerCase() ?? ''
  const shown = q ? sorted.filter(a => a.title.toLowerCase().includes(q) || (a.artist_name ?? '').toLowerCase().includes(q)) : sorted
  let lastLetter = ''

  if (isLoading) return <div className="loading"><Spinner size={28} label={t('library.loading')} /></div>

  return (
    <div className="page">
      <LibraryStatsBar current="albums" />
      <h1 className="page-title">{t('search.albums')}</h1>
      <div className="artist-grid-wrap">
        <div className="album-grid">
          {shown.map(al => {
            const letter = letterOf(al.title)
            const isFirstOfLetter = !q && letter !== lastLetter
            if (isFirstOfLetter) lastLetter = letter
            return (
              <Link key={al.id} to={`/album/${al.id}`} className="album-card" id={isFirstOfLetter ? `album-letter-${letter}` : undefined}>
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
            )
          })}
        </div>
        {!q && (
          <div className="artist-az-rail">
            {AZ.map(letter => (
              <button
                key={letter}
                className="artist-az-btn"
                disabled={!availableLetters.has(letter)}
                onClick={() => document.getElementById(`album-letter-${letter}`)?.scrollIntoView({ block: 'start' })}
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
