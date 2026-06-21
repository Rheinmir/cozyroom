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
            {msg.role === 'assistant' && <div className="ai-avatar">✦</div>}
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
                  ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
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
          <div className="ai-bubble ai-bubble--assistant">
            {statusText
              ? <span className="ai-status-text">{statusText}</span>
              : <span className="ai-typing">···</span>
            }
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
        </div>
        <button
          className="ai-send-btn"
          onClick={send}
          disabled={loading || !input.trim()}
          title={t('ai.send')}
        >
          ➤
        </button>
      </div>
    </div>
  )
}
