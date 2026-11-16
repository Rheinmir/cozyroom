import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { markEbookOpened } from '../mediaProgress'

interface Ebook {
  id: string
  title: string
  format: string
  progress?: string
}

interface EbookPage {
  index: number
  type: 'image' | 'html'
}

interface TocEntry {
  label: string
  spineIndex: number
}

function HtmlPage({ id, index, fontSize, desktopMode }: { id: string; index: number; fontSize: number; desktopMode: boolean }) {
  const [html, setHtml] = useState('')
  useEffect(() => {
    fetch(`/api/ebooks/${id}/page/${index}`)
      .then(r => r.text())
      .then(setHtml)
      .catch(console.error)
  }, [id, index])
  return (
    <div
      className={`epub-html-page${desktopMode ? ' desktop-wide' : ''}`}
      data-page={index}
      style={{ fontSize: `${fontSize}%` }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default function EbookReaderPage() {
  const { id } = useParams<{ id: string }>()

  const [ebook, setEbook] = useState<Ebook | null>(null)
  const [loading, setLoading] = useState(true)
  const [readMode, setReadMode] = useState<'paged' | 'scroll'>(
    (localStorage.getItem(`epub-mode-${id}`) as 'paged' | 'scroll') || 'paged'
  )

  // EPUB state
  const [pages, setPages] = useState<EbookPage[]>([])
  const [currentPage, setCurrentPage] = useState(0)

  // PDF state
  const [numPages, setNumPages] = useState(0)
  const [pdfPage, setPdfPage] = useState(1)

  // Settings
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>(
    (localStorage.getItem('reader-theme') as 'light' | 'dark' | 'sepia') || 'light'
  )
  const [fontSize, setFontSize] = useState(
    parseInt(localStorage.getItem('reader-font-size') || '100')
  )
  const [desktopMode, setDesktopMode] = useState(
    localStorage.getItem('reader-desktop') === 'true'
  )
  const [showSettings, setShowSettings] = useState(false)

  // TOC
  const [toc, setToc] = useState<TocEntry[]>([])
  const [showToc, setShowToc] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setCurrentPage(0)
    setPages([])
    setToc([])
    setShowToc(false)
    setPdfPage(1)
    setReadMode((localStorage.getItem(`epub-mode-${id}`) as 'paged' | 'scroll') || 'paged')
    document.querySelector('.shell')?.classList.add('reader-active')
    if (id) markEbookOpened(id)

    fetch('/api/ebooks')
      .then(r => r.json())
      .then(async (ebooks: Ebook[]) => {
        const found = ebooks.find(e => e.id === id)
        if (!found) return
        setEbook(found)

        if (found.format === 'epub') {
          const [pageList, tocList] = await Promise.all([
            fetch(`/api/ebooks/${id}/pages`).then(r => r.json()),
            fetch(`/api/ebooks/${id}/toc`).then(r => r.json()).catch(() => []),
          ])
          setPages(pageList || [])
          setToc(tocList || [])
          const saved = parseInt(found.progress || '0')
          if (!isNaN(saved) && saved > 0 && saved < (pageList?.length ?? 0)) {
            setCurrentPage(saved)
          }
        } else if (found.format === 'pdf') {
          const saved = parseInt(found.progress || '1')
          setPdfPage(isNaN(saved) || saved < 1 ? 1 : saved)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))

    return () => {
      document.querySelector('.shell')?.classList.remove('reader-active')
    }
  }, [id])

  const saveProgress = (p: string) => {
    fetch(`/api/ebooks/${id}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: p }),
    }).catch(console.error)
  }

  const goToPage = (n: number) => {
    const clamped = Math.max(0, Math.min(pages.length - 1, n))
    setCurrentPage(clamped)
    saveProgress(String(clamped))
    // Scroll mode renders every page at once, so "go to page" means scrolling
    // that page into view (it used to jump back to the top of the book).
    if (readMode === 'scroll') {
      scrollRef.current?.querySelector(`[data-page="${clamped}"]`)?.scrollIntoView({ block: 'start' })
    } else {
      scrollRef.current?.scrollTo(0, 0)
    }
  }

  // EPUB HTML is injected verbatim, so its own links (e.g. the book's in-text
  // "Mục lục" pointing at "../Text/C12.xhtml") would make the browser navigate
  // to a non-existent app URL and fall through to the SPA fallback. Intercept
  // every link: external ones open in a new tab, internal ones are resolved to
  // a spine page — by matching the link text against the TOC labels, else by
  // the link's position among the links on its page.
  const handleContentLink = (ev: React.MouseEvent) => {
    const a = (ev.target as HTMLElement).closest('a')
    if (!a || !scrollRef.current?.contains(a) || a.closest('.reader-toc')) return
    const href = a.getAttribute('href') || ''
    ev.preventDefault()
    ev.stopPropagation()
    if (/^(https?:|mailto:)/i.test(href)) { window.open(href, '_blank', 'noopener'); return }
    if (!href || href.startsWith('#')) return
    const norm = (t: string) => t.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
    const label = norm(a.textContent || '')
    let target = label ? toc.find(e => norm(e.label) === label) : undefined
    if (!target && label.length > 3) target = toc.find(e => { const l = norm(e.label); return l.startsWith(label) || label.startsWith(l) })
    if (!target) {
      const pageEl = a.closest('[data-page]')
      const pageIdx = pageEl ? parseInt(pageEl.getAttribute('data-page') || '0', 10) : currentPage
      const links = pageEl ? Array.from(pageEl.querySelectorAll('a[href]')).filter(x => !/^(https?:|mailto:|#)/i.test(x.getAttribute('href') || '')) : []
      const after = toc.filter(e => e.spineIndex > pageIdx)
      target = after[links.indexOf(a)]
    }
    if (target) goToPage(target.spineIndex)
  }

  const changePdfPage = (offset: number) => {
    setPdfPage(prev => {
      const next = Math.max(1, Math.min(numPages, prev + offset))
      saveProgress(String(next))
      return next
    })
  }

  const toggleMode = () => {
    const next = readMode === 'paged' ? 'scroll' : 'paged'
    setReadMode(next)
    localStorage.setItem(`epub-mode-${id}`, next)
  }

  const toggleDesktop = () => {
    setDesktopMode(d => {
      localStorage.setItem('reader-desktop', String(!d))
      return !d
    })
  }

  const setThemeAndSave = (t: 'light' | 'dark' | 'sepia') => {
    setTheme(t)
    localStorage.setItem('reader-theme', t)
  }

  const setFontSizeAndSave = (f: number) => {
    const clamped = Math.max(80, Math.min(200, f))
    setFontSize(clamped)
    localStorage.setItem('reader-font-size', String(clamped))
  }

  const pdfWidth = window.innerWidth < 768 ? window.innerWidth : 800

  if (loading) return <div className="reader-loading">Loading…</div>
  if (!ebook) return <div className="reader-error">Book not found</div>

  return (
    <div className={`reader-page theme-${theme}`}>
      <header className="reader-header">
        <Link to="/ebooks" className="reader-back">
          <span className="ms" style={{ fontSize: 20 }} aria-hidden>arrow_back</span>
          Thư viện
        </Link>
        <div className="reader-title">{ebook.title}</div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {toc.length > 0 && (
            <button className={`reader-mode-btn${showToc ? ' mode-safe' : ''}`} onClick={() => { setShowToc(s => !s); setShowSettings(false) }}>
              <span className="ms" style={{ fontSize: 18 }} aria-hidden>toc</span>
              <span>Mục lục</span>
            </button>
          )}

          <button className="reader-mode-btn" onClick={toggleMode}>
            <span className="ms" style={{ fontSize: 18 }} aria-hidden>{readMode === 'paged' ? 'auto_stories' : 'view_day'}</span>
            <span>{readMode === 'paged' ? 'Lật trang' : 'Cuộn'}</span>
          </button>

          {ebook.format === 'epub' && (
            <button className={`reader-mode-btn${desktopMode ? ' mode-safe' : ''}`} onClick={toggleDesktop}>
              <span className="ms" style={{ fontSize: 18 }} aria-hidden>width_wide</span>
              <span>Rộng</span>
            </button>
          )}

          <button className="reader-settings-btn" onClick={() => { setShowSettings(s => !s); setShowToc(false) }} aria-label="Cài đặt đọc" title="Cài đặt đọc">
            <span className="ms" style={{ fontSize: 20 }} aria-hidden>text_format</span>
          </button>
        </div>

        {showSettings && (
          <div className="reader-settings-overlay">
            <div className="settings-group">
              <div className="settings-label">Theme</div>
              <div className="theme-options">
                <button className={`theme-opt light ${theme === 'light' ? 'active' : ''}`} onClick={() => setThemeAndSave('light')}>Light</button>
                <button className={`theme-opt dark ${theme === 'dark' ? 'active' : ''}`} onClick={() => setThemeAndSave('dark')}>Dark</button>
                <button className={`theme-opt sepia ${theme === 'sepia' ? 'active' : ''}`} onClick={() => setThemeAndSave('sepia')}>Sepia</button>
              </div>
            </div>
            <div className="settings-group">
              <div className="settings-label">Font Size</div>
              <div className="font-options">
                <button className="font-btn" onClick={() => setFontSizeAndSave(fontSize - 10)}>-</button>
                <div className="font-value">{fontSize}%</div>
                <button className="font-btn" onClick={() => setFontSizeAndSave(fontSize + 10)}>+</button>
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="reader-container" ref={scrollRef} onClickCapture={handleContentLink} onClick={() => { setShowSettings(false); setShowToc(false) }}>
        {showToc && (
          <div className="reader-toc" onClick={e => e.stopPropagation()}>
            <div className="toc-header">Contents</div>
            {toc.map((entry, i) => (
              <button
                key={i}
                className={`toc-entry${entry.spineIndex === currentPage ? ' active' : ''}`}
                onClick={() => { goToPage(entry.spineIndex); setShowToc(false) }}
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}

        {ebook.format === 'pdf' ? (
          <div className={`pdf-viewer-wrap ${readMode}`}>
            <Document
              file={`/api/ebooks/${id}/content`}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={<div className="pdf-loading">Loading PDF…</div>}
            >
              {readMode === 'scroll' ? (
                Array.from({ length: Math.min(numPages, 50) }, (_, i) => (
                  <Page key={i + 1} pageNumber={i + 1} className="pdf-page"
                    renderAnnotationLayer={false} renderTextLayer={true} width={pdfWidth} />
                ))
              ) : (
                <Page pageNumber={pdfPage} className="pdf-page"
                  renderAnnotationLayer={false} renderTextLayer={true} width={pdfWidth} />
              )}
            </Document>
            {readMode === 'paged' && numPages > 0 && (
              <>
                <div className="pdf-tap-zone left" onClick={e => { e.stopPropagation(); changePdfPage(-1) }} />
                <div className="pdf-tap-zone right" onClick={e => { e.stopPropagation(); changePdfPage(1) }} />
                <div className="pdf-page-indicator">{pdfPage} / {numPages}</div>
              </>
            )}
          </div>
        ) : pages.length === 0 ? (
          <div className="reader-error">No pages found</div>
        ) : readMode === 'paged' ? (
          <div className={`epub-paged-view${pages[currentPage].type === 'html' ? ' epub-paged-html' : ''}`}>
            {pages[currentPage].type === 'image' ? (
              <div className="epub-img-page">
                <img src={`/api/ebooks/${id}/page/${currentPage}`} alt={`Page ${currentPage + 1}`} />
              </div>
            ) : (
              <HtmlPage id={id!} index={currentPage} fontSize={fontSize} desktopMode={desktopMode} />
            )}
            <div className="pdf-tap-zone left" onClick={e => { e.stopPropagation(); goToPage(currentPage - 1) }} />
            <div className="pdf-tap-zone right" onClick={e => { e.stopPropagation(); goToPage(currentPage + 1) }} />
            <div className="pdf-page-indicator">{currentPage + 1} / {pages.length}</div>
          </div>
        ) : (
          <div className="epub-scroll-view">
            {pages.map(page => (
              page.type === 'image' ? (
                <div key={page.index} className="epub-img-page" data-page={page.index}>
                  <img src={`/api/ebooks/${id}/page/${page.index}`} alt={`Page ${page.index + 1}`} loading="lazy" />
                </div>
              ) : (
                <HtmlPage key={page.index} id={id!} index={page.index} fontSize={fontSize} desktopMode={desktopMode} />
              )
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
