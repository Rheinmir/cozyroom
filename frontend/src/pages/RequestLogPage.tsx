import { useEffect, useRef, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  fetchRequestLog, type RequestEntry,
  fetchDebugInstance, fetchDebugServices, fetchDebugTraceroute,
  type DebugInstance, type DebugServiceCheck, type DebugTraceroute,
} from '../api'
import Spinner from '../components/Spinner'
import { TIP, GRID, AXIS, BAR_H } from '../chartTheme'

const OWNER_PW_KEY = 'cozyroom_owner_password'

const fmtMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

// Traffic-light severity ramp — semantic (5xx error → 2xx ok), not decoration;
// keyed off the chart/status-scoped tokens in index.css so it tracks the theme.
const statusColor = (s: number) =>
  s >= 500 ? 'var(--chart-fail)' : s >= 400 ? 'var(--chart-warn)' : s >= 300 ? 'var(--chart-caution)' : 'var(--chart-ok)'

function SummaryCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'fail' }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className={'stat-tile-value' + (tone ? ` stat-tile-value--${tone}` : '')}>
        {value}{sub && <span className="stat-hero-unit" style={{ fontSize: 12, marginLeft: 6 }}>{sub}</span>}
      </div>
    </div>
  )
}

type EndpointStat = { endpoint: string; avg: number; p95: number; max: number; count: number; errors: number }

function computeStats(entries: RequestEntry[]) {
  const byEndpoint: Record<string, number[]> = {}
  const byEndpointErrors: Record<string, number> = {}
  let totalMs = 0
  let errors = 0

  for (const e of entries) {
    totalMs += e.duration_ms
    if (e.status >= 400) errors++
    const key = `${e.method} ${e.path}`
    if (!byEndpoint[key]) { byEndpoint[key] = []; byEndpointErrors[key] = 0 }
    byEndpoint[key].push(e.duration_ms)
    if (e.status >= 400) byEndpointErrors[key]++
  }

  const endpointStats: EndpointStat[] = Object.entries(byEndpoint).map(([endpoint, durations]) => {
    const sorted = [...durations].sort((a, b) => a - b)
    const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1]
    const max = sorted[sorted.length - 1]
    return { endpoint, avg, p95, max, count: sorted.length, errors: byEndpointErrors[endpoint] }
  })
  endpointStats.sort((a, b) => b.avg - a.avg)

  const allMs = entries.map(e => e.duration_ms).sort((a, b) => a - b)
  const p95 = allMs[Math.floor(allMs.length * 0.95)] ?? 0
  const maxMs = allMs[allMs.length - 1] ?? 0

  return {
    total: entries.length,
    errors,
    avgMs: entries.length ? totalMs / entries.length : 0,
    p95Ms: p95,
    maxMs,
    endpointStats,
  }
}

type StatusFilter = 'all' | '2xx' | '3xx' | '4xx' | '5xx'

export default function RequestLogPage() {
  const [entries, setEntries] = useState<RequestEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Whole page is gated by the owner password — this page shows real infra
  // info (pod/node names, internal IPs, service reachability).
  const [ownerPassword, setOwnerPassword] = useState(() => sessionStorage.getItem(OWNER_PW_KEY) || '')
  const [authorized, setAuthorized] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [instance, setInstance] = useState<DebugInstance | null>(null)
  const [services, setServices] = useState<DebugServiceCheck[]>([])
  const [traceroute, setTraceroute] = useState<DebugTraceroute | null>(null)
  const [tracerouteLoading, setTracerouteLoading] = useState(false)

  const loadDebugPanels = useCallback(async (pw: string): Promise<{ ok: boolean; wrongPassword: boolean }> => {
    try {
      const [inst, svc] = await Promise.all([fetchDebugInstance(pw), fetchDebugServices(pw)])
      setInstance(inst)
      setServices(svc)
      return { ok: true, wrongPassword: false }
    } catch (e) {
      const wrongPassword = e instanceof Error && e.message.startsWith('401')
      return { ok: false, wrongPassword }
    }
  }, [])

  useEffect(() => {
    (async () => {
      if (!ownerPassword) { setAuthChecking(false); return }
      const { ok } = await loadDebugPanels(ownerPassword)
      if (ok) { setAuthorized(true) } else { sessionStorage.removeItem(OWNER_PW_KEY); setOwnerPassword('') }
      setAuthChecking(false)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePasswordSubmit = async () => {
    const pw = passwordInput.trim()
    if (!pw) return
    const { ok, wrongPassword } = await loadDebugPanels(pw)
    if (ok) {
      sessionStorage.setItem(OWNER_PW_KEY, pw)
      setOwnerPassword(pw)
      setAuthorized(true)
      setPasswordError('')
    } else {
      setPasswordError(wrongPassword ? 'Mật khẩu sai!' : 'Không kết nối được tới server, thử lại sau.')
    }
  }

  const handleRunTraceroute = async () => {
    setTracerouteLoading(true)
    try {
      setTraceroute(await fetchDebugTraceroute(ownerPassword))
    } catch {
      setTraceroute({ error: 'Gọi traceroute thất bại' })
    }
    setTracerouteLoading(false)
  }

  const load = useCallback(async () => {
    try {
      const data = await fetchRequestLog(ownerPassword)
      setEntries(data)
    } catch {}
    setLoading(false)
  }, [ownerPassword])

  useEffect(() => { if (authorized) load() }, [authorized, load])

  useEffect(() => {
    if (!authorized || !autoRefresh) { if (intervalRef.current) clearInterval(intervalRef.current); return }
    intervalRef.current = setInterval(load, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [authorized, autoRefresh, load])

  const filtered = entries.filter(e => {
    if (filter === '2xx' && (e.status < 200 || e.status >= 300)) return false
    if (filter === '3xx' && (e.status < 300 || e.status >= 400)) return false
    if (filter === '4xx' && (e.status < 400 || e.status >= 500)) return false
    if (filter === '5xx' && e.status < 500) return false
    if (search && !e.path.includes(search) && !e.method.includes(search.toUpperCase())) return false
    return true
  })

  const stats = computeStats(entries)
  const topSlow = stats.endpointStats.slice(0, 12)

  if (authChecking) return <div className="loading">Đang kiểm tra quyền truy cập…</div>

  if (!authorized) {
    return (
      <div className="password-modal-overlay">
        <div className="password-modal">
          <h3>Yêu cầu Mật khẩu</h3>
          <p>Trang debug hiển thị thông tin hạ tầng thật (pod, node, IP nội bộ) — cần mật khẩu chủ sở hữu.</p>
          <input
            className="dropdown-input"
            type="password"
            placeholder="Nhập mật khẩu..."
            value={passwordInput}
            onChange={e => { setPasswordInput(e.target.value); setPasswordError('') }}
            onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit() }}
            autoFocus
          />
          {passwordError && <span className="error-text">{passwordError}</span>}
          <div className="password-modal-actions">
            <button type="button" className="modal-btn modal-btn--confirm" onClick={handlePasswordSubmit}>Xác nhận</button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div className="loading"><Spinner size={28} label="Đang tải…" /></div>

  const errorRate = stats.total > 0 ? ((stats.errors / stats.total) * 100).toFixed(1) : '0'

  return (
    <div className="debug-page-body">
      {/* Header */}
      <div className="stat-head">
        <div>
          <h1 className="stat-title">Request Log</h1>
          <p className="stat-sub">500 request gần nhất · in-memory</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={load} className="stat-icon-btn" title="Tải lại" aria-label="Tải lại"><span className="ms" style={{ fontSize: 17 }} aria-hidden>refresh</span></button>
          <button onClick={() => setAutoRefresh(a => !a)} className={'stat-chip stat-live' + (autoRefresh ? ' stat-live--on' : '')} style={{ height: 28 }}>
            {autoRefresh ? 'Live' : 'Tạm dừng'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="stat-tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <SummaryCard label="Tổng requests" value={String(stats.total)} sub="/ 500" />
        <SummaryCard label="Lỗi (4xx/5xx)" value={`${stats.errors}`} sub={`${errorRate}%`} tone={stats.errors > 0 ? 'fail' : undefined} />
        <SummaryCard label="Avg latency" value={fmtMs(stats.avgMs)} />
        <SummaryCard label="P95 latency" value={fmtMs(stats.p95Ms)} />
        <SummaryCard label="Max latency" value={fmtMs(stats.maxMs)} />
      </div>

      {/* Slowest endpoints chart */}
      {topSlow.length > 0 && (
        <div className="stat-panel" style={{ marginBottom: 12 }}>
          <div className="stat-panel-title">Endpoint chậm nhất (avg ms)</div>
          <ResponsiveContainer width="100%" height={Math.max(180, topSlow.length * 30)}>
            <BarChart data={topSlow} layout="vertical" margin={{ top: 0, right: 80, left: 8, bottom: 0 }}>
              <CartesianGrid {...GRID} horizontal={false} vertical />
              <XAxis type="number" {...AXIS} tickFormatter={v => fmtMs(v as number)} />
              <YAxis type="category" dataKey="endpoint" {...AXIS} tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} width={240} />
              <Tooltip
                {...TIP}
                formatter={(val, name) => [
                  name === 'avg' ? fmtMs(val as number) : name === 'p95' ? fmtMs(val as number) : fmtMs(val as number),
                  name === 'avg' ? 'Avg' : name === 'p95' ? 'P95' : 'Max',
                ]}
              />
              <Bar dataKey="avg" name="avg" radius={BAR_H} barSize={10}>
                {topSlow.map((entry, i) => (
                  <Cell key={i} fill={entry.avg > 1000 ? 'var(--chart-fail)' : entry.avg > 300 ? 'var(--chart-warn)' : entry.avg > 100 ? 'var(--chart-caution)' : 'var(--chart-ok)'} />
                ))}
              </Bar>
              <Bar dataKey="p95" name="p95" fill="var(--text-faint)" radius={BAR_H} barSize={6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters + search */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        {(['all', '2xx', '3xx', '4xx', '5xx'] as StatusFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={'stat-chip' + (filter === f ? ' stat-chip--on' : '')}>
            {f !== 'all' && <i className="stat-dot" style={{ background: statusColor(Number(f[0]) * 100) }} />}{f === 'all' ? 'Tất cả' : f}
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Lọc theo path / method…"
          className="stat-input"
          style={{ marginLeft: 'auto', width: 240 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{filtered.length} entries</span>
      </div>

      {/* Request table */}
      <div className="stat-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="reqlog-row reqlog-head">
          <span>Time</span>
          <span>Method</span>
          <span>Path</span>
          <span style={{ textAlign: 'right' }}>Status</span>
          <span style={{ textAlign: 'right' }}>Duration</span>
        </div>
        <div style={{ maxHeight: 540, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 16px', color: 'var(--text-faint)', fontSize: 13 }}>Không có request nào.</div>
          ) : (
            [...filtered].reverse().map((e, i) => (
              <div key={i} className="reqlog-row">
                <span className="reqlog-time">{fmtTime(e.time)}</span>
                <span className="reqlog-method">{e.method}</span>
                <span className="reqlog-path">{e.path}</span>
                <span className="reqlog-status" style={{ color: statusColor(e.status) }}><i className="stat-dot" style={{ background: statusColor(e.status) }} />{e.status}</span>
                <span className="reqlog-dur" style={{ color: e.duration_ms > 1000 ? 'var(--chart-fail)' : e.duration_ms > 300 ? 'var(--chart-warn)' : undefined }}>{fmtMs(e.duration_ms)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Topology diagram — every label pulled from the live instance/services/traceroute
          state above; nothing here is a hardcoded placeholder value. */}
      {instance && (
        <div className="stat-panel" style={{ marginTop: 12, overflowX: 'auto' }}>
          <div className="stat-panel-title">Sơ đồ topology (số liệu live)</div>
          <svg width="100%" viewBox="0 0 920 260" style={{ minWidth: 820, display: 'block' }}>
            {/* Client node */}
            <rect x="10" y="90" width="150" height="80" rx="8" fill="var(--glass-fill)" stroke="var(--border-strong)" strokeWidth="1.5" />
            <text x="85" y="112" textAnchor="middle" fontSize="11" fontWeight={700} fill="var(--text)">Client (bạn)</text>
            <text x="85" y="130" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="var(--text-muted)">{instance.cf_connecting_ip}</text>
            <text x="85" y="144" textAnchor="middle" fontSize="9" fill="var(--text-muted)">{instance.cf_ip_country}</text>
            <text x="85" y="160" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="var(--text-faint)">{instance.cf_ray}</text>

            <line x1="160" y1="130" x2="270" y2="130" stroke="var(--border-strong)" strokeWidth="1.5" />
            <polygon points="270,125 280,130 270,135" fill="var(--border-strong)" />
            <text x="215" y="122" textAnchor="middle" fontSize="8" fill="var(--text-muted)">Cloudflare</text>

            {/* Backend pod node */}
            <rect x="280" y="80" width="190" height="100" rx="8" fill="var(--glass-fill)" stroke="var(--border-strong)" strokeWidth="1.5" />
            <text x="375" y="102" textAnchor="middle" fontSize="11" fontWeight={700} fill="var(--text)">Backend pod</text>
            <text x="375" y="120" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="var(--text-muted)">{instance.pod_name}</text>
            <text x="375" y="136" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="var(--text-muted)">node: {instance.node_name}</text>
            <text x="375" y="152" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="var(--text-muted)">{instance.pod_ip}</text>
            <text x="375" y="168" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="var(--text-faint)">remote: {instance.remote_addr}</text>

            {/* Service nodes fanning out */}
            {services.map((s, i) => {
              const y = 20 + i * 62
              const color = s.reachable ? 'var(--chart-ok)' : 'var(--chart-fail)'
              return (
                <g key={s.name}>
                  <line x1="470" y1="130" x2="600" y2={y + 24} stroke={color} strokeWidth="1.5" opacity={0.8} />
                  <polygon points={`${596},${y + 24 - 4} ${606},${y + 24} ${596},${y + 24 + 4}`} fill={color} />
                  <rect x="610" y={y} width="300" height="48" rx="6" fill="var(--glass-fill)" stroke={color} strokeWidth="1.5" />
                  <text x="622" y={y + 18} fontSize="10" fontWeight={700} fill={color}>{s.name}</text>
                  <text x="622" y={y + 32} fontSize="8" fontFamily="monospace" fill="var(--text-muted)">{s.addr}</text>
                  <text x="898" y={y + 32} textAnchor="end" fontSize="9" fontFamily="monospace" fill={color}>
                    {s.reachable ? `${s.latency_ms}ms` : 'timeout'}
                  </text>
                </g>
              )
            })}
          </svg>
          {traceroute && !traceroute.error && (traceroute.hops?.length ?? 0) > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 6 }}>Traceroute (server → {traceroute.target}) — {traceroute.hops!.length} hop, mỗi hop lấy trực tiếp từ output thật:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {traceroute.hops!.map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--glass-fill-2)', border: '1px solid var(--border)', fontSize: 9, fontFamily: 'monospace', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h}>
                      {h.trim()}
                    </div>
                    {i < traceroute.hops!.length - 1 && <span style={{ opacity: 0.4, fontSize: 11 }}>→</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instance — which pod/node is serving THIS request */}
      <div className="stat-panel" style={{ marginTop: 12 }}>
        <div className="stat-panel-title">Instance đang serve request này</div>
        {instance ? (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12 }}>
            <div><span style={{ opacity: 0.5 }}>Pod: </span><span style={{ fontFamily: 'monospace' }}>{instance.pod_name}</span></div>
            <div><span style={{ opacity: 0.5 }}>Node: </span><span style={{ fontFamily: 'monospace' }}>{instance.node_name}</span></div>
            <div><span style={{ opacity: 0.5 }}>Pod IP: </span><span style={{ fontFamily: 'monospace' }}>{instance.pod_ip}</span></div>
            <div><span style={{ opacity: 0.5 }}>CF-Ray: </span><span style={{ fontFamily: 'monospace' }}>{instance.cf_ray}</span></div>
            <div><span style={{ opacity: 0.5 }}>CF-Connecting-IP: </span><span style={{ fontFamily: 'monospace' }}>{instance.cf_connecting_ip}</span></div>
            <div><span style={{ opacity: 0.5 }}>CF-IPCountry: </span><span style={{ fontFamily: 'monospace' }}>{instance.cf_ip_country}</span></div>
            <div><span style={{ opacity: 0.5 }}>RemoteAddr: </span><span style={{ fontFamily: 'monospace' }}>{instance.remote_addr}</span></div>
          </div>
        ) : <div style={{ opacity: 0.4, fontSize: 12 }}>Không lấy được dữ liệu instance.</div>}
      </div>

      {/* Services — reachability from this backend pod (Phương án A: TCP dial, không dùng k8s API) */}
      <div className="stat-panel" style={{ marginTop: 12 }}>
        <div className="stat-panel-title">Service reachability (TCP dial từ backend pod)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {services.map(s => (
            <div key={s.name} className="stat-inset">
              <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><i className="stat-dot" style={{ background: s.reachable ? 'var(--chart-ok)' : 'var(--chart-fail)' }} />{s.name}</div>
              <div style={{ fontSize: 10, opacity: 0.5, fontFamily: 'monospace' }}>{s.addr}</div>
              <div style={{ fontSize: 11, marginTop: 4, color: s.reachable ? 'var(--chart-ok)' : 'var(--chart-fail)' }}>
                {s.reachable ? `reachable · ${s.latency_ms}ms` : `unreachable${s.error ? ` · ${s.error}` : ''}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Traceroute — server's-eye view outward, NOT the client's path */}
      <div className="stat-panel" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div className="stat-panel-title" style={{ margin: 0 }}>Traceroute</div>
          <button
            onClick={handleRunTraceroute}
            disabled={tracerouteLoading}
            className="btn-secondary"
            style={{ height: 30, padding: '0 14px', fontSize: 12 }}
          >
            {tracerouteLoading ? 'Đang chạy…' : 'Chạy traceroute'}
          </button>
        </div>
        <p style={{ fontSize: 11, opacity: 0.55, marginBottom: 10 }}>
          Góc nhìn từ server ra ngoài — KHÔNG phải đường đi từ thiết bị của bạn. Server không thể thấy router/ISP phía bạn.
        </p>
        {traceroute && (
          traceroute.error ? (
            <div style={{ fontSize: 12, color: '#fb923c' }}>{traceroute.error}</div>
          ) : (
            <pre style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', opacity: 0.85, margin: 0 }}>
              {`target: ${traceroute.target}\n`}
              {(traceroute.hops ?? []).join('\n')}
            </pre>
          )
        )}
      </div>
    </div>
  )
}
