import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { imgSrc } from '../api'

interface Ebook {
  id: string
  title: string
  author: string
  format: string
  size_bytes: number
  cover_url?: string
  is_nsfw?: boolean
  collection?: string
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const FALLBACK_COVER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 300'%3E%3Crect width='200' height='300' fill='%23333'/%3E%3Cpath d='M60 100h80v20H60zm0 40h80v10H60zm0 30h80v10H60zm0 30h50v10H60z' fill='%23555'/%3E%3C/svg%3E"

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
      <div className="ebook-card" onClick={handleClick}>
        <div className="ebook-card-cover">
          <img
            src={e.cover_url ? imgSrc(e.cover_url, 200) : FALLBACK_COVER}
            alt={e.title}
            loading="lazy" 
            className={e.is_nsfw ? 'nsfw-blur' : ''}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== FALLBACK_COVER) {
                target.src = FALLBACK_COVER;
              }
            }}
          />
          <span className={`ebook-format-badge format-${e.format}`}>{e.format.toUpperCase()}</span>
          {e.is_nsfw && <span className="nsfw-badge">NSFW</span>}
          {e.collection && <span className="collection-badge">{e.collection}</span>}
        </div>
        <div className="ebook-card-info">
          <div className="ebook-card-title">{e.title}</div>
          <div className="ebook-card-author">{e.author}</div>
          <div className="ebook-card-meta">{formatBytes(e.size_bytes)}</div>
        </div>
      </div>
      <div className="ebook-card-actions">
        <button 
          className="nsfw-toggle" 
          onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); onToggleNSFW(e.id, !!e.is_nsfw) }}
          title="Toggle NSFW status"
        >
          {e.is_nsfw ? '🔞' : '🔞'}
        </button>
        <button 
          className="collection-toggle" 
          onClick={handleCollectionClick}
          title="Manage Collection"
        >
          📁
        </button>
      </div>
    </div>
  )
}

export default function EbooksPage() {
  const [ebooks, setEbooks] = useState<Ebook[]>([])
  const [loading, setLoading] = useState(true)
  const [filterNSFW, setFilterNSFW] = useState<'all' | 'nsfw' | 'clean'>('clean')
  const [selectedCollection, setSelectedCollection] = useState<string>('all')

  useEffect(() => {
    fetch('/api/ebooks')
      .then(res => res.json())
      .then(data => {
        setEbooks(data || [])
        setLoading(false)
      })
      .catch(console.error)
  }, [])

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
        setEbooks(prev => prev.map(e => e.id === id ? { ...e, is_nsfw: !current } : e))
      } else {
        localStorage.removeItem('ebook-nsfw-pass')
        alert('Sai mật khẩu hoặc lỗi server!')
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
        setEbooks(prev => prev.map(e => e.id === id ? { ...e, collection } : e))
      } else {
        alert('Lỗi cập nhật bộ sưu tập!')
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
        if (input !== null) alert('Sai mật khẩu!')
        // Keep it at 'clean'
      }
    }
  }

  if (loading) return <div className="ebooks-loading">Loading library…</div>

  if (ebooks.length === 0) {
    return (
      <div className="ebooks-empty">
        <p>No ebooks found. Make sure <code>F:\Ebooks</code> contains EPUB or PDF files.</p>
      </div>
    )
  }

  const collections = Array.from(new Set(ebooks.map(e => e.collection).filter(Boolean))) as string[]

  const filteredEbooks = ebooks.filter(e => {
    const nsfwMatch = filterNSFW === 'all' || (filterNSFW === 'nsfw' ? e.is_nsfw : !e.is_nsfw)
    const collectionMatch = selectedCollection === 'all' || e.collection === selectedCollection
    return nsfwMatch && collectionMatch
  })

  return (
    <div className="ebooks-page">
      <header className="ebooks-header">
        <div className="header-top">
          <div className="header-titles">
            <div className="library-tag">Thư viện</div>
            <h1>Your Bookshelf</h1>
            <span className="ebook-count-badge">{filteredEbooks.length} items</span>
          </div>
          <div className="ebooks-filter-bar">
            <div className="filter-pill">
              <span className="filter-icon">📁</span>
              <select value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)}>
                <option value="all">All Collections</option>
                {collections.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-pill">
              <span className="filter-icon">🔞</span>
              <select value={filterNSFW} onChange={(e) => handleFilterNSFWChange(e.target.value as any)}>
                <option value="clean">Family Friendly</option>
                <option value="nsfw">NSFW Only</option>
                <option value="all">All Content</option>
              </select>
            </div>
          </div>
        </div>
      </header>
      <div className="ebooks-grid">
        {filteredEbooks.map(e => (
          <EbookCard 
            key={e.id} 
            e={e} 
            onToggleNSFW={handleToggleNSFW} 
            onUpdateCollection={handleUpdateCollection}
          />
        ))}
      </div>
    </div>
  )
}

