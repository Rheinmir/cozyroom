import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { imgSrc, fetchEbooks, Ebook, LIBRARY_STALE_TIME } from '../api'
import { useDialogs } from '../DialogContext'
import Spinner from '../components/Spinner'
import { getEbookOpened } from '../mediaProgress'
import { relTime } from '../roomVoice'

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Typographic cover for books whose artwork is missing or fails to load:
// a deterministic hue per title, serif title, author on top — reads as a real
// (if minimal) book jacket instead of a grey skeleton.
function hueOf(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

function GeneratedCover({ e }: { e: Ebook }) {
  const hue = hueOf(e.title || e.id)
  const style = { '--gc-h': hue } as CSSProperties
  const author = e.author && e.author !== 'Unknown Author' ? e.author : ''
  return (
    <div className="gen-cover" style={style} aria-hidden>
      {author && <span className="gen-cover-author">{author.normalize('NFC')}</span>}
      <span className="gen-cover-title">{e.title.normalize('NFC')}</span>
      <span className="gen-cover-rule" />
      <span className="gen-cover-fmt">{e.format.toUpperCase()}</span>
    </div>
  )
}

function BookCover({ e, size = 200 }: { e: Ebook; size?: number }) {
  const [failed, setFailed] = useState(!e.cover_url)
  if (failed) return <GeneratedCover e={e} />
  return (
    <img
      src={imgSrc(e.cover_url!, size)}
      alt={e.title}
      loading="lazy"
      className={e.is_nsfw ? 'nsfw-blur' : ''}
      onError={() => setFailed(true)}
    />
  )
}

const isDoc = (e: Ebook) => e.format === 'pdf'

function EbookCard({ 
  e, 
  onToggleNSFW, 
  onUpdateCollection 
}: { 
  e: Ebook; 
  onToggleNSFW: (id: string, current: boolean) => void;
  onUpdateCollection: (id: string, col: string) => void;
}) {
  const navigate = useNavigate()
  
  const handleClick = (ev: React.MouseEvent) => {
    ev.preventDefault()
    // Password check is now handled at the filter level or session level
    navigate(`/ebook/${e.id}`)
  }

  const handleCollectionClick = (ev: React.MouseEvent) => {
    ev.preventDefault()
    ev.stopPropagation()
    const newCol = window.prompt('Nhập tên bộ sưu tập:', e.collection || '')
    if (newCol !== null) {
      onUpdateCollection(e.id, newCol)
    }
  }

  return (
    <div className={`ebook-card-container ${e.is_nsfw ? 'is-nsfw' : ''}`}>
      <div className={'ebook-card ' + (isDoc(e) ? 'ebook-card--doc' : 'ebook-card--book')} onClick={handleClick}>
        <div className="ebook-card-cover">
          <BookCover e={e} />
          {e.is_nsfw && <span className="nsfw-badge">NSFW</span>}
          {e.collection && <span className="media-chip collection-badge"><span className="ms" style={{ fontSize: 13 }} aria-hidden>folder</span>{e.collection}</span>}
          <div className="ebook-card-actions">
            <button
              className="media-icon-btn media-hover-reveal nsfw-toggle"
              onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); onToggleNSFW(e.id, !!e.is_nsfw) }}
              title={e.is_nsfw ? 'Bỏ đánh dấu NSFW' : 'Đánh dấu NSFW'}
              aria-label={e.is_nsfw ? 'Bỏ đánh dấu NSFW' : 'Đánh dấu NSFW'}
            >
              <span className="ms" aria-hidden>{e.is_nsfw ? 'visibility' : 'visibility_off'}</span>
            </button>
            <button
              className="media-icon-btn media-hover-reveal collection-toggle"
              onClick={handleCollectionClick}
              title="Bộ sưu tập"
              aria-label="Bộ sưu tập"
            >
              <span className="ms" aria-hidden>create_new_folder</span>
            </button>
          </div>
        </div>
        <div className="ebook-card-info">
          <div className="ebook-card-title">{e.title}</div>
          <div className="ebook-card-author">{e.author || 'Không rõ tác giả'}</div>
          <div className="ebook-card-meta">{formatBytes(e.size_bytes)}</div>
        </div>
      </div>
    </div>
  )
}

// "Đang đọc": the book most recently opened on this device (falling back to
// server-side reading progress) as a hero, with other in-progress titles beside.
function ReadingHero({ books }: { books: Ebook[] }) {
  const navigate = useNavigate()
  const [main, ...rest] = books
  const page = parseInt(main.progress || '', 10)
  const where = !isNaN(page) && page > 0 ? (isDoc(main) ? `Trang ${page}` : `Phần ${page + 1}`) : ''
  return (
    <section className="reading-hero">
      <div className="reading-hero-bg" aria-hidden>
        {main.cover_url && !main.is_nsfw && <img src={imgSrc(main.cover_url, 200)} alt="" />}
      </div>
      <button className="reading-hero-book" onClick={() => navigate(`/ebook/${main.id}`)} aria-label={`Đọc tiếp ${main.title}`}>
        <span className={'ebook-card-cover ' + (isDoc(main) ? 'is-doc' : 'is-book')}><BookCover e={main} size={400} /></span>
      </button>
      <div className="reading-hero-text">
        <p className="film-eyebrow">Đang đọc</p>
        <h2 className="reading-hero-title">{main.title}</h2>
        <p className="hero-meta reading-hero-meta">
          {main.author && main.author !== 'Unknown Author' && <span className="hero-meta-strong">{main.author}</span>}
          {where && <span>{where}</span>}
          <span>{main.format.toUpperCase()}</span>
        </p>
        {getEbookOpened()[main.id] && <p className="room-voice">Lần cuối bạn mở cuốn này {relTime(getEbookOpened()[main.id])}.</p>}
        <div className="hero-actions">
          <button className="btn-primary" onClick={() => navigate(`/ebook/${main.id}`)}>
            <span className="ms" style={{ fontSize: 20 }} aria-hidden>auto_stories</span>Đọc tiếp
          </button>
        </div>
      </div>
      {rest.length > 0 && (
        <div className="reading-hero-more">
          <p className="reading-hero-more-label">Cũng đang đọc</p>
          <div className="reading-hero-more-row">
            {rest.slice(0, 4).map(b => (
              <button key={b.id} className="reading-mini" onClick={() => navigate(`/ebook/${b.id}`)} title={b.title}>
                <span className={'ebook-card-cover ' + (isDoc(b) ? 'is-doc' : 'is-book')}><BookCover e={b} /></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default function EbooksPage() {
  const { t } = useTranslation()
  const { toast } = useDialogs()
  const queryClient = useQueryClient()
  const { data: ebooks = [], isLoading: loading } = useQuery({ queryKey: ['ebooks'], queryFn: fetchEbooks, staleTime: LIBRARY_STALE_TIME })
  const [searchParams] = useSearchParams()
  const [filterNSFW, setFilterNSFW] = useState<'all' | 'nsfw' | 'clean'>('clean')
  const [selectedCollection, setSelectedCollection] = useState<string>('all')

  const patchEbook = (id: string, patch: Partial<Ebook>) =>
    queryClient.setQueryData<Ebook[]>(['ebooks'], prev => prev?.map(e => e.id === id ? { ...e, ...patch } : e))

  const handleToggleNSFW = (id: string, current: boolean) => {
    let password = localStorage.getItem('ebook-nsfw-pass')
    if (!password) {
      password = window.prompt('Nhập mật khẩu để thay đổi trạng thái NSFW:')
      if (!password) return
    }

    fetch(`/api/ebooks/${id}/nsfw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_nsfw: !current, password })
    })
    .then(res => {
      if (res.ok) {
        localStorage.setItem('ebook-nsfw-pass', password!)
        patchEbook(id, { is_nsfw: !current })
      } else {
        localStorage.removeItem('ebook-nsfw-pass')
        toast('Sai mật khẩu hoặc lỗi server!', 'error')
      }
    })
    .catch(console.error)
  }

  const handleUpdateCollection = (id: string, collection: string) => {
    fetch(`/api/ebooks/${id}/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection })
    })
    .then(res => {
      if (res.ok) {
        patchEbook(id, { collection })
      } else {
        toast('Lỗi cập nhật bộ sưu tập!', 'error')
      }
    })
    .catch(console.error)
  }

  const handleFilterNSFWChange = (val: 'all' | 'nsfw' | 'clean') => {
    if (val === 'clean') {
      setFilterNSFW(val)
      return
    }

    // Check password if switching to NSFW or All
    const password = localStorage.getItem('ebook-nsfw-pass')
    if (password === 'owner712002') {
      setFilterNSFW(val)
    } else {
      const input = window.prompt('Nhập mật khẩu để xem nội dung NSFW:')
      if (input === 'owner712002') {
        localStorage.setItem('ebook-nsfw-pass', input)
        setFilterNSFW(val)
      } else {
        if (input !== null) toast('Sai mật khẩu!', 'error')
        // Keep it at 'clean'
      }
    }
  }

  if (loading) return <div className="loading"><Spinner size={28} label="Loading library…" /></div>

  if (ebooks.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">{t('nav.ebooks')}</h1>
        <div className="media-empty">
          <span className="ms" aria-hidden>menu_book</span>
          <div>Chưa có sách nào</div>
          <div className="media-empty-sub">Thêm file EPUB hoặc PDF vào <code>F:\Ebooks</code></div>
        </div>
      </div>
    )
  }

  const collections = Array.from(new Set(ebooks.map(e => e.collection).filter(Boolean))) as string[]

  const q = searchParams.get('q')?.trim().toLowerCase() ?? ''
  const filteredEbooks = ebooks.filter(e => {
    const nsfwMatch = filterNSFW === 'all' || (filterNSFW === 'nsfw' ? e.is_nsfw : !e.is_nsfw)
    const collectionMatch = selectedCollection === 'all' || e.collection === selectedCollection
    const qMatch = !q || (e.title ?? '').toLowerCase().includes(q)
    return nsfwMatch && collectionMatch && qMatch
  })

  const opened = getEbookOpened()
  const reading = filteredEbooks
    .filter(e => opened[e.id] || (e.progress && parseInt(e.progress, 10) > 0))
    .sort((a, b) => (opened[b.id] || 0) - (opened[a.id] || 0))

  return (
    <div className="page ebooks-page">
      <header className="media-head">
        <div className="media-head-title">
          <h1 className="page-title">{t('nav.ebooks')}</h1>
          <span className="media-count">{filteredEbooks.length} {t('ebooks.items', 'cuốn')}</span>
        </div>
        <div className="media-controls">
          <label className="media-select" title="Bộ sưu tập">
            <span className="ms ms--outline" aria-hidden>folder</span>
            <select value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)} aria-label="Bộ sưu tập">
              <option value="all">Tất cả bộ sưu tập</option>
              {collections.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="ms media-select-chev" aria-hidden>expand_more</span>
          </label>
          <label className="media-select" title="Lọc nội dung">
            <span className="ms ms--outline" aria-hidden>shield</span>
            <select value={filterNSFW} onChange={(e) => handleFilterNSFWChange(e.target.value as any)} aria-label="Lọc nội dung">
              <option value="clean">An toàn</option>
              <option value="nsfw">Chỉ NSFW</option>
              <option value="all">Tất cả nội dung</option>
            </select>
            <span className="ms media-select-chev" aria-hidden>expand_more</span>
          </label>
        </div>
      </header>
      {filteredEbooks.length === 0 && (
        <div className="media-empty">
          <span className="ms" aria-hidden>search_off</span>
          <div>Không có sách nào khớp bộ lọc</div>
        </div>
      )}
      {!q && reading.length > 0 && <ReadingHero books={reading} />}
      {[
        { key: 'book', title: 'Sách', icon: 'menu_book', items: filteredEbooks.filter(e => !isDoc(e)) },
        { key: 'doc', title: 'Tài liệu', icon: 'description', items: filteredEbooks.filter(isDoc) },
      ].filter(sec => sec.items.length > 0).map(sec => (
        <section key={sec.key} className="ebook-shelf">
          <div className="discover-section-head">
            <h2 className="discover-section-title">{sec.title}</h2>
            <span className="media-count">{sec.items.length}</span>
          </div>
          <div className={'ebooks-grid' + (sec.key === 'doc' ? ' ebooks-grid--docs' : '')}>
            {sec.items.map(e => (
              <EbookCard
                key={e.id}
                e={e}
                onToggleNSFW={handleToggleNSFW}
                onUpdateCollection={handleUpdateCollection}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

