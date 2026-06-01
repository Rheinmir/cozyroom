import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MCP_TOOLS } from '../data/mcpTools'
import type { McpTool } from '../data/mcpTools'

const CATEGORIES = [...new Set(MCP_TOOLS.map(t => t.category))]

function ToolCard({ tool, onClick }: { tool: McpTool; onClick: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeReady, setIframeReady] = useState(false)
  const [visible, setVisible] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (cardRef.current) obs.observe(cardRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={cardRef} className="tool-card" onClick={onClick}>
      <div className="tool-card-iframe-wrap">
        {visible && (
          <iframe
            ref={iframeRef}
            src={tool.uiRoute}
            className="tool-card-iframe"
            tabIndex={-1}
            scrolling="no"
            onLoad={() => setIframeReady(true)}
            style={{ opacity: iframeReady ? 1 : 0 }}
          />
        )}
        {(!visible || !iframeReady) && <div className="tool-card-iframe-placeholder" />}
      </div>
      <div className="tool-card-overlay">
        <span className="tool-card-category" style={{ background: tool.categoryColor + '33', color: tool.categoryColor, borderColor: tool.categoryColor + '55' }}>
          {tool.category}
        </span>
        <div className="tool-card-name">{tool.name}</div>
        <div className="tool-card-desc">{tool.description}</div>
      </div>
    </div>
  )
}

function ToolDetail({ tool, onClose, onUse }: { tool: McpTool; onClose: () => void; onUse: () => void }) {
  return (
    <div className="tool-detail-backdrop" onClick={onClose}>
      <div className="tool-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="tool-detail-header">
          <span className="tool-card-category" style={{ background: tool.categoryColor + '33', color: tool.categoryColor, borderColor: tool.categoryColor + '55' }}>
            {tool.category}
          </span>
          <button className="tool-detail-close" onClick={onClose}>✕</button>
        </div>
        <div className="tool-detail-name">{tool.name}</div>
        <div className="tool-detail-desc">{tool.description}</div>
        <div className="tool-detail-section">
          <div className="tool-detail-label">Dùng trong AI</div>
          <div className="tool-detail-route">/ai → gõ lệnh <code>/{tool.name}</code></div>
        </div>
        <div className="tool-detail-section">
          <div className="tool-detail-label">UI tương ứng</div>
          <div className="tool-detail-route"><code>{tool.uiRoute}</code></div>
        </div>
        <div className="tool-detail-section">
          <div className="tool-detail-label">Cách dùng — flow</div>
          <ol className="tool-detail-flow">
            {tool.flow.map((step, i) => (
              <li key={i} className="tool-detail-flow-step">{step}</li>
            ))}
          </ol>
        </div>
        <div className="tool-detail-section">
          <div className="tool-detail-label">Prompt mẫu</div>
          <div className="tool-detail-prompt">"{tool.prompt}..."</div>
        </div>
        <button className="tool-detail-use-btn" onClick={onUse}>
          Dùng tool này với AI →
        </button>
      </div>
    </div>
  )
}

export default function ToolsPage() {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<McpTool | null>(null)

  const filtered = MCP_TOOLS.filter(t => {
    const matchCat = !activeCategory || t.category === activeCategory
    const q = search.toLowerCase()
    const matchSearch = !q || t.name.includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  const handleUse = (tool: McpTool) => {
    navigate('/ai', { state: { prompt: `/${tool.name} ` } })
  }

  return (
    <div className="tools-page">
      <div className="tools-header">
        <h1 className="tools-title">MCP Tool Gallery</h1>
        <p className="tools-subtitle">{MCP_TOOLS.length} tools · tap để xem chi tiết</p>
        <input
          className="tools-search"
          type="search"
          placeholder="Tìm tool..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="tools-filter">
          <button className={`tools-filter-btn${!activeCategory ? ' tools-filter-btn--active' : ''}`} onClick={() => setActiveCategory(null)}>
            Tất cả
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              className={`tools-filter-btn${activeCategory === c ? ' tools-filter-btn--active' : ''}`}
              onClick={() => setActiveCategory(c === activeCategory ? null : c)}
            >{c}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div style={{ color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>Không tìm thấy tool nào</div>
      )}

      <div className="tools-grid">
        {filtered.map(tool => (
          <ToolCard key={tool.name} tool={tool} onClick={() => setDetail(tool)} />
        ))}
      </div>

      {detail && (
        <ToolDetail
          tool={detail}
          onClose={() => setDetail(null)}
          onUse={() => { setDetail(null); handleUse(detail) }}
        />
      )}
    </div>
  )
}
