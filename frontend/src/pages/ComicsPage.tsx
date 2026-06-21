import { useEffect, useState } from 'react'
import {
  searchMangaDex, searchEHentai,
  fetchMangaChapters, fetchMangaPages,
  fetchEHentaiDetail, fetchEHentaiPages,
  fetchDownloads, deleteDownload, retryDownload,
  enqueueEHDownload, enqueueMDDownload, fetchLocalChapters,
  ComicResult, EHentaiPage, ComicsDownload, LocalChapter,
} from '../api'

type Source = 'md' | 'eh'
type ViewMode = 'scroll' | 'page'
type DlFilter = 'all' | 'done' | 'downloading' | 'failed' | 'idle'

function FallbackCover() {
  return (
    <svg viewBox="0 0 200 300" style={{ width: '100%', height: '100%', background: '#333' }}>
      <rect width="200" height="300" fill="#333" />
      <path d="M60 100h80v20H60zm0 40h80v10H60zm0 30h80v10H60zm0 30h50v10H60z" fill="#555" />
    </svg>
  )
}

function dlCoverSrc(dl: ComicsDownload): string {
  if (!dl.cover) return ''
  if (dl.cover.startsWith('/')) return dl.cover
  if (dl.source === 'eh') return `/api/scraper/eh/image?url=${encodeURIComponent(dl.cover)}`
  return `/api/scraper/md/img?url=${encodeURIComponent(dl.cover)}`
}

function DownloadCard({ dl, onRead, onDelete, onRetry, onDownload }: {
  dl: ComicsDownload
  onRead: (dl: ComicsDownload) => void
  onDelete: (e: React.MouseEvent, id: string) => void
  onRetry: (e: React.MouseEvent, id: string) => void
  onDownload: (e: React.MouseEvent, dl: ComicsDownload) => void
}) {
  const pct = dl.page_count > 0 ? Math.round(dl.downloaded / dl.page_count * 100) : 0
  const isDone = dl.status === 'done'
  const isIdle = dl.status === 'idle'
  const isClickable = isDone || isIdle
  return (
    <div
      onClick={() => isClickable && onRead(dl)}
      style={{ cursor: isClickable ? 'pointer' : 'default', position: 'relative' }}
    >
      <div style={{
        width: '100%', aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden',
        background: 'var(--surface)', marginBottom: 8, position: 'relative',
      }}>
        <FallbackCover />
        {dl.cover && (
          <img
            src={dlCoverSrc(dl)} alt={dl.title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        )}
        {dl.source === 'eh' && (
          <div style={{ position: 'absolute', top: 6, left: 6, background: '#e74c3c', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3 }}>NSFW</div>
        )}
        {!isIdle && dl.status !== 'done' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', padding: 8 }}>
            <div style={{
              width: '100%', fontSize: 10, fontWeight: 700,
              padding: '3px 6px', borderRadius: 4, textAlign: 'center',
              background: dl.status === 'failed' ? '#e74c3c' : dl.status === 'downloading' ? 'var(--accent)' : '#666',
              color: dl.status === 'downloading' ? '#000' : '#fff',
            }}>
              {dl.status === 'downloading' && dl.page_count > 0 ? `${pct}%` : dl.status.toUpperCase()}
            </div>
          </div>
        )}
        {isIdle && (
          <button
            onClick={e => onDownload(e, dl)}
            title="Download"
            style={{
              position: 'absolute', bottom: 6, right: 6,
              padding: '4px 8px', borderRadius: 6, border: 'none',
              background: 'rgba(0,0,0,0.75)', color: '#fff',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >⬇ Download</button>
        )}
        {(isDone || dl.status === 'failed') && (
          <button
            onClick={e => onDelete(e, dl.id)}
            title="Delete"
            style={{
              position: 'absolute', top: 6, right: 6, width: 22, height: 22,
              borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)',
              color: '#fff', fontSize: 14, cursor: 'pointer', lineHeight: '22px', padding: 0,
            }}
          >×</button>
        )}
        {dl.status === 'failed' && (
          <button
            onClick={e => onRetry(e, dl.id)}
            title="Retry"
            style={{
              position: 'absolute', top: 6, left: 6, width: 22, height: 22,
              borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)',
              color: '#fff', fontSize: 13, cursor: 'pointer', lineHeight: '22px', padding: 0,
            }}
          >↺</button>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {dl.title}
      </div>
      {isDone && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{dl.page_count} pages · local</div>
      )}
    </div>
  )
}

export default function ComicsPage() {
  const [source, setSource] = useState<Source>('md')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ComicResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchActive, setSearchActive] = useState(false)
  const [selected, setSelected] = useState<ComicResult | null>(null)
  const [chapterList, setChapterList] = useState<any[]>([])
  const [pages, setPages] = useState<string[]>([])
  const [reading, setReading] = useState<any>(null)
  const [loadError, setLoadError] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('scroll')
  const [currentPageIdx, setCurrentPageIdx] = useState(0)
  const [downloads, setDownloads] = useState<ComicsDownload[]>([])
  const [dlFilter, setDlFilter] = useState<DlFilter>('all')
  const [imgErrors, setImgErrors] = useState(0)
  const [localChapters, setLocalChapters] = useState<LocalChapter[]>([])
  const [localChapterIdx, setLocalChapterIdx] = useState<number | null>(null)
  const [enqueueing, setEnqueueing] = useState<string | null>(null)

  // Poll downloads; re-poll while any are in progress
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const load = async () => {
      try {
        const dl = await fetchDownloads()
        setDownloads(dl ?? [])
        if ((dl ?? []).some(d => d.status === 'queued' || d.status === 'downloading')) {
          timer = setTimeout(load, 5000)
        }
      } catch {}
    }
    load()
    return () => clearTimeout(timer)
  }, [])

  // Keyboard nav in page mode
  useEffect(() => {
    if (!reading || viewMode !== 'page') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrentPageIdx(i => Math.min(pages.length - 1, i + 1))
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setCurrentPageIdx(i => Math.max(0, i - 1))
      else if (e.key === 'Escape') setReading(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [reading, viewMode, pages.length])

  const handleSourceChange = (s: Source) => {
    if (s === 'eh') {
      const password = localStorage.getItem('ebook-nsfw-pass')
      if (password !== 'owner712002') {
        const input = window.prompt('Nhập mật khẩu để truy cập nguồn NSFW (E-Hentai):')
        if (input === 'owner712002') { localStorage.setItem('ebook-nsfw-pass', input) }
        else { if (input !== null) alert('Sai mật khẩu!'); return }
      }
    }
    setSource(s)
    setSelected(null)
    setSearchActive(false)
    setResults([])
    setQuery('')
    setDlFilter('all')
  }

  const handleSearch = async () => {
    if (!query.trim()) {
      setSearchActive(false)
      setResults([])
      return
    }
    setLoading(true)
    setLoadError('')
    setResults([])
    setSelected(null)
    setChapterList([])
    setSearchActive(true)
    try {
      const data = source === 'md' ? await searchMangaDex(query) : await searchEHentai(query)
      setResults(data.results || [])
    } catch (e: any) {
      setLoadError(e.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToDownloads = () => {
    setSearchActive(false)
    setQuery('')
    setResults([])
    setSelected(null)
  }

  const handleSelect = async (item: ComicResult) => {
    setSelected(item)
    setChapterList([])
    setPages([])
    setLoadError('')
    setLoading(true)
    try {
      if (source === 'md') {
        const chs = await fetchMangaChapters(item.id)
        setChapterList(chs || [])
      } else {
        const detail = await fetchEHentaiDetail(item.link)
        setSelected({ ...item, ...detail })
        const pg = await fetchEHentaiPages(item.link)
        setChapterList((pg || []).map((p: EHentaiPage) => ({ id: p.link, title: `Page ${p.index}`, index: p.index })))
      }
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load details')
    } finally {
      setLoading(false)
    }
  }

  const handleChapter = async (ch: any, startIdx?: number) => {
    setReading(ch)
    setPages([])
    setImgErrors(0)
    setLoadError('')
    if (source === 'md') {
      setLoading(true)
      try {
        const imgs = await fetchMangaPages(ch.id)
        setPages(imgs || [])
        setCurrentPageIdx(0)
      } catch (e: any) {
        setLoadError(e.message || 'Failed to load pages')
      } finally {
        setLoading(false)
      }
    } else {
      const idx = startIdx != null ? startIdx : (ch.index != null ? ch.index - 1 : 0)
      setPages(chapterList.map(p => `/api/scraper/eh/image?url=${encodeURIComponent(p.id)}`))
      setCurrentPageIdx(Math.max(0, idx))
    }
  }

  const handleReadLocal = async (dl: ComicsDownload) => {
    setImgErrors(0)

    // Idle EH card → read online via proxy (same as search result flow)
    if (dl.status === 'idle' && dl.source === 'eh') {
      const gid = dl.id.replace('eh_', '')
      const galleryUrl = `https://e-hentai.org/g/${gid}/${dl.token || ''}/`
      setReading({ title: dl.title })
      setPages([])
      setLocalChapters([])
      setLocalChapterIdx(null)
      setCurrentPageIdx(0)
      setLoading(true)
      try {
        const pg = await fetchEHentaiPages(galleryUrl)
        setPages((pg || []).map(p => `/api/scraper/eh/image?url=${encodeURIComponent(p.link)}`))
      } catch (e: any) {
        setLoadError(e.message || 'Failed to load pages')
        setReading(null)
      } finally {
        setLoading(false)
      }
      return
    }

    if (dl.status !== 'done') return

    if (dl.source === 'md') {
      // Load chapter list for MD manga
      try {
        const chs = await fetchLocalChapters(dl.id)
        if (chs && chs.length > 0) {
          setLocalChapters(chs)
          setLocalChapterIdx(0)
          openLocalChapter(dl.id, chs[0])
          setReading({ title: dl.title, dlId: dl.id, dl })
          return
        }
      } catch {}
    }

    // EH or MD fallback: flat page list
    if (dl.page_count === 0) return
    setPages(Array.from({ length: dl.page_count }, (_, i) =>
      `/api/scraper/local/${dl.id}/${String(i + 1).padStart(4, '0')}.jpg`
    ))
    setReading({ title: dl.title })
    setCurrentPageIdx(0)
    setLocalChapters([])
    setLocalChapterIdx(null)
  }

  const openLocalChapter = (dlId: string, ch: LocalChapter) => {
    setPages(Array.from({ length: ch.page_count }, (_, i) =>
      `/api/scraper/local/${dlId}/${ch.id}/${String(i + 1).padStart(4, '0')}.jpg`
    ))
    setCurrentPageIdx(0)
    setImgErrors(0)
  }

  const handleDeleteDl = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteDownload(id)
    setDownloads(prev => prev.filter(d => d.id !== id))
  }

  const handleRetryDl = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await retryDownload(id)
    setDownloads(prev => prev.map(d => d.id === id ? { ...d, status: 'queued', error: '' } : d))
  }

  const handleDownloadDl = async (e: React.MouseEvent, dl: ComicsDownload) => {
    e.stopPropagation()
    if (enqueueing === dl.id) return
    setEnqueueing(dl.id)
    try {
      if (dl.source === 'eh') {
        const gid = dl.id.replace('eh_', '')
        await enqueueEHDownload(gid, dl.token || gid)
      } else {
        const mangaId = dl.id.replace('md_', '')
        await enqueueMDDownload(mangaId)
      }
      setDownloads(prev => prev.map(d => d.id === dl.id ? { ...d, status: 'queued' } : d))
    } catch (err) {
      console.error('enqueue error', err)
    } finally {
      setEnqueueing(null)
    }
  }

  const handleDownloadSelected = async () => {
    if (!selected) return
    setEnqueueing('selected')
    try {
      if (source === 'eh') {
        const gid = selected.id
        const token = selected.token || ''
        await enqueueEHDownload(gid, token)
        // Update local record status if exists
        setDownloads(prev => prev.map(d => d.id === 'eh_' + gid ? { ...d, status: 'queued' } : d))
      } else {
        await enqueueMDDownload(selected.id)
        setDownloads(prev => prev.map(d => d.id === 'md_' + selected.id ? { ...d, status: 'queued' } : d))
      }
    } catch (err) {
      console.error('enqueue error', err)
    } finally {
      setEnqueueing(null)
    }
  }

  const sourceDownloads = downloads.filter(d => d.source === source)
  const shownDownloads = dlFilter === 'all' ? sourceDownloads : sourceDownloads.filter(d => d.status === dlFilter)
  const title = selected?.title || selected?.name || ''
  const cover = selected?.cover || ''
  const uploader = selected?.uploader || ''
  const pages_ = selected?.pages
  const rating = selected?.rating

  // Detect if selected manga is already downloaded/queued
  const selectedDlId = selected ? (source === 'eh' ? 'eh_' + selected.id : 'md_' + selected.id) : null
  const selectedDl = selectedDlId ? downloads.find(d => d.id === selectedDlId) : null
  const canDownload = !selectedDl || selectedDl.status === 'idle' || selectedDl.status === 'failed'

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel */}
      <div style={{ width: searchActive ? '60%' : '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: searchActive ? '1px solid var(--border)' : 'none' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
          <div className="library-tag" style={{ alignSelf: 'flex-start' }}>Tủ truyện</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(['md', 'eh'] as Source[]).map(s => (
              <button
                key={s}
                onClick={() => handleSourceChange(s)}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: source === s ? 'var(--accent)' : 'var(--elevated)',
                  color: source === s ? '#000' : 'var(--text)',
                }}
              >
                {s === 'md' ? 'MangaDex' : 'E-Hentai'}
              </button>
            ))}
            {searchActive && (
              <button
                onClick={handleBackToDownloads}
                style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, marginLeft: 4 }}
              >
                ← Downloads
              </button>
            )}
          </div>
          {!searchActive && (
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'done', 'downloading', 'failed', 'idle'] as DlFilter[]).map(f => {
                const count = f === 'all' ? sourceDownloads.length : sourceDownloads.filter(d => d.status === f).length
                if (f !== 'all' && count === 0) return null
                return (
                  <button
                    key={f}
                    onClick={() => setDlFilter(f)}
                    style={{
                      padding: '4px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600,
                      background: dlFilter === f ? 'var(--accent)' : 'var(--elevated)',
                      color: dlFilter === f ? '#000' : 'var(--text-muted)',
                    }}
                  >
                    {f === 'all' ? 'All' : f === 'idle' ? 'Discovered' : f.charAt(0).toUpperCase() + f.slice(1)} {count > 0 ? `(${count})` : ''}
                  </button>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={source === 'md' ? 'Search manga, manhwa, novel...' : 'Search galleries...'}
              style={{
                flex: 1, padding: '8px 16px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 999, color: 'var(--text)', fontSize: 14, outline: 'none',
              }}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              style={{
                padding: '8px 20px', borderRadius: 999, border: 'none',
                background: 'var(--accent)', color: '#000', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Search
            </button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <div style={{
                width: 32, height: 32, border: '3px solid var(--border)',
                borderTopColor: 'var(--accent)', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
              }} />
              Loading...
            </div>
          )}
          {!loading && loadError && (
            <div style={{ textAlign: 'center', padding: 40, color: '#e74c3c' }}>{loadError}</div>
          )}

          {/* Downloads view */}
          {!searchActive && !loading && !loadError && (
            shownDownloads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📥</div>
                <div style={{ fontSize: 14, marginBottom: 6 }}>No downloads yet</div>
                <div style={{ fontSize: 12 }}>Background discovery runs every 6 hours</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 20 }}>
                {shownDownloads.map(dl => (
                  <DownloadCard key={dl.id} dl={dl} onRead={handleReadLocal} onDelete={handleDeleteDl} onRetry={handleRetryDl} onDownload={handleDownloadDl} />
                ))}
              </div>
            )
          )}

          {/* Search results view */}
          {searchActive && !loading && !loadError && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              No results
            </div>
          )}
          {searchActive && results.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 20 }}>
              {results.map((item, i) => (
                <div
                  key={i}
                  onClick={() => handleSelect(item)}
                  style={{ cursor: 'pointer', position: 'relative' }}
                >
                  <div style={{
                    width: '100%', aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden',
                    background: 'var(--surface)', marginBottom: 8, position: 'relative',
                  }}>
                    <FallbackCover />
                    {item.cover && (
                      <img
                        src={item.cover} alt={item.title || item.name}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    )}
                    {source === 'eh' && (
                      <div style={{ position: 'absolute', top: 8, right: 8, background: '#e74c3c', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                        NSFW
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.title || item.name}
                  </div>
                  {item.uploader && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{item.uploader}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel — only visible during search */}
      {searchActive && <div style={{ width: '40%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Select a title to see details
          </div>
        ) : (
          <>
            {/* Detail header */}
            <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, flexShrink: 0 }}>
              {cover && (
                <img src={cover} alt={title} style={{ width: 80, height: 120, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                  onError={e => { e.currentTarget.style.display = 'none' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{title}</div>
                {uploader && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{uploader}</div>}
                {pages_ !== undefined && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pages_} pages</div>}
                {rating && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rating: {rating}</div>}
                {source === 'eh' && selected.tags && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {(Array.isArray(selected.tags) ? selected.tags as string[] : [selected.tags as string]).slice(0, 5).map((t: string) => (
                      <span key={t} style={{ background: 'var(--elevated)', padding: '1px 5px', borderRadius: 3 }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {chapterList.length > 0 && (
              <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
                <button
                  onClick={() => handleChapter(chapterList[0], 0)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
                >
                  ▶ Start Reading
                </button>
                {canDownload && (
                  <button
                    onClick={handleDownloadSelected}
                    disabled={enqueueing === 'selected'}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none',
                      background: 'var(--elevated)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12,
                      opacity: enqueueing === 'selected' ? 0.5 : 1,
                    }}
                  >
                    {enqueueing === 'selected' ? '...' : source === 'md' ? '⬇ Download All' : '⬇ Download'}
                  </button>
                )}
                {selectedDl && selectedDl.status === 'done' && (
                  <button
                    onClick={() => handleReadLocal(selectedDl)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--elevated)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
                  >
                    📂 Read Local
                  </button>
                )}
              </div>
            )}

            {/* Chapter/page list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-muted)' }}>
                {chapterList.length} {source === 'md' ? 'Chapters' : 'Pages'}
              </div>
              {loading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading...</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                {chapterList.map((ch, i) => (
                  <div
                    key={i}
                    onClick={() => handleChapter(ch)}
                    style={{
                      padding: '8px 12px', background: 'var(--surface)', borderRadius: 8,
                      fontSize: 11, cursor: 'pointer', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
                  >
                    {ch.title || `Page ${i + 1}`}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>}

      {/* Reader overlay */}
      {reading && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <button
              onClick={() => setReading(null)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--elevated)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}
            >
              ← Close
            </button>
            <span style={{ fontSize: 13, opacity: 0.7, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {reading.title || reading.chapter || ''}
            </span>

            {/* Local MD chapter picker */}
            {localChapters.length > 1 && reading.dlId && (
              <select
                value={localChapterIdx ?? 0}
                onChange={e => {
                  const idx = Number(e.target.value)
                  setLocalChapterIdx(idx)
                  openLocalChapter(reading.dlId, localChapters[idx])
                }}
                style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--elevated)', color: 'var(--text)', border: 'none' }}
              >
                {localChapters.map((ch, i) => (
                  <option key={ch.id} value={i}>Ch {i + 1} ({ch.page_count}p)</option>
                ))}
              </select>
            )}

            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {(['scroll', 'page'] as ViewMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600,
                    background: viewMode === m ? 'var(--accent)' : 'var(--elevated)',
                    color: viewMode === m ? '#000' : 'var(--text)',
                  }}
                >
                  {m === 'scroll' ? 'Scroll' : 'Page'}
                </button>
              ))}
            </div>
            {viewMode === 'page' && pages.length > 0 && (
              <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>{currentPageIdx + 1} / {pages.length}</span>
            )}
          </div>

          {viewMode === 'scroll' && (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 12, gap: 8 }}>
              {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>}
              {pages.length > 0 && imgErrors >= pages.length && (
                <div style={{ padding: 40, color: '#e74c3c', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
                  Không load được ảnh — thử tải về trước để đọc offline
                </div>
              )}
              {pages.map((src, i) => (
                <img key={i} src={src} loading="lazy" alt={`Page ${i + 1}`}
                  style={{ maxWidth: '100%', objectFit: 'contain', borderRadius: 4, display: 'block' }}
                  onError={() => setImgErrors(n => n + 1)}
                />
              ))}
            </div>
          )}

          {viewMode === 'page' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              <button
                onClick={() => setCurrentPageIdx(i => Math.max(0, i - 1))}
                disabled={currentPageIdx === 0}
                style={{
                  position: 'absolute', left: 12, zIndex: 10, width: 44, height: 44, borderRadius: '50%',
                  border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 20, cursor: 'pointer',
                  opacity: currentPageIdx === 0 ? 0.2 : 1,
                }}
              >‹</button>
              {pages[currentPageIdx] ? (
                <img key={currentPageIdx} src={pages[currentPageIdx]} alt={`Page ${currentPageIdx + 1}`}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  onError={() => setImgErrors(n => n + 1)}
                />
              ) : (
                <div style={{ color: '#e74c3c', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⚠</div>
                  Không load được ảnh
                </div>
              )}
              <button
                onClick={() => setCurrentPageIdx(i => Math.min(pages.length - 1, i + 1))}
                disabled={currentPageIdx === pages.length - 1}
                style={{
                  position: 'absolute', right: 12, zIndex: 10, width: 44, height: 44, borderRadius: '50%',
                  border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 20, cursor: 'pointer',
                  opacity: currentPageIdx === pages.length - 1 ? 0.2 : 1,
                }}
              >›</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
