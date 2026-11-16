import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  searchMangaDex, searchEHentai,
  fetchMangaChapters, fetchMangaPages,
  fetchEHentaiDetail, fetchEHentaiPages,
  fetchDownloads, deleteDownload, retryDownload,
  enqueueEHDownload, enqueueMDDownload, fetchLocalChapters,
  ComicResult, EHentaiPage, ComicsDownload, LocalChapter,
} from '../api'
import { useDialogs } from '../DialogContext'
import BackButton from '../components/BackButton'

type Source = 'md' | 'eh'
type ViewMode = 'scroll' | 'page'
type DlFilter = 'all' | 'done' | 'downloading' | 'failed' | 'idle'

function FallbackCover() {
  return (
    <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="200" height="300" style={{ fill: 'var(--img)' }} />
      <path d="M60 100h80v20H60zm0 40h80v10H60zm0 30h80v10H60zm0 30h50v10H60z" style={{ fill: 'var(--surface-3)' }} />
    </svg>
  )
}

function dlCoverSrc(dl: ComicsDownload): string {
  if (!dl.cover) return ''
  if (dl.cover.startsWith('/')) return dl.cover
  if (dl.source === 'eh') return `/api/scraper/eh/image?url=${encodeURIComponent(dl.cover)}`
  return `/api/scraper/md/img?url=${encodeURIComponent(dl.cover)}`
}

function DownloadCard({ dl, onRead, onOpen, onDelete, onRetry, onDownload }: {
  dl: ComicsDownload
  onRead: (dl: ComicsDownload) => void
  onOpen: (dl: ComicsDownload) => void
  onDelete: (e: React.MouseEvent, id: string) => void
  onRetry: (e: React.MouseEvent, id: string) => void
  onDownload: (e: React.MouseEvent, dl: ComicsDownload) => void
}) {
  const pct = dl.page_count > 0 ? Math.round(dl.downloaded / dl.page_count * 100) : 0
  const isDone = dl.status === 'done'
  const isIdle = dl.status === 'idle'
  return (
    <div
      className="comic-card comic-card--clickable"
      onClick={() => (isDone ? onRead(dl) : onOpen(dl))}
    >
      <div className="comic-cover">
        <FallbackCover />
        {dl.cover && (
          <img
            src={dlCoverSrc(dl)} alt={dl.title} loading="lazy"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        )}
        {dl.source === 'eh' && <span className="media-chip comic-chip-tl">NSFW</span>}
        {!isIdle && dl.status !== 'done' && (
          <div className={'comic-status comic-status--' + dl.status}>
            {dl.status === 'downloading' && dl.page_count > 0 ? (
              <>
                <div className="comic-progress"><i style={{ width: `${pct}%` }} /></div>
                <span>{pct}%</span>
              </>
            ) : (
              <span>{dl.status === 'failed' ? 'Lỗi tải' : dl.status === 'downloading' ? 'Đang tải…' : dl.status}</span>
            )}
          </div>
        )}
        {isIdle && (
          <button className="comic-dl-btn media-hover-reveal" onClick={e => onDownload(e, dl)} title="Tải về" aria-label="Tải về">
            <span className="ms" aria-hidden>download</span>
          </button>
        )}
        {(isDone || dl.status === 'failed') && (
          <button className="media-icon-btn media-hover-reveal comic-btn-tr" onClick={e => onDelete(e, dl.id)} title="Xoá" aria-label="Xoá">
            <span className="ms" aria-hidden>close</span>
          </button>
        )}
        {dl.status === 'failed' && (
          <button className="media-icon-btn comic-btn-tl" onClick={e => onRetry(e, dl.id)} title="Thử lại" aria-label="Thử lại">
            <span className="ms" aria-hidden>refresh</span>
          </button>
        )}
      </div>
      <div className="comic-title">{dl.title}</div>
      {isDone && <div className="comic-sub">{dl.page_count} trang · đã tải</div>}
    </div>
  )
}

export default function ComicsPage() {
  const { toast } = useDialogs()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlQ = searchParams.get('q')?.trim() ?? ''
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
  const queryClient = useQueryClient()
  const { data: downloads = [] } = useQuery({
    queryKey: ['comics-downloads'],
    queryFn: async () => (await fetchDownloads()) ?? [],
    staleTime: 30_000,
    // Keep polling while anything is actively queued/downloading; otherwise rely on cache.
    refetchInterval: query => {
      const list = query.state.data ?? []
      return list.some(d => d.status === 'queued' || d.status === 'downloading') ? 5000 : false
    },
  })
  const [dlFilter, setDlFilter] = useState<DlFilter>('all')
  const PAGE_SIZE = 60
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [imgErrors, setImgErrors] = useState(0)
  const [localChapters, setLocalChapters] = useState<LocalChapter[]>([])
  const [localChapterIdx, setLocalChapterIdx] = useState<number | null>(null)
  const [enqueueing, setEnqueueing] = useState<string | null>(null)

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

  // Reset pagination whenever the visible list itself changes
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [source, dlFilter, searchActive, results])

  const handleSourceChange = (s: Source) => {
    if (s === 'eh') {
      const password = localStorage.getItem('ebook-nsfw-pass')
      if (password !== 'owner712002') {
        const input = window.prompt('Nhập mật khẩu để truy cập nguồn NSFW (E-Hentai):')
        if (input === 'owner712002') { localStorage.setItem('ebook-nsfw-pass', input) }
        else { if (input !== null) toast('Sai mật khẩu!', 'error'); return }
      }
    }
    setSource(s)
    setSelected(null)
    setSearchActive(false)
    setResults([])
    setQuery('')
    setDlFilter('all')
  }

  // Search is driven by the app's top search island (Header routes
  // "Tìm trong Truyện tranh…" to /comics?q=) — one search box, not two.
  useEffect(() => {
    if (urlQ) { setQuery(urlQ); handleSearch(urlQ) }
    else if (searchActive) { setSearchActive(false); setResults([]); setSelected(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ, source])

  const handleSearch = async (q: string = query) => {
    if (!q.trim()) {
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
      const data = source === 'md' ? await searchMangaDex(q) : await searchEHentai(q)
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
    if (urlQ) navigate('/comics', { replace: true })
  }

  // A library card that isn't downloaded yet (discovered / queued / failed)
  // opens the detail panel — chapters, "Đọc ngay" online, "Tải về" — instead
  // of silently doing nothing (only finished downloads open the local reader).
  const handleOpenDl = (dl: ComicsDownload) => {
    if (dl.source !== source) setSource(dl.source as Source)
    if (dl.source === 'eh') {
      const gid = dl.id.replace('eh_', '')
      handleSelect({ id: gid, title: dl.title, token: dl.token, cover: dlCoverSrc(dl), link: `https://e-hentai.org/g/${gid}/${dl.token || ''}/` })
    } else {
      handleSelect({ id: dl.id.replace('md_', ''), title: dl.title, cover: dlCoverSrc(dl), link: '' })
    }
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
    queryClient.setQueryData<ComicsDownload[]>(['comics-downloads'], prev => prev?.filter(d => d.id !== id))
  }

  const handleRetryDl = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await retryDownload(id)
    queryClient.setQueryData<ComicsDownload[]>(['comics-downloads'], prev => prev?.map(d => d.id === id ? { ...d, status: 'queued', error: '' } : d))
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
      queryClient.setQueryData<ComicsDownload[]>(['comics-downloads'], prev => prev?.map(d => d.id === dl.id ? { ...d, status: 'queued' } : d))
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
        queryClient.setQueryData<ComicsDownload[]>(['comics-downloads'], prev => prev?.map(d => d.id === 'eh_' + gid ? { ...d, status: 'queued' } : d))
      } else {
        await enqueueMDDownload(selected.id)
        queryClient.setQueryData<ComicsDownload[]>(['comics-downloads'], prev => prev?.map(d => d.id === 'md_' + selected.id ? { ...d, status: 'queued' } : d))
      }
    } catch (err) {
      console.error('enqueue error', err)
    } finally {
      setEnqueueing(null)
    }
  }

  const sourceDownloads = downloads.filter(d => d.source === source)
  const shownDownloads = dlFilter === 'all' ? sourceDownloads : sourceDownloads.filter(d => d.status === dlFilter)
  const myShelf = sourceDownloads.filter(d => d.status !== 'idle').sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
  const gridList = dlFilter === 'all' ? sourceDownloads.filter(d => d.status === 'idle') : shownDownloads
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
    <div className="comics-shell">
      {/* Left panel */}
      <div className={'comics-main' + (searchActive || selected ? ' comics-main--split' : '')}>
        {/* Header */}
        <div className="comics-head">
          <div className="media-head comics-head-top">
            <div className="media-head-title">
              {searchActive && (
                <button className="comics-back" onClick={handleBackToDownloads} title="Về thư viện" aria-label="Về thư viện">
                  <span className="ms" aria-hidden>arrow_back</span>
                </button>
              )}
              <h1 className="page-title">Truyện tranh</h1>
              {!searchActive && <span className="media-count">{sourceDownloads.length} bộ</span>}
            </div>
            <div className="media-seg" role="tablist" aria-label="Nguồn">
              {(['md', 'eh'] as Source[]).map(s => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={source === s}
                  className={'media-seg-btn' + (source === s ? ' media-seg-btn--active' : '')}
                  onClick={() => handleSourceChange(s)}
                >
                  {s === 'md' ? 'MangaDex' : 'E-Hentai'}
                </button>
              ))}
            </div>
          </div>
          {searchActive && (
            <p className="comics-results-for">Kết quả cho “{urlQ || query}” · {source === 'md' ? 'MangaDex' : 'E-Hentai'}</p>
          )}
          {!searchActive && (
            <div className="comics-filters">
              {(['all', 'done', 'downloading', 'failed', 'idle'] as DlFilter[]).map(f => {
                const count = f === 'all' ? sourceDownloads.length : sourceDownloads.filter(d => d.status === f).length
                if (f !== 'all' && count === 0) return null
                const label = f === 'all' ? 'Tất cả' : f === 'idle' ? 'Đề xuất' : f === 'done' ? 'Đã tải' : f === 'failed' ? 'Lỗi' : 'Đang tải'
                return (
                  <button
                    key={f}
                    className={'comics-filter' + (dlFilter === f ? ' comics-filter--active' : '')}
                    onClick={() => setDlFilter(f)}
                  >
                    {label}<span className="comics-filter-count">{count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="comics-scroll">
          {loading && (
            <div className="media-empty">
              <div className="comics-spinner" />
              Đang tải…
            </div>
          )}
          {!loading && loadError && (
            <div className="media-empty">
              <span className="ms" aria-hidden>cloud_off</span>
              <div>Nguồn truyện đang không phản hồi</div>
              <div className="media-empty-sub">{loadError}</div>
            </div>
          )}

          {/* Downloads view */}
          {!searchActive && !loading && !loadError && (
            shownDownloads.length === 0 ? (
              <div className="media-empty">
                <span className="ms" aria-hidden>download</span>
                <div>Chưa có truyện nào</div>
                <div className="media-empty-sub">Tự động khám phá chạy mỗi 6 giờ</div>
              </div>
            ) : (
              <>
                {/* "All" = the reader's own shelf first (downloaded / in progress /
                    failed), then the auto-discovered catalogue to browse. */}
                {dlFilter === 'all' && myShelf.length > 0 && (
                  <section className="comics-section">
                    <div className="discover-section-head">
                      <h2 className="discover-section-title">Tủ truyện của bạn</h2>
                      <span className="media-count">{myShelf.length}</span>
                    </div>
                    <div className="comics-shelf">
                      {myShelf.map(dl => <DownloadCard key={dl.id} dl={dl} onRead={handleReadLocal} onOpen={handleOpenDl} onDelete={handleDeleteDl} onRetry={handleRetryDl} onDownload={handleDownloadDl} />)}
                    </div>
                  </section>
                )}
                <section className="comics-section">
                  {dlFilter === 'all' && (
                    <div className="discover-section-head">
                      <h2 className="discover-section-title">Khám phá</h2>
                      <span className="media-count">{gridList.length} bộ · tự cập nhật mỗi 6 giờ</span>
                    </div>
                  )}
                  <div className="comics-grid">
                    {gridList.slice(0, visibleCount).map(dl => <DownloadCard key={dl.id} dl={dl} onRead={handleReadLocal} onOpen={handleOpenDl} onDelete={handleDeleteDl} onRetry={handleRetryDl} onDownload={handleDownloadDl} />)}
                  </div>
                  {visibleCount < gridList.length && (
                    <div className="comics-more">
                      <button className="btn-secondary" onClick={() => setVisibleCount(n => n + PAGE_SIZE)}>
                        Xem thêm ({gridList.length - visibleCount} còn lại)
                      </button>
                    </div>
                  )}
                </section>
              </>
            )
          )}

          {/* Search results view */}
          {searchActive && !loading && !loadError && results.length === 0 && (
            <div className="media-empty">
              <span className="ms" aria-hidden>search_off</span>
              Không có kết quả
            </div>
          )}
          {searchActive && results.length > 0 && (
            <div className="comics-grid">
              {results.map((item, i) => (
                <div
                  key={i}
                  className={'comic-card comic-card--clickable' + (selected && selected.id === item.id ? ' comic-card--selected' : '')}
                  onClick={() => handleSelect(item)}
                >
                  <div className="comic-cover">
                    <FallbackCover />
                    {item.cover && (
                      <img
                        src={item.cover} alt={item.title || item.name} loading="lazy"
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    )}
                    {source === 'eh' && <span className="media-chip comic-chip-tr">NSFW</span>}
                  </div>
                  <div className="comic-title">{item.title || item.name}</div>
                  {item.uploader && <div className="comic-sub">{item.uploader}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel — only visible during search */}
      {(searchActive || selected) && <aside className="comics-detail">
        {!selected ? (
          <div className="media-empty comics-detail-empty">
            <span className="ms" aria-hidden>auto_stories</span>
            Chọn một truyện để xem chi tiết
          </div>
        ) : (
          <>
            {/* Detail header */}
            <div className="comics-detail-head">
              {cover && <img className="comics-detail-bg" src={cover} alt="" aria-hidden />}
              <button className="comics-detail-close" onClick={() => setSelected(null)} aria-label="Đóng">
                <span className="ms" aria-hidden>close</span>
              </button>
              {cover && (
                <img className="comics-detail-cover" src={cover} alt={title}
                  onError={e => { e.currentTarget.style.display = 'none' }} />
              )}
              <div className="comics-detail-info">
                <div className="comics-detail-title">{title}</div>
                {uploader && <div className="comics-detail-sub">{uploader}</div>}
                <div className="comics-detail-meta">
                  {pages_ !== undefined && <span>{pages_} trang</span>}
                  {rating && <span>★ {rating}</span>}
                </div>
                {source === 'eh' && selected.tags && (
                  <div className="comics-tags">
                    {(Array.isArray(selected.tags) ? selected.tags as string[] : [selected.tags as string]).slice(0, 5).map((t: string) => (
                      <span key={t} className="comics-tag">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {chapterList.length > 0 && (
              <div className="comics-detail-actions">
                <button className="btn-primary" onClick={() => handleChapter(chapterList[0], 0)}>
                  <span className="ms" style={{ fontSize: 20 }} aria-hidden>menu_book</span>Đọc ngay
                </button>
                {canDownload && (
                  <button className="btn-secondary" onClick={handleDownloadSelected} disabled={enqueueing === 'selected'}>
                    <span className="ms" style={{ fontSize: 19 }} aria-hidden>download</span>
                    {enqueueing === 'selected' ? '…' : source === 'md' ? 'Tải tất cả' : 'Tải về'}
                  </button>
                )}
                {selectedDl && selectedDl.status === 'done' && (
                  <button className="btn-secondary" onClick={() => handleReadLocal(selectedDl)}>
                    <span className="ms" style={{ fontSize: 19 }} aria-hidden>folder_open</span>Đọc bản tải
                  </button>
                )}
              </div>
            )}

            {/* Chapter/page list */}
            <div className="comics-chapters">
              <div className="comics-chapters-label">
                {chapterList.length} {source === 'md' ? 'chương' : 'trang'}
              </div>
              {loading && <div className="media-empty"><div className="comics-spinner" /></div>}
              <div className="comics-chapter-grid">
                {chapterList.map((ch, i) => (
                  <button key={i} className="comics-chapter" onClick={() => handleChapter(ch)} title={ch.title || ''}>
                    {source === 'md'
                      ? <><span className="comics-chapter-no">{ch.chapter ? `Ch. ${ch.chapter}` : `#${i + 1}`}</span><span className="comics-chapter-title">{ch.title || 'Không tên'}</span></>
                      : <span className="comics-chapter-title">Trang {i + 1}</span>}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </aside>}

      {/* Reader overlay */}
      {reading && (
        <div className="comics-reader">
          <div className="comics-reader-bar">
            <BackButton onClick={() => setReading(null)} label="Close" autoHide={false} overlay />
            <span className="comics-reader-title">
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
                className="comics-reader-select"
              >
                {localChapters.map((ch, i) => (
                  <option key={ch.id} value={i}>Ch {i + 1} ({ch.page_count}p)</option>
                ))}
              </select>
            )}

            <div className="media-seg comics-reader-seg">
              {(['scroll', 'page'] as ViewMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={'media-seg-btn' + (viewMode === m ? ' media-seg-btn--active' : '')}
                >
                  {m === 'scroll' ? 'Cuộn' : 'Lật trang'}
                </button>
              ))}
            </div>
            {viewMode === 'page' && pages.length > 0 && (
              <span className="comics-reader-count">{currentPageIdx + 1} / {pages.length}</span>
            )}
          </div>

          {viewMode === 'scroll' && (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 12, gap: 8 }}>
              {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>}
              {pages.length > 0 && imgErrors >= pages.length && (
                <div style={{ padding: 40, color: '#888888', textAlign: 'center' }}>
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
                className="comics-page-nav comics-page-nav--prev"
                aria-label="Trang trước"
              ><span className="ms" aria-hidden>chevron_left</span></button>
              {pages[currentPageIdx] ? (
                <img key={currentPageIdx} src={pages[currentPageIdx]} alt={`Page ${currentPageIdx + 1}`}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  onError={() => setImgErrors(n => n + 1)}
                />
              ) : (
                <div style={{ color: '#888888', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⚠</div>
                  Không load được ảnh
                </div>
              )}
              <button
                onClick={() => setCurrentPageIdx(i => Math.min(pages.length - 1, i + 1))}
                disabled={currentPageIdx === pages.length - 1}
                className="comics-page-nav comics-page-nav--next"
                aria-label="Trang sau"
              ><span className="ms" aria-hidden>chevron_right</span></button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
