import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

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
    scrollRef.current?.scrollTo(0, 0)
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
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          Back
        </Link>
        <div className="reader-title">{ebook.title}</div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {toc.length > 0 && (
            <button className={`reader-mode-btn${showToc ? ' mode-safe' : ''}`} onClick={() => { setShowToc(s => !s); setShowSettings(false) }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M3 9h14V7H3v2zm0 4h14v-2H3v2zm0 4h14v-2H3v2zm16 0h2v-2h-2v2zm0-10v2h2V7h-2zm0 6h2v-2h-2v2z"/>
              </svg>
              <span>ToC</span>
            </button>
          )}

          <button className="reader-mode-btn" onClick={toggleMode}>
            {readMode === 'paged' ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z"/>
              </svg>
            )}
            <span>{readMode === 'paged' ? 'Paged' : 'Scroll'}</span>
          </button>

          {ebook.format === 'epub' && (
            <button className={`reader-mode-btn${desktopMode ? ' mode-safe' : ''}`} onClick={toggleDesktop}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z"/>
              </svg>
              <span>{desktopMode ? 'Wide' : 'Wide'}</span>
            </button>
          )}

          <button className="reader-settings-btn" onClick={() => { setShowSettings(s => !s); setShowToc(false) }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5zm10.5-3.5c0-.64-.04-1.28-.13-1.91l2.42-1.89-2.35-4.07-2.85 1.15c-.62-.48-1.3-.88-2.02-1.18l-.43-3.05h-4.7l-.43 3.05c-.72.3-1.4.7-2.02 1.18l-2.85-1.15-2.35 4.07 2.42 1.89c-.09.63-.13 1.27-.13 1.91s.04 1.28.13 1.91l-2.42 1.89 2.35 4.07 2.85-1.15c.62.48 1.3.88 2.02 1.18l.43 3.05h4.7l.43 3.05c.72-.3 1.4-.7 2.02-1.18l2.85 1.15 2.35-4.07-2.42-1.89c.09-.63.13-1.27.13-1.91z"/>
            </svg>
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

      <div className="reader-container" ref={scrollRef} onClick={() => { setShowSettings(false); setShowToc(false) }}>
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
                <div key={page.index} className="epub-img-page">
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
