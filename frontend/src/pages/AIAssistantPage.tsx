import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { usePlayer } from '../PlayerContext'
import type { RepeatMode, ShuffleMode } from '../PlayerContext'
import type { Track } from '../types'
import FavoritePill from '../components/FavoritePill'
import { MCP_TOOLS } from '../data/mcpTools'

type Role = 'user' | 'assistant'

interface Message {
  id: number
  role: Role
  text: string
  actions?: Action[]
  model?: string
  provider?: string
  tokensIn?: number
  tokensOut?: number
  logId?: string
}

interface Action {
  type: string
  id?: string
  title?: string
  artist?: string
  album_id?: string
  album_title?: string
  year?: number
  duration_s?: number
  mode?: string
  tracks?: Track[]
}

interface ChatTurn {
  role: Role
  content: string
}

interface MemoryFact {
  key: string
  value: string
  updated_at: string
}

interface LogEntry {
  id: string
  created_at: string
  model: string
  provider: string
  user_msg: string
  ai_msg: string
  actions: string
  failed: number
  fail_reason: string
  tool_errors: string
  tokens_in: number
  tokens_out: number
}
interface SessionEntry {
  session_id: string
  preview: string
  last_at: string
  turns: number
}

let msgSeq = 0

function MediaCard({ action, onPlay, onNext, onPrev }: {
  action: Action
  onPlay: () => void
  onNext: () => void
  onPrev: () => void
}) {
  const player = usePlayer()
  const [activeMode, setActiveMode] = useState<'smart' | 'shuffle' | null>(null)
  const [dlState, setDlState] = useState<'idle' | 'loading' | 'done'>('idle')

  const ytId = action.id?.startsWith('yt:') ? action.id.slice(3) : null
  const localAlbumId = action.album_id && !action.album_id.startsWith('yt:') ? action.album_id : null
  const coverUrl = localAlbumId
    ? `/api/covers/${localAlbumId}`
    : ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null

  const handleDownload = async () => {
    if (!ytId || dlState !== 'idle') return
    setDlState('loading')
    try {
      await fetch('/api/youtube/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ytId, title: action.title || '', artist: action.artist || '' }),
      })
      setDlState('done')
    } catch {
      setDlState('idle')
    }
  }

  const handleSmartMix = () => {
    player.setShuffleMode('smart')
    onPlay()
    setActiveMode('smart')
  }
  const handleShuffle = () => {
    player.setShuffleMode('shuffle')
    onPlay()
    setActiveMode('shuffle')
  }

  const nextTrack = activeMode ? (player.queue[player.queueIdx + 1] ?? null) : null

  return (
    <div className="ai-media-card">
      {coverUrl && (
        <img
          className="ai-media-card-cover"
          src={coverUrl}
          alt=""
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <div className="ai-media-card-info">
        <div className="ai-media-card-title">{action.title}</div>
        {action.artist && <div className="ai-media-card-row">👤 {action.artist}</div>}
        {action.album_title && <div className="ai-media-card-row">💿 {action.album_title}</div>}
        {action.year ? <div className="ai-media-card-row">📅 {action.year}</div> : null}
      </div>
      <div className="ai-media-card-controls">
        <button className="ai-media-card-btn" onClick={onPrev} title="Bài trước">⏮</button>
        <button className="ai-media-card-btn ai-media-card-btn--play" onClick={onPlay}>▶ Phát</button>
        <button className="ai-media-card-btn" onClick={onNext} title="Bài sau">⏭</button>
        {action.id && (
          <span className="ai-media-card-fav" onClick={e => e.stopPropagation()}>
            <FavoritePill trackId={action.id} />
          </span>
        )}
      </div>
      <div className="ai-media-card-modes">
        <button
          className={'ai-media-card-mode-btn' + (activeMode === 'smart' ? ' ai-media-card-mode-btn--active' : '')}
          onClick={handleSmartMix} title="Smart Mix — phát tiếp theo tự động"
        >🔀 Smart Mix</button>
        <button
          className={'ai-media-card-mode-btn' + (activeMode === 'shuffle' ? ' ai-media-card-mode-btn--active' : '')}
          onClick={handleShuffle} title="Shuffle ngẫu nhiên"
        >🎲 Shuffle</button>
      </div>
      {(ytId || action.album_id) && (
        <div className="ai-media-card-modes">
          {ytId && (
            <button
              className={'ai-media-card-mode-btn' + (dlState === 'done' ? ' ai-media-card-mode-btn--active' : '')}
              onClick={handleDownload}
              disabled={dlState === 'loading'}
              title="Tải về thư viện"
            >
              {dlState === 'loading' ? '⏳ Đang tải...' : dlState === 'done' ? '✅ Đã lưu' : '📥 Tải về'}
            </button>
          )}
          {localAlbumId && (
            <Link
              to={`/album/${localAlbumId}`}
              className="ai-media-card-mode-btn"
              style={{ textAlign: 'center', textDecoration: 'none' }}
              title="Xem album trong thư viện"
            >💿 Album</Link>
          )}
        </div>
      )}
      {activeMode && nextTrack && (
        <div className="ai-media-card-next">
          <em>Tiếp theo: {nextTrack.title}{nextTrack.artist_name ? ` — ${nextTrack.artist_name}` : ''}</em>
        </div>
      )}
    </div>
  )
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '👎']

function ReactionBar({ logId }: { logId: string }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const pick = async (emoji: string) => {
    const prev = selected
    setSelected(prev === emoji ? null : emoji)
    setOpen(false)
    if (emoji === '👎' && prev !== emoji) {
      await fetch(`/api/ai/logs/${logId}/dislike`, { method: 'POST' }).catch(() => {})
    }
  }

  return (
    <div className="ai-reaction-bar" ref={ref}>
      {selected && (
        <button className="ai-reaction-badge" onClick={() => setSelected(null)} title="Bỏ cảm xúc">
          {selected}
        </button>
      )}
      <button
        className={'ai-reaction-trigger' + (open ? ' ai-reaction-trigger--active' : '')}
        onClick={() => setOpen(o => !o)}
        title="Thả cảm xúc"
      >
        😊
      </button>
      {open && (
        <div className="ai-reaction-picker">
          {REACTIONS.map(e => (
            <button
              key={e}
              className={'ai-reaction-emoji' + (selected === e ? ' ai-reaction-emoji--active' : '')}
              onClick={() => pick(e)}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function hastText(n: any): string {
  if (!n) return ''
  if (n.type === 'text') return n.value || ''
  if (Array.isArray(n.children)) return n.children.map(hastText).join('')
  return ''
}

const AI_RANK_GRADIENTS = [
  'radial-gradient(125% 125% at 30% 22%, oklch(0.64 0.17 285) 0%, oklch(0.4 0.13 323) 46%, oklch(0.17 0.06 3) 100%)',
  'radial-gradient(125% 125% at 30% 22%, oklch(0.64 0.17 262) 0%, oklch(0.4 0.13 300) 46%, oklch(0.17 0.06 340) 100%)',
  'radial-gradient(125% 125% at 70% 78%, oklch(0.62 0.18 160) 0%, oklch(0.38 0.14 175) 46%, oklch(0.17 0.06 190) 100%)',
  'radial-gradient(125% 125% at 30% 22%, oklch(0.72 0.18 45) 0%, oklch(0.48 0.15 25) 46%, oklch(0.20 0.06 355) 100%)',
  'radial-gradient(125% 125% at 30% 78%, oklch(0.55 0.20 240) 0%, oklch(0.35 0.15 270) 46%, oklch(0.15 0.07 300) 100%)',
  'radial-gradient(125% 125% at 30% 22%, oklch(0.67 0.19 345) 0%, oklch(0.43 0.14 310) 46%, oklch(0.18 0.06 280) 100%)',
  'radial-gradient(125% 125% at 70% 78%, oklch(0.65 0.14 185) 0%, oklch(0.42 0.12 210) 46%, oklch(0.18 0.05 230) 100%)',
  'radial-gradient(125% 125% at 30% 22%, oklch(0.70 0.18 45) 0%, oklch(0.46 0.15 20) 46%, oklch(0.20 0.06 355) 100%)',
  'radial-gradient(125% 125% at 30% 22%, oklch(0.60 0.22 290) 0%, oklch(0.38 0.16 320) 46%, oklch(0.16 0.07 350) 100%)',
  'radial-gradient(125% 125% at 70% 22%, oklch(0.65 0.15 145) 0%, oklch(0.41 0.12 170) 46%, oklch(0.18 0.05 200) 100%)',
  'radial-gradient(125% 125% at 30% 22%, oklch(0.67 0.19 345) 0%, oklch(0.43 0.14 310) 46%, oklch(0.18 0.06 280) 100%)',
  'radial-gradient(125% 125% at 70% 78%, oklch(0.62 0.20 20) 0%, oklch(0.40 0.15 350) 46%, oklch(0.18 0.06 320) 100%)',
]

function AiTable({ node }: { node: any }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const tbody = node?.children?.find((c: any) => c.tagName === 'tbody')
  if (!tbody) return null
  const rows: string[][] = (tbody.children || [])
    .filter((c: any) => c.tagName === 'tr')
    .map((row: any) =>
      (row.children || [])
        .filter((c: any) => c.tagName === 'td' || c.tagName === 'th')
        .map(hastText)
    )
  if (rows.length === 0) return null
  return (
    <div className="ai-leaderboard">
      <div className="ai-lb-header">
        <span className="ai-lb-chip">Bảng xếp hạng</span>
        <h2 className="ai-lb-title">Xu hướng</h2>
      </div>
      {rows.map((cells, i) => {
        const name  = cells[1] ?? cells[0] ?? ''
        const stars = cells[2] ?? ''
        const rawDesc = cells[4] ?? ''
        const tech  = cells[5] ?? ''
        const flow  = cells[6] ?? ''
        const isOpen = expanded === i
        const desc = (rawDesc && rawDesc !== '—') ? rawDesc : tech
        const starCount = parseInt((stars.match(/[\d,]+/)?.[0] ?? '0').replace(/,/g, ''), 10)
        const trend = stars.includes('🚀') || starCount > 2000 ? 'up' : starCount < 400 ? 'down' : 'neutral'
        const starsLabel = stars.replace(' 🚀', '').trim()
        const ghUrl = name.includes('/') ? `https://github.com/${name}` : null
        return (
          <div
            key={i}
            className={`ai-lb-row${isOpen ? ' ai-lb-row--open' : ''}`}
            onClick={() => setExpanded(isOpen ? null : i)}
          >
            <div className="ai-lb-row-main">
              <span className="ai-lb-rank">{i + 1}</span>
              <div className="ai-lb-icon">
                <div className="ai-lb-icon-bg" style={{ background: AI_RANK_GRADIENTS[i % AI_RANK_GRADIENTS.length] }} />
              </div>
              <div className="ai-lb-body">
                <div className="ai-lb-name">{name}</div>
                {desc && <div className="ai-lb-desc">{desc}</div>}
              </div>
              <span className={`ai-lb-trend ai-lb-trend--${trend}`}>
                {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '▬'} {starsLabel}
              </span>
            </div>
            {isOpen && (
              <div className="ai-lb-detail">
                {tech && <div className="ai-lb-detail-item"><span className="ai-lb-detail-label">Stack</span>{tech}</div>}
                {flow && <div className="ai-lb-detail-item"><span className="ai-lb-detail-label">Flow</span>{flow}</div>}
                {ghUrl && (
                  <a
                    href={ghUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ai-lb-gh-link"
                    onClick={e => e.stopPropagation()}
                  >GitHub →</a>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const MD_COMPONENTS = { table: ({ node }: any) => <AiTable node={node} /> }

function providerLogo(provider: string | undefined, model: string | undefined): React.ReactElement {
  let p = (provider || 'unknown').toLowerCase()
  if ((p === 'openrouter' || p === 'unknown') && model) {
    const m = model.toLowerCase()
    if (m.includes('openai') || m.startsWith('gpt')) p = 'openai'
    else if (m.includes('google/') || m.startsWith('gemini')) p = 'gemini'
    else if (m.includes('meta-llama') || m.includes('/llama')) p = 'meta'
    else if (m.includes('mistralai') || m.includes('mistral/')) p = 'mistral'
    else if (m.includes('anthropic/') || m.startsWith('claude')) p = 'anthropic'
    else if (m.includes('deepseek')) p = 'deepseek'
    else if (m.includes('qwen') || m.startsWith('qwq')) p = 'qwen'
    else if (m.includes('microsoft/') || m.includes('/phi')) p = 'microsoft'
    else if (m.includes('cohere') || m.includes('command')) p = 'cohere'
    else if (m.includes('perplexity') || m.includes('sonar')) p = 'perplexity'
    else if (m.includes('x-ai/') || m.includes('/grok')) p = 'xai'
    else if (m.includes('nvidia') || m.includes('nemotron')) p = 'nvidia'
    else if (m.includes('01-ai') || m.startsWith('yi-')) p = 'yi'
  }
  const sz = { width: 22, height: 22 }
  switch (p) {
    case 'deepseek':
      return (
        <svg {...sz} viewBox="0 0 57 42" fill="#000">
          <path fillRule="nonzero" d="M55.6128 3.47119C55.0175 3.17944 54.7611 3.73535 54.413 4.01782C54.2939 4.10889 54.1932 4.22729 54.0924 4.33667C53.2223 5.26587 52.2057 5.87646 50.8776 5.80347C48.9359 5.69409 47.2781 6.30469 45.8126 7.78979C45.5012 5.9585 44.4663 4.86499 42.8909 4.16357C42.0667 3.79907 41.2332 3.43457 40.6561 2.64185C40.2532 2.07715 40.1432 1.44849 39.9418 0.828857C39.8135 0.455322 39.6853 0.0725098 39.2548 0.00878906C38.7877 -0.0639648 38.6045 0.327637 38.4213 0.655762C37.6886 1.99512 37.4047 3.47119 37.4321 4.96533C37.4962 8.32739 38.9159 11.0059 41.7369 12.9102C42.0575 13.1289 42.1399 13.3474 42.0392 13.6665C41.8468 14.3225 41.6178 14.9602 41.4164 15.6162C41.2881 16.0354 41.0957 16.1265 40.647 15.9441C39.0991 15.2974 37.7618 14.3406 36.5803 13.1836C34.5745 11.2429 32.761 9.10181 30.4988 7.42529C29.9675 7.03345 29.4363 6.66919 28.8867 6.32275C26.5786 4.08154 29.189 2.24097 29.7935 2.02246C30.4254 1.79468 30.0133 1.01099 27.9708 1.02026C25.9283 1.0293 24.0599 1.71265 21.6786 2.62378C21.3306 2.7605 20.9641 2.8606 20.5886 2.94263C18.4271 2.53271 16.1831 2.44141 13.8384 2.70581C9.42371 3.19775 5.89758 5.28418 3.30554 8.84668C0.191406 13.1289 -0.54126 17.9941 0.356323 23.0691C1.29968 28.4172 4.02905 32.8452 8.22388 36.3076C12.5745 39.8972 17.5845 41.6558 23.2997 41.3186C26.771 41.1182 30.6361 40.6536 34.9958 36.9636C36.0948 37.5103 37.2489 37.7288 39.1632 37.8928C40.6378 38.0295 42.0575 37.8201 43.1565 37.5923C44.8784 37.2278 44.7594 35.6333 44.1366 35.3418C39.09 32.9912 40.1981 33.9478 39.1907 33.1733C41.7552 30.1394 45.6204 26.9868 47.1316 16.7732C47.2506 15.9624 47.1499 15.4521 47.1316 14.7961C47.1224 14.3953 47.214 14.2405 47.672 14.1948C48.9359 14.0491 50.1632 13.7029 51.2898 13.0833C54.5596 11.2976 55.8784 8.36377 56.1898 4.84692C56.2357 4.30933 56.1807 3.75342 55.6128 3.47119ZM27.119 35.123C22.2281 31.2783 19.856 30.0117 18.8759 30.0664C17.96 30.1211 18.1249 31.1689 18.3263 31.8523C18.537 32.5264 18.8118 32.9912 19.1964 33.5833C19.462 33.9751 19.6453 34.5581 18.9309 34.9956C17.3555 35.9705 14.6169 34.6675 14.4886 34.6038C11.3014 32.7268 8.63611 30.2485 6.75842 26.8594C4.94495 23.5974 3.89172 20.0989 3.71765 16.3633C3.67188 15.4614 3.9375 15.1423 4.83508 14.9785C6.0166 14.7598 7.23474 14.7141 8.41626 14.8872C13.408 15.6162 17.6577 17.8484 21.2206 21.3835C23.2539 23.397 24.7926 25.8025 26.3772 28.1531C28.0624 30.6494 29.8759 33.0276 32.184 34.9773C32.9991 35.6606 33.6494 36.1799 34.2722 36.5627C32.3947 36.7722 29.2622 36.8179 27.119 35.123ZM29.4637 20.0442C29.4637 19.6433 29.7843 19.3245 30.1874 19.3245C30.2789 19.3245 30.3613 19.3425 30.4346 19.3699C30.5354 19.4065 30.627 19.4612 30.7002 19.543C30.8285 19.6707 30.9017 19.8528 30.9017 20.0442C30.9017 20.4451 30.5812 20.7639 30.1782 20.7639C29.7751 20.7639 29.4637 20.4451 29.4637 20.0442ZM36.7452 23.7798C36.2781 23.9712 35.811 24.135 35.3622 24.1533C34.6661 24.1897 33.9059 23.9072 33.4938 23.561C32.8527 23.0234 32.3947 22.7229 32.2023 21.7844C32.1199 21.3835 32.1656 20.7639 32.239 20.4087C32.4038 19.6433 32.2206 19.1514 31.6803 18.7048C31.2406 18.3403 30.6819 18.2402 30.0682 18.2402C29.8392 18.2402 29.6287 18.1399 29.4729 18.0579C29.2164 17.9304 29.0059 17.6116 29.2073 17.2197C29.2714 17.0923 29.5829 16.7825 29.6561 16.7278C30.4896 16.2539 31.4513 16.4089 32.3397 16.7642C33.1641 17.1013 33.7869 17.7209 34.6844 18.5955C35.6003 19.6523 35.7651 19.9441 36.2872 20.7366C36.6995 21.3562 37.075 21.9939 37.3314 22.7229C37.4871 23.1785 37.2856 23.552 36.7452 23.7798Z"/>
        </svg>
      )
    case 'anthropic':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <path fillRule="evenodd" d="M12 2L21 22H17L15.5 16H8.5L7 22H3L12 2ZM12 7L9 14H15L12 7Z"/>
        </svg>
      )
    case 'gemini':
    case 'google':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <path d="M12 1.5C12 7.5 17 11.5 22.5 12C17 12.5 12 16.5 12 22.5C12 16.5 7 12.5 1.5 12C7 11.5 12 7.5 12 1.5Z"/>
        </svg>
      )
    case 'openai':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <path d="M12 3C10 3 8.5 4.3 8.3 6.1C7 5 5 5 4 6.2C3 7.4 3.4 9.3 4.8 10.2C3.4 11.1 3 13 4 14.2C5 15.4 7 15.4 8.3 14.3C8.5 16.1 10 17.4 12 17.4C14 17.4 15.5 16.1 15.7 14.3C17 15.4 19 15.4 20 14.2C21 13 20.6 11.1 19.2 10.2C20.6 9.3 21 7.4 20 6.2C19 5 17 5 15.7 6.1C15.5 4.3 14 3 12 3Z"/>
        </svg>
      )
    case 'meta':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <path d="M6.5 7.5C9 7.5 10.5 9.5 12 11.9C13.5 14.3 15 16.3 17.5 16.3C20.5 16.3 22 14.2 22 12C22 9.8 20.5 7.7 17.5 7.7C15 7.7 13.5 9.7 12 12C10.5 14.4 9 16.3 6.5 16.3C3.5 16.3 2 14.2 2 12C2 9.8 3.5 7.5 6.5 7.5Z"/>
        </svg>
      )
    case 'mistral':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <rect x="2" y="3" width="20" height="5" rx="1.5"/>
          <rect x="2" y="11" width="13" height="5" rx="1.5"/>
          <rect x="2" y="19" width="7" height="5" rx="1.5"/>
        </svg>
      )
    case 'groq':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <path d="M13.5 2L4.5 13.5H11L7.5 22L19.5 9.5H13L13.5 2Z"/>
        </svg>
      )
    case 'perplexity':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <rect x="10.5" y="2" width="3" height="20" rx="1.5"/>
          <rect x="2" y="10.5" width="20" height="3" rx="1.5"/>
          <rect x="10.5" y="2" width="3" height="20" rx="1.5" transform="rotate(45 12 12)"/>
          <rect x="10.5" y="2" width="3" height="20" rx="1.5" transform="rotate(-45 12 12)"/>
        </svg>
      )
    case 'xai':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <polygon points="2,2 8,2 22,22 16,22"/>
          <polygon points="16,2 22,2 8,22 2,22"/>
        </svg>
      )
    case 'microsoft':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <rect x="2" y="2" width="9.5" height="9.5"/>
          <rect x="12.5" y="2" width="9.5" height="9.5"/>
          <rect x="2" y="12.5" width="9.5" height="9.5"/>
          <rect x="12.5" y="12.5" width="9.5" height="9.5"/>
        </svg>
      )
    case 'cohere':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <path d="M20 8.5C18 4.5 15 2 11.5 2C6 2 2 6.5 2 12C2 17.5 6 22 11.5 22C15 22 18 19.5 20 15.5H16.5C15 18 13.4 19.5 11.5 19.5C7.5 19.5 4.5 16.1 4.5 12C4.5 7.9 7.5 4.5 11.5 4.5C13.4 4.5 15 5.9 16.5 8.5H20Z"/>
        </svg>
      )
    case 'qwen':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <path d="M12 2C7 2 3 6 3 11.5C3 17 7 21 12 21C14.5 21 16.8 20 18.5 18.3L21 21L22.5 19.5L20 16.8C21.1 15.2 21.8 13 21.8 11.5C21.8 6 17.5 2 12 2ZM12 4.5C16.1 4.5 19.3 7.6 19.3 11.5C19.3 15.4 16.1 18.5 12 18.5C7.9 18.5 4.7 15.4 4.7 11.5C4.7 7.6 7.9 4.5 12 4.5Z"/>
        </svg>
      )
    case 'nvidia':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <path d="M12 2L22 12L12 22L2 12Z"/>
        </svg>
      )
    case 'yi':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <path d="M12 2L18 9H14V22H10V9H6L12 2Z"/>
        </svg>
      )
    case 'openrouter':
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <path fillRule="evenodd" d="M12 2L20.66 7V17L12 22L3.34 17V7ZM12 7.5L8 9.8V14.2L12 16.5L16 14.2V9.8Z"/>
        </svg>
      )
    default:
      return (
        <svg {...sz} viewBox="0 0 24 24" fill="#000">
          <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5Z"/>
        </svg>
      )
  }
}

export default function AIAssistantPage() {
  const { t } = useTranslation()
  const player = usePlayer()
  const location = useLocation()
  const [messages, setMessages] = useState<Message[]>([
    { id: msgSeq++, role: 'assistant', text: t('ai.greeting') },
  ])
  const [input, setInput] = useState((location.state as any)?.prompt ?? '')
  const [model, setModel] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [history, setHistory] = useState<ChatTurn[]>([])
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [facts, setFacts] = useState<MemoryFact[]>([])
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsFailedOnly, setLogsFailedOnly] = useState(false)
  const [sessions, setSessions] = useState<SessionEntry[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const sessionIdRef = useRef<string>(crypto.randomUUID())
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const lastUserTextRef = useRef<string>('')
  const [slashSuggestions, setSlashSuggestions] = useState<typeof MCP_TOOLS>([])
  const [slashIdx, setSlashIdx] = useState(0)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMemory = useCallback(async () => {
    setMemoryLoading(true)
    try {
      const res = await fetch('/api/ai/memory')
      if (res.ok) {
        const data = await res.json()
        setFacts(data.facts || [])
      }
    } finally {
      setMemoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (memoryOpen) loadMemory()
  }, [memoryOpen, loadMemory])

  const loadLogs = useCallback(async (failedOnly: boolean) => {
    setLogsLoading(true)
    try {
      const url = failedOnly ? '/api/ai/logs?failed=1&limit=30' : '/api/ai/logs?limit=30'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } finally {
      setLogsLoading(false)
    }
  }, [])

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const res = await fetch('/api/ai/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (logsOpen) loadSessions()
  }, [logsOpen, loadSessions])

  const deleteFact = async (key: string) => {
    await fetch(`/api/ai/memory/${encodeURIComponent(key)}`, { method: 'DELETE' })
    setFacts(prev => prev.filter(f => f.key !== key))
  }

  const exportMemory = () => {
    const json = JSON.stringify({ facts: facts.map(f => ({ key: f.key, value: f.value })) }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'agent-memory.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const restoreSession = async (sessionId: string) => {
    const res = await fetch(`/api/ai/sessions/${sessionId}/messages`)
    if (!res.ok) return
    const data = await res.json()
    const msgs: typeof data.messages = data.messages || []
    if (msgs.length === 0) return
    const restored: Message[] = [{ id: msgSeq++, role: 'assistant', text: t('ai.greeting') }]
    const hist: ChatTurn[] = []
    for (const m of msgs) {
      const actions: Action[] = (() => { try { const r = JSON.parse(m.actions); return Array.isArray(r) ? r : [] } catch { return [] } })()
      restored.push({ id: msgSeq++, role: 'user', text: m.user_msg })
      restored.push({ id: msgSeq++, role: 'assistant', text: m.ai_msg, actions, model: m.model, provider: m.provider, tokensIn: m.tokens_in, tokensOut: m.tokens_out })
      hist.push({ role: 'user', content: m.user_msg })
      hist.push({ role: 'assistant', content: m.ai_msg })
    }
    setMessages(restored)
    setHistory(hist)
    sessionIdRef.current = sessionId  // continue appending to same session
    setLogsOpen(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const restoreLog = (log: LogEntry) => {
    const actions: Action[] = (() => { try { const r = JSON.parse(log.actions); return Array.isArray(r) ? r : [] } catch { return [] } })()
    setMessages([
      { id: msgSeq++, role: 'assistant', text: t('ai.greeting') },
      { id: msgSeq++, role: 'user', text: log.user_msg },
      { id: msgSeq++, role: 'assistant', text: log.ai_msg, actions, model: log.model, provider: log.provider, tokensIn: log.tokens_in, tokensOut: log.tokens_out },
    ])
    setHistory([
      { role: 'user', content: log.user_msg },
      { role: 'assistant', content: log.ai_msg },
    ])
    setLogsOpen(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const importMemory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const res = await fetch('/api/ai/memory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) loadMemory()
    } catch {}
    if (importRef.current) importRef.current.value = ''
  }

  const executeAction = (action: Action) => {
    if (action.type === 'play_track' && action.id) {
      const t: Track = {
        id: action.id,
        album_id: action.album_id || '',
        title: action.title || action.id,
        track_num: 0,
        duration_s: action.duration_s || 0,
        artist_name: action.artist || '',
      }
      player.setShuffleMode('smart')
      player.play(t, [t])
    } else if (action.type === 'download_youtube' && action.id) {
      fetch('/api/youtube/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: action.id, title: action.title || '', artist: action.artist || '' }),
      }).catch(() => {})
    } else if (action.type === 'set_shuffle_mode' && action.mode) {
      player.setShuffleMode(action.mode as ShuffleMode)
    } else if (action.type === 'set_repeat' && action.mode) {
      player.setRepeat(action.mode as RepeatMode)
    } else if (action.type === 'next_track') {
      player.next()
    } else if (action.type === 'prev_track') {
      player.prev()
    } else if (action.type === 'toggle_play') {
      player.toggle()
    } else if (action.type === 'play_queue' && action.tracks && action.tracks.length > 0) {
      player.play(action.tracks[0], action.tracks)
    }
  }

  const retry = () => {
    const text = lastUserTextRef.current
    if (!text || loading) return
    setMessages(prev => prev.filter(m => !(m.role === 'assistant' && m.text.startsWith('⚠️'))))
    sendMessage(text)
  }

  const send = () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    sendMessage(text)
  }

  const sendMessage = async (text: string, attempt = 1) => {
    if (!text || loading) return
    lastUserTextRef.current = text

    if (attempt === 1) {
      const userMsg: Message = { id: msgSeq++, role: 'user', text }
      setMessages(prev => [...prev, userMsg])
    }
    setLoading(true)
    setStatusText(attempt > 1 ? `Thử lại lần ${attempt - 1}...` : '')

    const MAX_RETRIES = 1

    try {
      const res = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          model,
          session_id: sessionIdRef.current,
          now_playing: player.track ? { id: player.track.id, title: player.track.title, artist: player.track.artist_name || '' } : undefined,
        }),
      })
      if (!res.ok || !res.body) {
        const err = await res.text()
        if (attempt <= MAX_RETRIES) {
          setLoading(false)
          await new Promise(r => setTimeout(r, 2000))
          return sendMessage(text, attempt + 1)
        }
        setMessages(prev => [...prev, { id: msgSeq++, role: 'assistant', text: `⚠️ ${err}` }])
        return
      }

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6))
            if (ev.status) {
              setStatusText(ev.status)
            } else if (ev.error) {
              setMessages(prev => [...prev, { id: msgSeq++, role: 'assistant', text: `⚠️ ${ev.error}` }])
              return
            } else if (ev.text !== undefined) {
              const actions: Action[] = ev.actions || []
              setMessages(prev => [...prev, {
                id: msgSeq++,
                role: 'assistant',
                text: ev.text || 'Xong rồi!',
                actions,
                model: ev.model || '',
                provider: ev.provider || '',
                tokensIn: ev.tokens_in || 0,
                tokensOut: ev.tokens_out || 0,
                logId: ev.log_id || undefined,
              }])
              actions.forEach(executeAction)
              setHistory(prev => [
                ...prev,
                { role: 'user', content: text },
                { role: 'assistant', content: ev.text || '' },
              ])
              if (memoryOpen) loadMemory()
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (attempt <= MAX_RETRIES) {
        setLoading(false)
        setStatusText('Mất kết nối, thử lại...')
        await new Promise(r => setTimeout(r, 2000))
        return sendMessage(text, attempt + 1)
      }
      setMessages(prev => [...prev, { id: msgSeq++, role: 'assistant', text: `⚠️ ${e.message}` }])
    } finally {
      setLoading(false)
      setStatusText('')
      inputRef.current?.focus()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="ai-page">
      <div className="library-tag">TRỢ LÝ</div>
      <h1 className="page-title" style={{ marginBottom: 8 }}>Trợ lý AI</h1>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '0 8px 4px' }}>
        <Link to="/tools" style={{ fontSize: 11, opacity: 0.45, color: 'inherit', textDecoration: 'none' }}>🛠 Tools</Link>
        <Link to="/ai/stats" style={{ fontSize: 11, opacity: 0.45, color: 'inherit', textDecoration: 'none' }}>📊 Analytics</Link>
      </div>
      <div className="ai-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`ai-bubble-group ai-bubble-group--${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="ai-avatar">
                {providerLogo(msg.provider, msg.model)}
              </div>
            )}
            <div className="ai-bubble-inner">
            <div className={`ai-bubble ai-bubble--${msg.role}`}>
              {msg.role === 'assistant' && msg.model && (
                <div className="ai-bubble-meta">
                  <span className={`ai-provider-badge ai-provider-badge--${msg.provider}`}>{msg.provider}</span>
                  <span className="ai-model-name">{msg.model}</span>
                  {(msg.tokensIn || msg.tokensOut) ? (
                    <span className="ai-token-usage">↑{msg.tokensIn?.toLocaleString()} ↓{msg.tokensOut?.toLocaleString()}</span>
                  ) : null}
                </div>
              )}
              <div className="ai-bubble-text ai-bubble-text--md">
                {msg.role === 'assistant'
                  ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{msg.text}</ReactMarkdown>
                  : msg.text}
              </div>
            </div>
            {msg.actions && msg.actions.filter(a => a.type === 'play_track').length > 0 && (
              <div className="ai-actions">
                {msg.actions.map((a, i) => (
                  a.type === 'play_track' ? (
                    <MediaCard
                      key={i}
                      action={a}
                      onPlay={() => executeAction(a)}
                      onNext={() => player.next()}
                      onPrev={() => player.prev()}
                    />
                  ) : null
                ))}
              </div>
            )}
            {msg.role === 'assistant' && msg.text.startsWith('⚠️') && lastUserTextRef.current && (
              <button
                onClick={retry}
                disabled={loading}
                style={{ marginTop: 4, background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12, padding: '3px 10px' }}
              >🔄 Thử lại</button>
            )}
            {msg.role === 'assistant' && msg.logId && (
              <ReactionBar logId={msg.logId} />
            )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="ai-bubble-group ai-bubble-group--assistant">
            <div className="ai-avatar">
              {providerLogo(model ? undefined : 'deepseek', model || undefined)}
            </div>
            <div className="ai-bubble-inner">
              <div className="ai-bubble ai-bubble--assistant">
                <div className="ai-typing-indicator">
                  <span className="ai-typing-dots">
                    <span className="ai-dot ai-dot--1" />
                    <span className="ai-dot ai-dot--2" />
                    <span className="ai-dot ai-dot--3" />
                  </span>
                  <span>{statusText || 'đang soạn gợi ý…'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compact controls row */}
      <div className="ai-controls-row">
        <button className="ai-ctrl-btn" onClick={() => setMemoryOpen(o => !o)}>
          🧠{facts.length > 0 ? ` ${facts.length}` : ''} {memoryOpen ? '▲' : '▼'}
        </button>
        <button className="ai-ctrl-btn" onClick={() => { setLogsOpen(o => !o); if (!logsOpen) loadSessions() }}>
          📋{sessions.length > 0 && logsOpen ? ` ${sessions.length}` : ''} {logsOpen ? '▲' : '▼'}
        </button>
        <input
          className="ai-model-input"
          placeholder={t('ai.model_placeholder')}
          value={model}
          onChange={e => setModel(e.target.value)}
          disabled={loading}
        />
      </div>

      {memoryOpen && (
        <div className="ai-memory-panel">
          <div className="ai-memory-toolbar">
            <button className="ai-memory-btn" onClick={exportMemory} title="Tải xuống JSON">↓ Export</button>
            <button className="ai-memory-btn" onClick={() => importRef.current?.click()} title="Tải lên JSON">↑ Import</button>
            <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importMemory} />
            <button className="ai-memory-btn ai-memory-btn--danger" onClick={async () => {
              await fetch('/api/ai/memory', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"facts":[]}' })
              setFacts([])
            }}>🗑 Xóa tất cả</button>
          </div>
          {memoryLoading ? (
            <div className="ai-memory-empty">Đang tải…</div>
          ) : facts.length === 0 ? (
            <div className="ai-memory-empty">Chưa có bộ nhớ nào. Hãy chat với AI để nó học về bạn.</div>
          ) : (
            <div className="ai-memory-list">
              {facts.map(f => (
                <div key={f.key} className="ai-memory-fact">
                  <div className="ai-memory-fact-content">
                    <span className="ai-memory-key">{f.key}</span>
                    <span className="ai-memory-value">{f.value}</span>
                  </div>
                  <button className="ai-memory-delete" onClick={() => deleteFact(f.key)} title="Xóa">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {logsOpen && (
        <div className="ai-memory-panel">
          <div className="ai-memory-toolbar">
            <button className="ai-memory-btn" onClick={loadSessions}>↻ Tải lại</button>
          </div>
          {sessionsLoading ? (
            <div className="ai-memory-empty">Đang tải…</div>
          ) : sessions.length === 0 ? (
            <div className="ai-memory-empty">Chưa có lịch sử.</div>
          ) : (
            <div className="ai-memory-list">
              {sessions.map(s => (
                <div key={s.session_id} className="ai-memory-fact" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontSize: '10px', opacity: 0.5 }}>{(s.last_at || '').slice(5, 16)}</span>
                    <span style={{ fontSize: '10px', opacity: 0.35, marginLeft: 2 }}>{s.turns} lượt</span>
                    <button
                      onClick={() => restoreSession(s.session_id)}
                      style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, cursor: 'pointer', fontSize: '10px', padding: '1px 8px', color: 'var(--accent)' }}
                    >↩ Vào room</button>
                  </div>
                  <div className="ai-memory-key" style={{ fontSize: '12px' }}>
                    {(s.preview || '').slice(0, 80)}{(s.preview || '').length > 80 ? '…' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {slashSuggestions.length > 0 && (
        <div className="slash-suggestions">
          {slashSuggestions.map((t, i) => (
            <div
              key={t.name}
              className={`slash-suggestion-item${i === slashIdx ? ' slash-suggestion-item--active' : ''}`}
              onMouseDown={e => { e.preventDefault(); setInput(t.prompt); setSlashSuggestions([]) }}
            >
              <span className="slash-suggestion-name">/{t.name}</span>
              <span className="slash-suggestion-desc">{t.description}</span>
            </div>
          ))}
        </div>
      )}
      <div className="ai-input-row">
        <div className="ai-input-wrap">
        {slashSuggestions.length > 0 && (() => {
          const top = slashSuggestions[slashIdx]
          const typed = input  // e.g. "/play"
          const full = '/' + top.name  // e.g. "/play_track"
          const ghost = full.startsWith(typed) ? full.slice(typed.length) : ''
          return ghost ? (
            <div className="ai-ghost-text" aria-hidden="true">
              <span style={{ visibility: 'hidden' }}>{typed}</span>
              <span className="ai-ghost-completion">{ghost} </span>
              <span className="ai-ghost-label">Tab</span>
            </div>
          ) : null
        })()}
        <textarea
          ref={inputRef}
          className="ai-input"
          rows={2}
          placeholder={t('ai.placeholder')}
          value={input}
          onChange={e => {
            const v = e.target.value
            setInput(v)
            const slashMatch = v.match(/^\/(\S*)$/)
            if (slashMatch) {
              const q = slashMatch[1].toLowerCase()
              const hits = MCP_TOOLS.filter(t => t.name.includes(q) || t.description.toLowerCase().includes(q)).slice(0, 8)
              setSlashSuggestions(hits)
              setSlashIdx(0)
            } else {
              setSlashSuggestions([])
            }
          }}
          onKeyDown={e => {
            if (slashSuggestions.length > 0) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIdx(i => Math.min(i + 1, slashSuggestions.length - 1)); return }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIdx(i => Math.max(i - 1, 0)); return }
              if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault()
                const t = slashSuggestions[slashIdx]
                setInput(t.prompt)
                setSlashSuggestions([])
                return
              }
              if (e.key === 'Escape') { setSlashSuggestions([]); return }
            }
            onKeyDown(e)
          }}
          disabled={loading}
        />
        <button
          className="ai-send-btn"
          onClick={send}
          disabled={loading || !input.trim()}
          title={t('ai.send')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#070708" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
        </div>
      </div>
    </div>
  )
}
