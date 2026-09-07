import { useEffect, useRef, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  fetchRequestLog, type RequestEntry,
  fetchDebugInstance, fetchDebugServices, fetchDebugTraceroute,
  type DebugInstance, type DebugServiceCheck, type DebugTraceroute,
} from '../api'
import Spinner from '../components/Spinner'

const OWNER_PW_KEY = 'cozyroom_owner_password'

const fmtMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

// Traffic-light severity ramp — semantic (5xx error → 2xx ok), not decoration;
// keyed off the chart/status-scoped tokens in index.css so it tracks the theme.
const statusColor = (s: number) =>
  s >= 500 ? 'var(--chart-fail)' : s >= 400 ? 'var(--chart-warn)' : s >= 300 ? 'var(--chart-caution)' : 'var(--chart-ok)'

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px 16px', textAlign: 'center', minWidth: 110 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{sub}</div>}
      <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>{label}</div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Request Log</h2>
        <span style={{ fontSize: 11, opacity: 0.4 }}>500 requests gần nhất · in-memory</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={load} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: 'var(--surface)' }}>↻</button>
          <button
            onClick={() => setAutoRefresh(a => !a)}
            style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: autoRefresh ? 'var(--green)' : 'var(--surface)', color: autoRefresh ? '#000' : 'inherit', fontWeight: autoRefresh ? 600 : 400 }}
          >
            {autoRefresh ? '● Live' : '○ Paused'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <SummaryCard label="Tổng requests" value={String(stats.total)} sub="(buffer 500)" />
        <SummaryCard label="Lỗi (4xx/5xx)" value={`${stats.errors}`} sub={`${errorRate}%`} />
        <SummaryCard label="Avg latency" value={fmtMs(stats.avgMs)} />
        <SummaryCard label="P95 latency" value={fmtMs(stats.p95Ms)} />
        <SummaryCard label="Max latency" value={fmtMs(stats.maxMs)} />
      </div>

      {/* Slowest endpoints chart */}
      {topSlow.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, opacity: 0.6, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Endpoint chậm nhất (avg ms)</div>
          <ResponsiveContainer width="100%" height={Math.max(180, topSlow.length * 30)}>
            <BarChart data={topSlow} layout="vertical" margin={{ top: 0, right: 80, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => fmtMs(v as number)} />
              <YAxis type="category" dataKey="endpoint" tick={{ fontSize: 9 }} width={220} />
              <Tooltip
                cursor={{ fill: 'var(--surface-hover)' }}
                contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11 }}
                formatter={(val, name) => [
                  name === 'avg' ? fmtMs(val as number) : name === 'p95' ? fmtMs(val as number) : fmtMs(val as number),
                  name === 'avg' ? 'Avg' : name === 'p95' ? 'P95' : 'Max',
                ]}
              />
              <Bar dataKey="avg" name="avg" radius={[0, 999, 999, 0]} barSize={10}>
                {topSlow.map((entry, i) => (
                  <Cell key={i} fill={entry.avg > 1000 ? 'var(--chart-fail)' : entry.avg > 300 ? 'var(--chart-warn)' : entry.avg > 100 ? 'var(--chart-caution)' : 'var(--chart-ok)'} />
                ))}
              </Bar>
              <Bar dataKey="p95" name="p95" fill="var(--text-faint)" radius={[0, 999, 999, 0]} barSize={6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters + search */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        {(['all', '2xx', '3xx', '4xx', '5xx'] as StatusFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '3px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
            background: filter === f ? 'var(--green)' : 'var(--surface)',
            color: filter === f ? '#000' : 'inherit',
            fontWeight: filter === f ? 600 : 400,
          }}>{f}</button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Lọc theo path / method…"
          style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--surface)', color: 'inherit', fontSize: 12, width: 220 }}
        />
        <span style={{ fontSize: 11, opacity: 0.4 }}>{filtered.length} entries</span>
      </div>

      {/* Request table */}
      <div style={{ background: 'var(--surface)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 56px 1fr 52px 90px', padding: '8px 14px', fontSize: 10, opacity: 0.45, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span>Time</span>
          <span>Method</span>
          <span>Path</span>
          <span style={{ textAlign: 'right' }}>Status</span>
          <span style={{ textAlign: 'right' }}>Duration</span>
        </div>
        <div style={{ maxHeight: 540, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '20px 14px', opacity: 0.4, fontSize: 13 }}>Không có request nào.</div>
          ) : (
            [...filtered].reverse().map((e, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 56px 1fr 52px 90px',
                  padding: '5px 14px',
                  fontSize: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  borderLeft: `2px solid ${statusColor(e.status)}`,
                }}
              >
                <span style={{ opacity: 0.45, fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(e.time)}</span>
                <span style={{ fontWeight: 600, fontSize: 10, opacity: 0.7 }}>{e.method}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85, fontFamily: 'monospace', fontSize: 11 }}>{e.path}</span>
                <span style={{ textAlign: 'right', color: statusColor(e.status), fontWeight: 600, fontSize: 11 }}>{e.status}</span>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: 0.7, fontSize: 11, color: e.duration_ms > 1000 ? 'var(--chart-fail)' : e.duration_ms > 300 ? 'var(--chart-warn)' : 'inherit' }}>{fmtMs(e.duration_ms)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Topology diagram — every label pulled from the live instance/services/traceroute
          state above; nothing here is a hardcoded placeholder value. */}
      {instance && (
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px', marginTop: 16, overflowX: 'auto' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, opacity: 0.6, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sơ đồ topology (số liệu live)</div>
          <svg width="100%" viewBox="0 0 920 260" style={{ minWidth: 820, display: 'block' }}>
            {/* Client node */}
            <rect x="10" y="90" width="150" height="80" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <text x="85" y="112" textAnchor="middle" fontSize="11" fontWeight={700} fill="rgba(255,255,255,0.92)">Client (bạn)</text>
            <text x="85" y="130" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="rgba(255,255,255,0.55)">{instance.cf_connecting_ip}</text>
            <text x="85" y="144" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.55)">{instance.cf_ip_country}</text>
            <text x="85" y="160" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="rgba(255,255,255,0.32)">{instance.cf_ray}</text>

            <line x1="160" y1="130" x2="270" y2="130" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <polygon points="270,125 280,130 270,135" fill="rgba(255,255,255,0.3)" />
            <text x="215" y="122" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.55)">Cloudflare</text>

            {/* Backend pod node */}
            <rect x="280" y="80" width="190" height="100" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <text x="375" y="102" textAnchor="middle" fontSize="11" fontWeight={700} fill="rgba(255,255,255,0.92)">Backend pod</text>
            <text x="375" y="120" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="rgba(255,255,255,0.55)">{instance.pod_name}</text>
            <text x="375" y="136" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="rgba(255,255,255,0.55)">node: {instance.node_name}</text>
            <text x="375" y="152" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="rgba(255,255,255,0.55)">{instance.pod_ip}</text>
            <text x="375" y="168" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="rgba(255,255,255,0.32)">remote: {instance.remote_addr}</text>

            {/* Service nodes fanning out */}
            {services.map((s, i) => {
              const y = 20 + i * 62
              const color = s.reachable ? '#4ade80' : '#f87171'
              return (
                <g key={s.name}>
                  <line x1="470" y1="130" x2="600" y2={y + 24} stroke={color} strokeWidth="1.5" opacity={0.8} />
                  <polygon points={`${596},${y + 24 - 4} ${606},${y + 24} ${596},${y + 24 + 4}`} fill={color} />
                  <rect x="610" y={y} width="300" height="48" rx="6" fill="rgba(255,255,255,0.03)" stroke={color} strokeWidth="1.5" />
                  <text x="622" y={y + 18} fontSize="10" fontWeight={700} fill={color}>{s.name}</text>
                  <text x="622" y={y + 32} fontSize="8" fontFamily="monospace" fill="#94a3b8">{s.addr}</text>
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
                    <div style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', fontSize: 9, fontFamily: 'monospace', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h}>
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
      <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px', marginTop: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, opacity: 0.6, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instance đang serve request này</div>
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
      <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px', marginTop: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, opacity: 0.6, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service reachability (TCP dial từ backend pod)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {services.map(s => (
            <div key={s.name} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${s.reachable ? '#4ade80' : '#f87171'}` }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 10, opacity: 0.5, fontFamily: 'monospace' }}>{s.addr}</div>
              <div style={{ fontSize: 11, marginTop: 4, color: s.reachable ? '#4ade80' : '#f87171' }}>
                {s.reachable ? `reachable · ${s.latency_ms}ms` : `unreachable${s.error ? ` · ${s.error}` : ''}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Traceroute — server's-eye view outward, NOT the client's path */}
      <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px', marginTop: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Traceroute</div>
          <button
            onClick={handleRunTraceroute}
            disabled={tracerouteLoading}
            style={{ padding: '3px 12px', borderRadius: 6, border: 'none', cursor: tracerouteLoading ? 'default' : 'pointer', fontSize: 12, background: 'var(--green)', color: '#000', opacity: tracerouteLoading ? 0.6 : 1 }}
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
