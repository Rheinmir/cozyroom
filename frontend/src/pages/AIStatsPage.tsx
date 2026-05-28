import { useEffect, useState, useCallback, useRef } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

interface DayStat { date: string; count: number; failed: number; tokens_in: number; tokens_out: number; avg_ms: number }
interface KV      { name: string; count: number }
interface HourStat{ hour: number; count: number }
interface Summary { total: number; failed: number; tokens_in: number; tokens_out: number; avg_ms: number }
interface ExtremeLog { id: string; created_at: string; model: string; tokens_in: number; tokens_out: number; response_ms: number; user_msg: string; ai_msg: string }
interface Extremes { most_expensive: ExtremeLog; cheapest: ExtremeLog }
interface Stats {
  daily: DayStat[]
  models: KV[]
  all_models: KV[]
  providers: KV[]
  failures: KV[]
  hourly: HourStat[]
  actions: KV[]
  summary: Summary
}
interface DailyModelStat { date: string; model: string; tokens_in: number; tokens_out: number }

interface LogEntry {
  id: string
  created_at: string
  model: string
  provider: string
  user_msg: string
  ai_msg: string
  failed: number
  fail_reason: string
  tool_errors: string
  tokens_in: number
  tokens_out: number
}

const COLORS = ['#6366f1','#22d3ee','#f59e0b','#10b981','#f87171','#a78bfa','#fb923c','#34d399']
const fmtMs = (ms: number) => ms >= 1000 ? `${(ms/1000).toFixed(1)}s` : `${Math.round(ms)}ms`
const fmtNum = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n)

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px 16px', textAlign: 'center', minWidth: 100 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.6, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      {children}
    </div>
  )
}

export default function AIStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'charts' | 'logs'>('charts')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsFailedOnly, setLogsFailedOnly] = useState(false)
  const [logsPage, setLogsPage] = useState(0)
  const [extremes, setExtremes] = useState<Extremes | null>(null)
  const [extremeModel, setExtremeModel] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
  const [dateTo, setDateTo] = useState(today)
  const [modelPrices, setModelPrices] = useState<Record<string, { i: number; o: number }>>(() => {
    try { return JSON.parse(localStorage.getItem('ai-model-prices') || '{}') } catch { return {} }
  })
  const [showPricing, setShowPricing] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrPending, setOcrPending] = useState<{ b64: string; mime: string; dataUrl: string; prompt: string } | null>(null)
  const ocrInputRef = useRef<HTMLInputElement>(null)
  const priceSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dailyModelData, setDailyModelData] = useState<DailyModelStat[]>([])
  const OCR_DEFAULT_PROMPT = 'Extract model pricing from this image. Return ONLY a JSON array (no markdown): [{"model":"<exact model id>","input_per_1m":<number>,"output_per_1m":<number>}]. Prices in USD per 1 million tokens.'
  const PAGE = 50

  useEffect(() => {
    fetch('/api/ai/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const p = new URLSearchParams()
    if (extremeModel) p.set('model', extremeModel)
    if (dateFrom) p.set('from', dateFrom)
    if (dateTo) p.set('to', dateTo)
    fetch(`/api/ai/extremes?${p}`).then(r => r.json()).then(d => setExtremes(d)).catch(() => {})
  }, [extremeModel, dateFrom, dateTo])

  useEffect(() => { localStorage.setItem('ai-model-prices', JSON.stringify(modelPrices)) }, [modelPrices])

  // Load prices from DB on mount (DB wins over localStorage)
  useEffect(() => {
    fetch('/api/ai/model-prices').then(r => r.json()).then((list: Array<{model: string; price_in: number; price_out: number}>) => {
      if (list.length > 0) {
        setModelPrices(prev => {
          const next = { ...prev }
          for (const p of list) next[p.model] = { i: p.price_in, o: p.price_out }
          return next
        })
      }
    }).catch(() => {})
  }, [])

  // Sync prices to DB on change (debounced 1s)
  useEffect(() => {
    if (priceSyncRef.current) clearTimeout(priceSyncRef.current)
    priceSyncRef.current = setTimeout(() => {
      const payload = Object.entries(modelPrices).map(([model, p]) => ({ model, price_in: p.i, price_out: p.o }))
      if (payload.length > 0) {
        fetch('/api/ai/model-prices', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {})
      }
    }, 1000)
  }, [modelPrices])

  // Fetch daily per-model token data
  useEffect(() => {
    const p = new URLSearchParams()
    if (dateFrom) p.set('from', dateFrom)
    if (dateTo) p.set('to', dateTo)
    fetch(`/api/ai/stats/daily?${p}`).then(r => r.json()).then(d => setDailyModelData(d)).catch(() => {})
  }, [dateFrom, dateTo])

  const updatePrice = (model: string, field: 'i' | 'o', val: string) => {
    const num = parseFloat(val)
    setModelPrices(prev => ({ ...prev, [model]: { ...prev[model], [field]: isNaN(num) ? 0 : num } }))
  }

  const calcCost = (log: ExtremeLog | undefined): string | null => {
    if (!log?.id) return null
    const p = modelPrices[log.model]
    if (!p) return null
    const cost = (log.tokens_in * (p.i || 0) / 1_000_000) + (log.tokens_out * (p.o || 0) / 1_000_000)
    if (!cost) return null
    return cost < 0.0001 ? '<$0.0001' : `≈$${cost.toFixed(4)}`
  }

  const handleOcrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => {
      const dataUrl = r.result as string
      const b64 = dataUrl.split(',')[1]
      setOcrPending({ b64, mime: file.type, dataUrl, prompt: OCR_DEFAULT_PROMPT })
    }
    r.readAsDataURL(file)
    if (ocrInputRef.current) ocrInputRef.current.value = ''
  }

  const submitOcr = async () => {
    if (!ocrPending) return
    setOcrLoading(true)
    try {
      const resp = await fetch('/api/ai/ocr-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64: ocrPending.b64, mime: ocrPending.mime, prompt: ocrPending.prompt }),
      })
      if (resp.ok) {
        const data = await resp.json()
        const prices: Array<{ model: string; input_per_1m: number; output_per_1m: number }> = data.prices || []
        if (prices.length > 0) {
          const knownNames = all_models.map(m => m.name)
          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
          const fuzzyMatch = (ocrName: string): string => {
            if (knownNames.includes(ocrName)) return ocrName
            const n = norm(ocrName)
            return knownNames.find(k => norm(k).includes(n) || n.includes(norm(k))) ?? ocrName
          }
          setModelPrices(prev => {
            const next = { ...prev }
            for (const p of prices) {
              if (p.model) next[fuzzyMatch(p.model)] = { i: p.input_per_1m || 0, o: p.output_per_1m || 0 }
            }
            return next
          })
          setOcrPending(null)
        }
      }
    } finally {
      setOcrLoading(false)
    }
  }

  const handleDislike = async (id: string) => {
    await fetch(`/api/ai/logs/${id}/dislike`, { method: 'POST' })
    setLogs(prev => prev.map(l => l.id === id ? { ...l, failed: 1, fail_reason: 'user_dislike' } : l))
  }

  const loadLogs = useCallback(async (failedOnly: boolean, page: number) => {
    setLogsLoading(true)
    try {
      const url = `/api/ai/logs?limit=${PAGE}&offset=${page * PAGE}${failedOnly ? '&failed=1' : ''}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'logs') loadLogs(logsFailedOnly, logsPage)
  }, [tab, logsFailedOnly, logsPage, loadLogs])

  if (loading) return <div style={{ padding: 32, opacity: 0.5 }}>Đang tải…</div>
  if (!stats) return <div style={{ padding: 32, opacity: 0.5 }}>Không load được stats.</div>

  const { summary, daily, models, all_models, providers: _providers, failures, hourly, actions } = stats
  const successRate = summary.total > 0 ? Math.round((1 - summary.failed / summary.total) * 100) : 100

  // Show full name when short name collides across models
  const shortNames = all_models.map(m => m.name.split('/').pop() ?? m.name)
  const shortNameCount: Record<string, number> = {}
  shortNames.forEach(s => { shortNameCount[s] = (shortNameCount[s] || 0) + 1 })
  const modelLabel = (fullName: string) => {
    const short = fullName.split('/').pop() ?? fullName
    return shortNameCount[short] > 1 ? fullName : short
  }

  // daily tokens merged
  const dailyTokens = daily.map(d => ({ date: d.date.slice(5), tokens_in: d.tokens_in, tokens_out: d.tokens_out }))

  // daily messages + failed
  const dailyMsg = daily.map(d => ({ date: d.date.slice(5), total: d.count, failed: d.failed, success: d.count - d.failed }))

  // avg ms per day
  const dailyMs = daily.filter(d => d.avg_ms > 0).map(d => ({ date: d.date.slice(5), ms: Math.round(d.avg_ms) }))

  // token+cost chart: pivot dailyModelData into [{date, model1: tokens, model2: tokens, ..., cost}]
  const dailyModelModels = [...new Set(dailyModelData.map(d => d.model))]
  const tokenCostChartData = (() => {
    const byDate: Record<string, Record<string, { in: number; out: number }>> = {}
    for (const d of dailyModelData) {
      if (!byDate[d.date]) byDate[d.date] = {}
      if (!byDate[d.date][d.model]) byDate[d.date][d.model] = { in: 0, out: 0 }
      byDate[d.date][d.model].in  += d.tokens_in
      byDate[d.date][d.model].out += d.tokens_out
    }
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, md]) => {
      let cost = 0
      const row: Record<string, number | string> = { date: date.slice(5) }
      for (const [model, { in: ti, out: to }] of Object.entries(md)) {
        row[model] = ti + to
        const p = modelPrices[model]
        if (p) cost += (ti * (p.i || 0) / 1_000_000) + (to * (p.o || 0) / 1_000_000)
      }
      row.cost = cost
      return row
    })
  })()

  // price rate comparison: $/1M tokens — only models that have been used, sorted by output price desc
  const usedModels = new Set(logs.map(l => l.model))
  const modelRateData = Object.entries(modelPrices)
    .filter(([model, p]) => usedModels.has(model) && (p.i || p.o))
    .map(([model, p]) => ({ model: modelLabel(model), input: p.i || 0, output: p.o || 0 }))
    .sort((a, b) => (b.output + b.input) - (a.output + a.input))

  return (
    <div style={{ padding: '16px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>AI Analytics</h2>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {(['charts', 'logs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
              background: tab === t ? 'var(--accent)' : 'var(--surface)',
              color: tab === t ? '#fff' : 'inherit', fontWeight: tab === t ? 600 : 400,
            }}>{t === 'charts' ? 'Biểu đồ' : 'Logs'}</button>
          ))}
        </div>
      </div>

      {tab === 'logs' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <button onClick={() => { setLogsFailedOnly(f => !f); setLogsPage(0) }} style={{
              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
              background: logsFailedOnly ? '#f87171' : 'var(--surface)', color: logsFailedOnly ? '#fff' : 'inherit',
            }}>{logsFailedOnly ? '⚠️ Chỉ lỗi' : 'Tất cả'}</button>
            <button onClick={() => loadLogs(logsFailedOnly, logsPage)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: 'var(--surface)' }}>↻</button>
            <span style={{ fontSize: 11, opacity: 0.4, marginLeft: 'auto' }}>trang {logsPage + 1}</span>
            <button disabled={logsPage === 0} onClick={() => setLogsPage(p => p - 1)} style={{ padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 12, background: 'var(--surface)', opacity: logsPage === 0 ? 0.3 : 1 }}>‹</button>
            <button disabled={logs.length < PAGE} onClick={() => setLogsPage(p => p + 1)} style={{ padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 12, background: 'var(--surface)', opacity: logs.length < PAGE ? 0.3 : 1 }}>›</button>
          </div>
          {logsLoading ? (
            <div style={{ opacity: 0.5, padding: 16 }}>Đang tải…</div>
          ) : logs.length === 0 ? (
            <div style={{ opacity: 0.5, padding: 16 }}>{logsFailedOnly ? 'Không có lỗi nào.' : 'Chưa có log.'}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logs.map(log => {
                const toolErrs: string[] = (() => { try { const r = JSON.parse(log.tool_errors); return Array.isArray(r) ? r : [] } catch { return [] } })()
                return (
                  <div key={log.id} style={{
                    background: 'var(--surface)', borderRadius: 8, padding: '10px 14px',
                    borderLeft: `3px solid ${log.failed ? '#f87171' : '#4ade80'}`,
                  }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      {log.failed
                        ? <span style={{ color: '#f87171', fontSize: 11 }}>⚠️ {log.fail_reason}</span>
                        : <span style={{ color: '#4ade80', fontSize: 11 }}>✓</span>}
                      <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 'auto' }}>{(log.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                      <span style={{ fontSize: 10, opacity: 0.4 }}>{modelLabel(log.model || '')}</span>
                      <span style={{ fontSize: 10, opacity: 0.35 }}>↑{log.tokens_in} ↓{log.tokens_out}</span>
                      <button onClick={() => handleDislike(log.id)} title="Đánh dấu xấu" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '0 2px', opacity: log.fail_reason === 'user_dislike' ? 1 : 0.25, color: log.fail_reason === 'user_dislike' ? '#f87171' : 'inherit' }}>👎</button>
                    </div>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>👤 {(log.user_msg || '').slice(0, 120)}{(log.user_msg || '').length > 120 ? '…' : ''}</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>🤖 {(log.ai_msg || '').slice(0, 160)}{(log.ai_msg || '').length > 160 ? '…' : ''}</div>
                    {toolErrs.length > 0 && (
                      <div style={{ fontSize: 10, color: '#fca5a5', marginTop: 4 }}>
                        {toolErrs.map((e, i) => <div key={i}>🔧 {e}</div>)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'charts' && <>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <SummaryCard label="Tổng cuộc hội thoại" value={fmtNum(summary.total)} />
        <SummaryCard label="Tỷ lệ thành công" value={`${successRate}%`} />
        <SummaryCard label="Tokens vào (tổng)" value={fmtNum(summary.tokens_in)} />
        <SummaryCard label="Tokens ra (tổng)" value={fmtNum(summary.tokens_out)} />
        <SummaryCard label="Thời gian TB" value={summary.avg_ms > 0 ? fmtMs(summary.avg_ms) : 'N/A'} />
        <SummaryCard label="Thất bại" value={String(summary.failed)} />
        {summary.total > 0 && <SummaryCard label="TB in/req" value={fmtNum(Math.round(summary.tokens_in / summary.total))} />}
        {summary.total > 0 && <SummaryCard label="TB out/req" value={fmtNum(Math.round(summary.tokens_out / summary.total))} />}
      </div>

      {/* Extreme requests */}
      <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
        {/* Header row: title + date range + model filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Request đắt / rẻ nhất</span>
          {/* Date range */}
          <input type="date" value={dateFrom} max={dateTo} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: 10, background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 6, color: '#fff', padding: '2px 6px', cursor: 'pointer' }} />
          <span style={{ fontSize: 10, opacity: 0.4 }}>→</span>
          <input type="date" value={dateTo} min={dateFrom} max={today} onChange={e => setDateTo(e.target.value)} style={{ fontSize: 10, background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 6, color: '#fff', padding: '2px 6px', cursor: 'pointer' }} />
          {/* Pricing table toggle + OCR */}
          <button onClick={() => setShowPricing(o => !o)} style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', background: showPricing ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)', color: '#fff' }}>
            💰 Giá token {showPricing ? '▲' : '▼'}
          </button>
        </div>

        {/* Model filter pills */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          <button onClick={() => setExtremeModel('')} style={{ fontSize: 10, padding: '2px 9px', borderRadius: 100, border: 'none', cursor: 'pointer', background: extremeModel === '' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)', color: extremeModel === '' ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: extremeModel === '' ? 600 : 400 }}>Tất cả</button>
          {all_models.map((m, i) => (
            <button key={m.name} onClick={() => setExtremeModel(m.name === extremeModel ? '' : m.name)} style={{ fontSize: 10, padding: '2px 9px', borderRadius: 100, border: 'none', cursor: 'pointer', background: extremeModel === m.name ? COLORS[i % COLORS.length] : 'rgba(255,255,255,0.07)', color: extremeModel === m.name ? '#fff' : COLORS[i % COLORS.length], fontWeight: extremeModel === m.name ? 600 : 400 }}>{modelLabel(m.name)}</button>
          ))}
        </div>

        {/* Pricing table */}
        {showPricing && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>Giá ($/1M tokens)</span>
              <input ref={ocrInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleOcrUpload} />
              <button onClick={() => ocrInputRef.current?.click()} disabled={ocrLoading} style={{ fontSize: 10, padding: '2px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#fff', opacity: ocrLoading ? 0.5 : 1 }}>
                📷 OCR từ ảnh
              </button>
            </div>
            {ocrPending && (
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <img src={ocrPending.dataUrl} alt="preview" style={{ width: 100, borderRadius: 6, flexShrink: 0, objectFit: 'cover' }} />
                  <textarea
                    value={ocrPending.prompt}
                    onChange={e => setOcrPending(p => p ? { ...p, prompt: e.target.value } : p)}
                    rows={4}
                    style={{ flex: 1, fontSize: 11, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 8px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => setOcrPending(null)} style={{ fontSize: 11, padding: '3px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Hủy</button>
                  <button onClick={submitOcr} disabled={ocrLoading} style={{ fontSize: 11, padding: '3px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', background: ocrLoading ? 'rgba(255,255,255,0.15)' : 'rgba(29,185,84,0.7)', color: '#fff', fontWeight: 600 }}>
                    {ocrLoading ? '⏳ Đang gửi…' : 'Gửi'}
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6 }}>
              {all_models.map((m, i) => {
                const p = modelPrices[m.name] || { i: 0, o: 0 }
                const color = COLORS[i % COLORS.length]
                return (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, opacity: 0.7, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modelLabel(m.name)}</span>
                    <input type="number" min="0" step="0.01" value={p.i || ''} placeholder="in" onChange={e => updatePrice(m.name, 'i', e.target.value)}
                      style={{ width: 56, fontSize: 10, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 4, color: '#fff', padding: '2px 5px', textAlign: 'right' }} />
                    <input type="number" min="0" step="0.01" value={p.o || ''} placeholder="out" onChange={e => updatePrice(m.name, 'o', e.target.value)}
                      style={{ width: 56, fontSize: 10, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 4, color: '#fff', padding: '2px 5px', textAlign: 'right' }} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Extreme cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          {([
            { label: '💸 Đắt nhất', log: extremes?.most_expensive },
            { label: '💚 Rẻ nhất',  log: extremes?.cheapest },
          ] as const).map(({ label, log }) => {
            const modelIdx = log?.model ? all_models.findIndex(m => m.name === log.model) : -1
            const modelColor = modelIdx >= 0 ? COLORS[modelIdx % COLORS.length] : 'rgba(255,255,255,0.3)'
            const cost = calcCost(log)
            return (
              <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.75 }}>{label}</span>
                  {log?.model && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 100, background: modelColor + '33', color: modelColor, fontWeight: 600 }}>{modelLabel(log.model)}</span>}
                  <span style={{ fontSize: 10, opacity: 0.35, marginLeft: 'auto' }}>{(log?.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                </div>
                {log?.id ? <>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtNum((log.tokens_in || 0) + (log.tokens_out || 0))} tok</span>
                    <span style={{ fontSize: 10, opacity: 0.5 }}>↑{fmtNum(log.tokens_in)} ↓{fmtNum(log.tokens_out)}</span>
                    {log.response_ms > 0 && <span style={{ fontSize: 10, opacity: 0.35 }}>{fmtMs(log.response_ms)}</span>}
                    {cost && <span style={{ fontSize: 11, fontWeight: 700, color: '#facc15', marginLeft: 'auto' }}>{cost}</span>}
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 3, lineHeight: 1.5 }}>👤 {(log.user_msg || '').slice(0, 120)}{(log.user_msg || '').length > 120 ? '…' : ''}</div>
                  <div style={{ fontSize: 10, opacity: 0.4, lineHeight: 1.5 }}>🤖 {(log.ai_msg || '').slice(0, 160)}{(log.ai_msg || '').length > 160 ? '…' : ''}</div>
                </> : <div style={{ fontSize: 10, opacity: 0.3 }}>Không có dữ liệu</div>}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 14 }}>

        {/* Messages per day */}
        <ChartCard title="Tin nhắn theo ngày (30 ngày)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyMsg} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e1e1e', border: '1px solid #333', fontSize: 12 }} />
              <Bar dataKey="success" stackId="a" fill="#6366f1" name="Thành công" />
              <Bar dataKey="failed"  stackId="a" fill="#f87171" name="Thất bại" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Token usage per day */}
        <ChartCard title="Token sử dụng theo ngày">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyTokens} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtNum} />
              <Tooltip contentStyle={{ background: '#1e1e1e', border: '1px solid #333', fontSize: 12 }} formatter={(v) => fmtNum(v as number)} />
              <Line type="monotone" dataKey="tokens_in"  stroke="#22d3ee" dot={false} name="Tokens vào" strokeWidth={2} />
              <Line type="monotone" dataKey="tokens_out" stroke="#f59e0b" dot={false} name="Tokens ra"  strokeWidth={2} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Token spend + estimated cost per day per model */}
        {tokenCostChartData.length > 0 && (
          <ChartCard title="Token tiêu thụ theo model + Chi phí ước tính">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={tokenCostChartData} margin={{ top: 0, right: 44, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="tok" tick={{ fontSize: 10 }} tickFormatter={fmtNum} />
                <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 10, fill: '#f59e0b' }} tickFormatter={v => `$${(v as number).toFixed(3)}`} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e1e1e', border: '1px solid #333', fontSize: 12 }}
                  formatter={(val, name) => name === 'cost' ? [`$${Number(val).toFixed(4)}`, 'Chi phí'] : [fmtNum(Number(val)), modelLabel(String(name))]} />
                {dailyModelModels.map((m, i) => (
                  <Bar key={m} yAxisId="tok" dataKey={m} stackId="tok" fill={COLORS[i % COLORS.length]} name={m} />
                ))}
                <Line yAxisId="cost" type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} dot={false} name="cost" />
                <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v) => v === 'cost' ? 'Chi phí ($)' : modelLabel(String(v))} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Price rate comparison $/1M tokens */}
        {modelRateData.length > 0 && (
          <ChartCard title="Giá $/1M token theo model">
            <ResponsiveContainer width="100%" height={Math.max(120, modelRateData.length * 36)}>
              <BarChart data={modelRateData} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="model" tick={{ fontSize: 10 }} width={110} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e1e1e', border: '1px solid #333', fontSize: 12 }}
                  formatter={(val, name) => [`$${Number(val).toFixed(4)}/1M`, name === 'input' ? 'Input' : 'Output']} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="input"  name="Input"  fill="#22d3ee" radius={[0, 2, 2, 0]} barSize={10} />
                <Bar dataKey="output" name="Output" fill="#f59e0b" radius={[0, 2, 2, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Response time */}
        {dailyMs.length > 0 && (
          <ChartCard title="Thời gian phản hồi TB (ms)">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyMs} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtMs(v)} />
                <Tooltip contentStyle={{ background: '#1e1e1e', border: '1px solid #333', fontSize: 12 }} formatter={(v) => fmtMs(v as number)} />
                <Line type="monotone" dataKey="ms" stroke="#10b981" dot={false} strokeWidth={2} name="avg ms" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Hourly activity */}
        <ChartCard title="Hoạt động theo giờ trong ngày">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourly} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={h => `${h}h`} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e1e1e', border: '1px solid #333', fontSize: 12 }} labelFormatter={h => `${h}:00`} />
              <Bar dataKey="count" fill="#a78bfa" name="Tin nhắn" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Action types */}
        {actions.length > 0 && (
          <ChartCard title="Loại hành động AI thực hiện">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={actions.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e1e1e', border: '1px solid #333', fontSize: 12 }} />
                <Bar dataKey="count" name="Lần" radius={[0,3,3,0]}>
                  {actions.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Model distribution */}
        {models.length > 0 && (
          <ChartCard title="Model sử dụng">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={models} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                    {models.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e1e1e', border: '1px solid #333', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {models.map((m, i) => (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 11 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ opacity: 0.8, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modelLabel(m.name)}</span>
                    <span style={{ opacity: 0.5, flexShrink: 0 }}>{m.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        )}

        {/* Failure reasons */}
        {failures.filter(f => f.name !== 'success').length > 0 && (
          <ChartCard title="Lý do thất bại">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={failures.filter(f => f.name !== 'success')} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e1e1e', border: '1px solid #333', fontSize: 12 }} />
                <Bar dataKey="count" fill="#f87171" name="Lần" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

      </div>
      </>}
    </div>
  )
}
